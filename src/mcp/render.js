/**
 * Rendering for the MCP server.
 *
 * Separate from `src/main/render/queue.js` because the two have genuinely
 * different requirements. The app's queue is asynchronous and reports
 * progress to a UI; an agent calling a tool wants a promise that resolves
 * when the file exists, and it wants *stills* far more often than it wants
 * video.
 *
 * The still path is the important one. An agent that cannot see its own
 * output is composing blind - it can only reason about the numbers it wrote.
 * `renderFrame` is what closes that loop, and it is deliberately fast and
 * cheap so an agent can afford to look after every change.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeProject, projectDurationInFrames } from "../shared/project.js";

/**
 * Bundling costs seconds, so bundles are cached - but per *project*, not per
 * process: the project's `assets/` directory is the bundle's public dir, and
 * that is how `staticFile("images/x.png")` in the composition finds the
 * project's media. One shared bundle would serve every project the first
 * project's assets.
 *
 * @type {Map<string, Promise<string>>}
 */
const bundlePromises = new Map();

/**
 * Webpack-bundle the Remotion entry once per project directory.
 *
 * @param {string} [projectDir] Absolute project directory. Omitted = no assets.
 * @returns {Promise<string>} Serve URL.
 */
export function getBundle(projectDir) {
  const key = projectDir ?? "";
  const cached = bundlePromises.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const { bundle } = await import("@remotion/bundler");
    // fileURLToPath, not `.pathname`: on Windows the latter yields "/C:/..."
    const entryPoint = fileURLToPath(new URL("../remotion/entry.tsx", import.meta.url));
    return bundle({
      entryPoint,
      ...(projectDir ? { publicDir: path.join(projectDir, "assets") } : {}),
    });
  })();

  bundlePromises.set(key, promise);
  // A failed bundle must not be cached, or every later call in the session
  // replays the same error without retrying.
  promise.catch(() => {
    bundlePromises.delete(key);
  });
  return promise;
}

/**
 * Chromium for Remotion. `RAWMOTION_CHROME` overrides the downloaded shell,
 * for containers and CI that cannot reach the download host.
 */
function browserExecutable() {
  return process.env.RAWMOTION_CHROME || null;
}

/**
 * GPU compositing for the headless browser.
 *
 * The server has no Electron, so it cannot ask the OS what GPU exists; it
 * defaults to the platform's native GPU API (ANGLE) on desktop OSes, where a
 * missing GPU degrades gracefully, and to SwiftShader on Linux, where a
 * headless box is the common case. `RAWMOTION_GL` overrides both
 * (`angle` | `swangle` | `vulkan`).
 */
function chromiumOptions() {
  const gl =
    process.env.RAWMOTION_GL ||
    (process.platform === "linux" ? "swangle" : "angle");
  return { gl, enableMultiProcessOnLinux: true };
}

async function composition(project, projectDir) {
  const { selectComposition } = await import("@remotion/renderer");
  const serveUrl = await getBundle(projectDir);
  const inputProps = { project };

  const comp = await selectComposition({
    serveUrl,
    id: "RawMotion",
    inputProps,
    browserExecutable: browserExecutable(),
    chromiumOptions: chromiumOptions(),
  });
  return { comp, serveUrl, inputProps };
}

/**
 * Render one frame to a PNG.
 *
 * This is how an agent sees its work. Rendering at a reduced scale by
 * default is deliberate: a 1920x1080 PNG is several megabytes and the agent
 * is judging composition and timing, not pixel detail, so half scale carries
 * the same information at a quarter of the cost.
 *
 * @param {object} options
 * @param {object} options.project
 * @param {number} options.frame Absolute frame on the project timeline.
 * @param {string} options.outputPath Absolute path to write.
 * @param {number} [options.scale] 0.1..1
 * @returns {Promise<{ path: string, frame: number, width: number, height: number }>}
 */
export async function renderFrame({ project, frame, outputPath, scale = 0.5, projectDir }) {
  const { renderStill } = await import("@remotion/renderer");
  const normalized = normalizeProject(project);
  const total = projectDurationInFrames(normalized);

  // Clamp rather than throw: an agent asking for frame 900 of an 800-frame
  // project wants to see the end, and failing the call teaches it nothing.
  const target = Math.max(0, Math.min(total - 1, Math.round(frame)));

  const { comp, serveUrl, inputProps } = await composition(normalized, projectDir);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await renderStill({
    composition: comp,
    serveUrl,
    output: outputPath,
    frame: target,
    inputProps,
    scale: Math.max(0.1, Math.min(1, scale)),
    browserExecutable: browserExecutable(),
    chromiumOptions: chromiumOptions(),
    overwrite: true,
  });

  return {
    path: outputPath,
    frame: target,
    width: Math.round(comp.width * scale),
    height: Math.round(comp.height * scale),
  };
}

/**
 * Render a contact sheet: one still per scene, at the scene's midpoint.
 *
 * Far more useful to an agent than a single frame, because it shows the
 * whole film's composition at once and makes an unbalanced or empty scene
 * immediately obvious. The midpoint is chosen because a scene's first frame
 * is usually mid-entrance and its last is mid-exit - neither represents what
 * the shot actually looks like.
 *
 * @param {object} options
 * @param {object} options.project
 * @param {string} options.outputDir
 * @param {number} [options.scale]
 */
export async function renderContactSheet({ project, outputDir, scale = 0.3, projectDir }) {
  const { renderStill } = await import("@remotion/renderer");
  const normalized = normalizeProject(project);
  const { sceneTimings } = await import("../shared/project.js");
  const timings = sceneTimings(normalized);

  const { comp, serveUrl, inputProps } = await composition(normalized, projectDir);
  await fs.mkdir(outputDir, { recursive: true });

  const shots = [];
  for (let i = 0; i < timings.length; i += 1) {
    const timing = timings[i];
    const frame = Math.min(
      comp.durationInFrames - 1,
      Math.round(timing.from + timing.duration / 2),
    );
    const file = path.join(outputDir, `scene-${String(i + 1).padStart(2, "0")}.png`);

    // eslint-disable-next-line no-await-in-loop
    await renderStill({
      composition: comp,
      serveUrl,
      output: file,
      frame,
      inputProps,
      scale: Math.max(0.1, Math.min(1, scale)),
      browserExecutable: browserExecutable(),
      chromiumOptions: chromiumOptions(),
      overwrite: true,
    });

    shots.push({
      scene: normalized.scenes[i].name,
      index: i,
      frame,
      path: file,
    });
  }

  return shots;
}

/**
 * Render the project to a video file.
 *
 * Resolves when the file is written. Callers that cannot wait that long -
 * which is every MCP client, see `startRenderJob` - should use the job
 * wrapper below instead of calling this directly.
 *
 * @param {object} options
 * @param {object} options.project
 * @param {string} options.outputPath
 * @param {"mp4"|"webm"} [options.format]
 * @param {number} [options.scale] Render at a fraction of composition size.
 * @param {number} [options.crf] Quality. Lower is better; 18 is visually lossless.
 * @param {(progress: { renderedFrames: number, totalFrames: number }) => void} [options.onProgress]
 */
export async function renderVideo({
  project,
  outputPath,
  format = "mp4",
  scale = 1,
  crf = 20,
  projectDir,
  onProgress,
}) {
  const { renderMedia } = await import("@remotion/renderer");
  const normalized = normalizeProject(project);
  const { comp, serveUrl, inputProps } = await composition(normalized, projectDir);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const started = Date.now();

  await renderMedia({
    composition: comp,
    serveUrl,
    codec: format === "webm" ? "vp8" : "h264",
    crf,
    scale,
    outputLocation: outputPath,
    inputProps,
    browserExecutable: browserExecutable(),
    chromiumOptions: chromiumOptions(),
    onProgress: onProgress
      ? ({ renderedFrames }) =>
          onProgress({ renderedFrames, totalFrames: comp.durationInFrames })
      : undefined,
  });

  const stat = await fs.stat(outputPath);
  return {
    path: outputPath,
    frames: comp.durationInFrames,
    width: Math.round(comp.width * scale),
    height: Math.round(comp.height * scale),
    fps: comp.fps,
    seconds: Number((comp.durationInFrames / comp.fps).toFixed(2)),
    bytes: stat.size,
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  };
}


/* ------------------------------------------------------------------ *
 * Render jobs
 *
 * A full-length 1080p render takes minutes. MCP clients apply a request
 * timeout - the reference SDK defaults to 60 seconds - so a synchronous
 * `render_video` tool reports a timeout error to the agent while the render
 * happily continues and writes the file. The agent then believes the render
 * failed, and either retries (doubling the load) or gives up on a video that
 * actually exists.
 *
 * So rendering is a job: start it, poll it. This is the same shape the
 * desktop app's queue uses, and for the same reason.
 * ------------------------------------------------------------------ */

/** @type {Map<string, { id: string, status: string, progress: number, renderedFrames: number, totalFrames: number, path: string|null, error: string|null, startedAt: string, finishedAt: string|null, label: string }>} */
const jobs = new Map();

let jobCounter = 0;

/**
 * Begin a render and return immediately.
 *
 * @param {object} options Same shape as `renderVideo`, plus `label`.
 * @returns {{ jobId: string }}
 */
export function startRenderJob(options) {
  const id = `job_${++jobCounter}`;

  const job = {
    id,
    label: options.label ?? "render",
    status: "rendering",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    path: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(id, job);

  // Deliberately not awaited. The whole point is to return before this
  // finishes; `render_status` is how the caller learns the outcome.
  void renderVideo({
    ...options,
    onProgress: ({ renderedFrames, totalFrames }) => {
      job.renderedFrames = renderedFrames;
      job.totalFrames = totalFrames;
      job.progress = totalFrames ? renderedFrames / totalFrames : 0;
    },
  })
    .then((result) => {
      Object.assign(job, {
        status: "done",
        progress: 1,
        path: result.path,
        finishedAt: new Date().toISOString(),
        result,
      });
    })
    .catch((error) => {
      Object.assign(job, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString(),
      });
    });

  return { jobId: id };
}

/**
 * @param {string} jobId
 * @returns {object | null}
 */
export function getRenderJob(jobId) {
  return jobs.get(jobId) ?? null;
}

/** Every job this session, newest first. */
export function listRenderJobs() {
  return [...jobs.values()].reverse();
}
