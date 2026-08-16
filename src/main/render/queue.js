/**
 * The render queue.
 *
 * Rendering is the one operation in Raw Motion that is genuinely expensive -
 * it spawns a headless browser, walks every frame, and pipes them through
 * ffmpeg. Three rules follow from that, and they are the reason this module
 * exists rather than a `renderMedia()` call at the IPC boundary:
 *
 * 1. **Never on the UI path.** Jobs are queued and processed off the IPC
 *    round-trip. `enqueue` returns immediately with a job id; everything
 *    afterwards is reported through progress events.
 *
 * 2. **One at a time.** Remotion already parallelises across frames using
 *    every core available. Running two jobs concurrently makes both slower
 *    and can exhaust memory on large compositions, so the queue is serial.
 *
 * 3. **Bundle once.** Webpack-bundling the composition costs seconds and is
 *    identical for every job in a project, so it is cached per project
 *    directory and invalidated only when the project is closed.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createId } from "../../shared/ids.js";
import { projectDurationInFrames } from "../../shared/project.js";
import { resolveInProject } from "../workspace.js";
import { getSettings } from "../settings.js";
import { detectGpu } from "../gpu.js";

/**
 * @typedef {"queued"|"bundling"|"rendering"|"done"|"failed"|"cancelled"} JobStatus
 *
 * @typedef {object} RenderJob
 * @property {string} id
 * @property {string} label            Shown in the queue panel.
 * @property {string} projectDirName
 * @property {string} projectDir
 * @property {JobStatus} status
 * @property {number} progress         0..1
 * @property {number} renderedFrames
 * @property {number} totalFrames
 * @property {string} outputPath       Absolute.
 * @property {string} outputRelative   Project-relative, for display.
 * @property {"mp4"|"webm"} format
 * @property {number} width
 * @property {number} height
 * @property {number} fps
 * @property {string|null} error
 * @property {string} queuedAt
 * @property {string|null} startedAt
 * @property {string|null} finishedAt
 */

/** @type {RenderJob[]} */
const jobs = [];

/** @type {Map<string, () => void>} Job id -> Remotion cancel trigger. */
const cancellers = new Map();

/** @type {Map<string, Promise<string>>} Project dir -> bundle location. */
const bundleCache = new Map();

let draining = false;

/** @type {((jobs: RenderJob[]) => void) | null} */
let listener = null;

/**
 * Register the single progress listener (the main window).
 *
 * @param {(jobs: RenderJob[]) => void} fn
 */
export function onQueueChange(fn) {
  listener = fn;
}

/** @returns {RenderJob[]} Serialisable snapshot, newest first. */
export function listJobs() {
  return jobs.map(publicView).reverse();
}

function publicView(job) {
  const { projectDir, ...rest } = job;
  return rest;
}

function emit() {
  listener?.(listJobs());
}

/**
 * Queue a render.
 *
 * The project model is snapshotted into the job rather than read at render
 * time: an export must capture the composition as it was when the user
 * pressed the button, not as it happens to be twenty seconds later.
 *
 * @param {object} options
 * @param {string} options.projectDirName
 * @param {string} options.projectDir
 * @param {import("../../shared/project.js").Project} options.project
 * @param {string} [options.label]
 * @param {"mp4"|"webm"} [options.format]
 * @param {number} [options.width]   Override, e.g. to export a 4K master.
 * @param {number} [options.height]
 * @returns {RenderJob}
 */
export function enqueue({
  projectDirName,
  projectDir,
  project,
  label,
  format = "mp4",
  width,
  height,
  scale = 1,
  quality,
}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = project.name.replace(/[^\w -]+/g, "").trim() || "render";
  const outputRelative = `renders/${safeName} ${stamp}.${format}`;

  /** @type {RenderJob} */
  const job = {
    id: createId("job"),
    label: label ?? project.name,
    projectDirName,
    projectDir,
    status: "queued",
    progress: 0,
    renderedFrames: 0,
    totalFrames: projectDurationInFrames(project),
    outputPath: resolveInProject(projectDir, outputRelative),
    outputRelative,
    format,
    width: Math.round((width ?? project.composition.width) * scale),
    height: Math.round((height ?? project.composition.height) * scale),
    fps: project.composition.fps,
    quality: quality ?? getSettings().render.quality,
    error: null,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };

  // Not part of the public view - kept out of `publicView` so a full project
  // model is not serialised across IPC on every progress tick.
  Object.defineProperty(job, "project", {
    value: project,
    enumerable: false,
  });

  jobs.push(job);
  emit();
  void drain();
  return publicView(job);
}

/**
 * @param {string} jobId
 * @returns {boolean} Whether a job was found and cancelled.
 */
export function cancel(jobId) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return false;

  if (job.status === "queued") {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    emit();
    return true;
  }
  const trigger = cancellers.get(jobId);
  if (trigger) {
    trigger();
    return true;
  }
  return false;
}

/** Drop the cached webpack bundle for a project (called when it closes). */
export function invalidateBundle(projectDir) {
  bundleCache.delete(projectDir);
}

/**
 * Process queued jobs one at a time until none remain.
 */
async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const job = jobs.find((j) => j.status === "queued");
      if (!job) break;
      // eslint-disable-next-line no-await-in-loop
      await runJob(job);
    }
  } finally {
    draining = false;
  }
}

/**
 * @param {RenderJob & { project: import("../../shared/project.js").Project }} job
 */
async function runJob(job) {
  job.startedAt = new Date().toISOString();
  job.status = "bundling";
  emit();

  // Imported lazily: `@remotion/renderer` pulls in a large native surface and
  // resolves a browser on load. Paying that at app startup would add seconds
  // to launch for a feature most sessions never use.
  const [{ selectComposition, renderMedia, makeCancelSignal }] = await Promise.all([
    import("@remotion/renderer"),
  ]);

  try {
    await fs.mkdir(path.dirname(job.outputPath), { recursive: true });

    const serveUrl = await getBundle(job.projectDir);

    const inputProps = { project: job.project };
    const composition = await selectComposition({
      serveUrl,
      id: "RawMotion",
      inputProps,
      browserExecutable: browserExecutable(),
    });

    job.status = "rendering";
    job.totalFrames = composition.durationInFrames;
    emit();

    const { cancelSignal, cancel: trigger } = makeCancelSignal();
    cancellers.set(job.id, trigger);

    const accel = await accelerationOptions();
    const tuning = QUALITY[job.quality] ?? QUALITY.standard;

    await renderMedia({
      composition: {
        ...composition,
        width: job.width,
        height: job.height,
      },
      serveUrl,
      codec: job.format === "webm" ? "vp8" : "h264",
      ...(job.format === "webm" ? {} : { crf: tuning.crf, x264Preset: tuning.x264Preset }),
      outputLocation: job.outputPath,
      inputProps,
      cancelSignal,
      browserExecutable: browserExecutable(),
      ...accel,
      // Progress arrives per frame; throttle the IPC chatter to whole
      // percentage points or a long render floods the renderer with events.
      onProgress: ({ renderedFrames }) => {
        const next = renderedFrames / Math.max(1, job.totalFrames);
        if (next - job.progress < 0.01 && renderedFrames !== job.totalFrames) return;
        job.progress = next;
        job.renderedFrames = renderedFrames;
        emit();
      },
    });

    job.status = "done";
    job.progress = 1;
    job.renderedFrames = job.totalFrames;
  } catch (error) {
    // Remotion reports cancellation as a thrown error; it is a normal
    // outcome, not a failure, and must not be shown as one.
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) {
      job.status = "cancelled";
    } else {
      job.status = "failed";
      job.error = message;
    }
  } finally {
    cancellers.delete(job.id);
    job.finishedAt = new Date().toISOString();
    emit();
  }
}

/**
 * Webpack-bundle the Remotion entry, once per project directory.
 *
 * The promise itself is cached, not its result, so two jobs queued back to
 * back share one bundle instead of racing to build two.
 *
 * @param {string} projectDir
 * @returns {Promise<string>} A serve URL / bundle directory.
 */
function getBundle(projectDir) {
  const cached = bundleCache.get(projectDir);
  if (cached) return cached;

  const promise = (async () => {
    const { bundle } = await import("@remotion/bundler");
    // fileURLToPath, not `.pathname`: on Windows the latter yields "/C:/..."
    // which webpack cannot resolve.
    const entry = fileURLToPath(
      new URL("../../remotion/entry.tsx", import.meta.url),
    );
    return bundle({
      entryPoint: entry,
      // The project's assets folder is the bundle's public dir - this is how
      // `staticFile("images/x.png")` inside the composition reaches the
      // project's media (and why the cache is keyed per project directory).
      publicDir: path.join(projectDir, "assets"),
      // Compositions are styled inline precisely so that the render bundle
      // needs no CSS pipeline - see the note in src/motion/README.md.
      webpackOverride: (config) => config,
    });
  })();

  bundleCache.set(projectDir, promise);
  // A failed bundle must not be cached, or every subsequent render in the
  // session replays the same error without retrying.
  promise.catch(() => bundleCache.delete(projectDir));
  return promise;
}

/**
 * Encoder tuning per quality level.
 *
 * `draft` exists for iteration - a director checking timing does not need a
 * visually lossless file. `high` is for the final master.
 */
const QUALITY = {
  draft: { crf: 28, x264Preset: "veryfast" },
  standard: { crf: 20, x264Preset: "medium" },
  high: { crf: 16, x264Preset: "slow" },
};

/**
 * Hardware options for `renderMedia`, derived from settings + detection.
 *
 * Three levers, applied together:
 *
 *  - `chromiumOptions.gl`: which OpenGL implementation the headless browser
 *    composites with. `"angle"` maps to the platform's native GPU API
 *    (D3D11 on Windows, Metal on macOS); `"swangle"` is SwiftShader -
 *    correct everywhere but strictly CPU-bound. This is where "rendering
 *    uses no GPU at all" came from: the headless shell defaults to software.
 *  - `concurrency`: how many browser tabs walk frames in parallel. Remotion's
 *    default is half the cores; users with many cores can raise it in
 *    settings.
 *
 * Encoding stays on x264 deliberately: hardware encoders cannot honour a
 * `crf` quality target (Remotion logs a warning and falls back anyway), and
 * compositing - not encoding - is where render time actually goes.
 */
async function accelerationOptions() {
  const { gpu: mode, concurrency } = getSettings().render;
  const gpu = await detectGpu();

  const useGpu = mode === "on" || (mode === "auto" && gpu.available);

  return {
    chromiumOptions: {
      gl: useGpu ? "angle" : "swangle",
      // Multi-process compositing is what actually lets ANGLE reach the
      // driver on Linux; harmless elsewhere.
      enableMultiProcessOnLinux: true,
    },
    ...(concurrency ? { concurrency } : {}),
  };
}

/**
 * Chromium for Remotion.
 *
 * Remotion downloads its own headless shell on first use, which is the right
 * default for end users. `RAWMOTION_CHROME` overrides it for environments
 * that already have a suitable binary (CI, containers) or that cannot reach
 * the download host.
 *
 * @returns {string | null}
 */
function browserExecutable() {
  return process.env.RAWMOTION_CHROME || null;
}
