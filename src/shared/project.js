/**
 * The Raw Motion project model.
 *
 * This module is the contract between everything: the Electron main process
 * reads and writes it as `project.json`, the renderer's editor mutates it,
 * the Remotion composition renders it, and an external agent edits it over
 * MCP. It therefore has **no dependencies** beyond `ids.js` and contains no
 * I/O - it is pure data plus pure functions, so it can be unit-tested and
 * imported from any of those environments.
 *
 * Two invariants hold the whole system together:
 *
 * 1. **Duration is derived, never stored.** A project has no `duration`
 *    field. Total length is computed from the scenes and their transition
 *    overlaps. This is what lets a 10-second teaser and a 30-minute film
 *    share one architecture: there is no maximum to raise.
 *
 * 2. **Frames are the unit.** Every time value in the model is an integer
 *    frame count, never seconds. Seconds are a presentation concern and are
 *    derived with `fps` at the edges (timecode display, audio trimming).
 *    Storing seconds would make the model resolution-dependent and would
 *    reintroduce rounding drift on every fps change.
 */

import { createId } from "./ids.js";

export const PROJECT_SCHEMA = "rawmotion/project@1";
export const PROJECT_SCHEMA_VERSION = 1;

/** Layer kinds the built-in renderer understands. */
export const LAYER_TYPES = /** @type {const} */ ([
  "text",
  "image",
  "video",
  "shape",
  "background",
  "component",
]);

/** Audio roles. Purely organisational - they drive track grouping and defaults. */
export const AUDIO_KINDS = /** @type {const} */ ([
  "music",
  "voice",
  "sfx",
]);

export const ASSET_KINDS = /** @type {const} */ ([
  "image",
  "video",
  "audio",
  "font",
]);

/**
 * Composition presets. These are conveniences in the UI only - the model
 * stores raw width/height/fps, so any dimensions are valid and a project is
 * never coupled to a preset.
 */
export const COMPOSITION_PRESETS = [
  { id: "landscape-1080", label: "Landscape", hint: "1920 x 1080", width: 1920, height: 1080, fps: 30 },
  { id: "portrait-1080", label: "Portrait", hint: "1080 x 1920", width: 1080, height: 1920, fps: 30 },
  { id: "square-1080", label: "Square", hint: "1080 x 1080", width: 1080, height: 1080, fps: 30 },
  { id: "landscape-4k", label: "Landscape 4K", hint: "3840 x 2160", width: 3840, height: 2160, fps: 30 },
  { id: "cinema-24", label: "Cinematic", hint: "1920 x 1080 - 24fps", width: 1920, height: 1080, fps: 24 },
];

/**
 * @typedef {object} Composition
 * @property {number} width   Pixels. Must be a positive even integer for MP4.
 * @property {number} height  Pixels. Must be a positive even integer for MP4.
 * @property {number} fps     Frames per second.
 * @property {string} background CSS colour painted beneath every scene.
 */

/**
 * @typedef {object} Transform
 * @property {number} x       Offset from the anchor, in composition pixels.
 * @property {number} y
 * @property {number} scale   1 = natural size.
 * @property {number} rotate  Degrees.
 * @property {number} opacity 0..1.
 * @property {number} blur    Pixels of gaussian blur. 0 = none.
 */

/**
 * @typedef {object} LayerAnimation
 * @property {string} preset            Key into the motion preset registry.
 * @property {number} durationInFrames  Length of the entrance/exit itself.
 * @property {number} delay             Frames to wait before starting.
 * @property {number} [distance]        Preset-specific travel, in pixels.
 * @property {boolean} [spring]         Use spring physics instead of easing.
 */

/**
 * @typedef {object} Layer
 * @property {string} id
 * @property {typeof LAYER_TYPES[number]} type
 * @property {string} name
 * @property {number} start     Frames, relative to the start of its scene.
 * @property {number} duration  Frames.
 * @property {boolean} hidden
 * @property {boolean} locked
 * @property {Transform} transform
 * @property {Record<string, unknown>} props  Type-specific payload.
 * @property {{ enter?: LayerAnimation, exit?: LayerAnimation }} animation
 */

/**
 * @typedef {object} Camera
 * @property {"none"|"push"|"pull"|"pan"} move
 * @property {number} amount  Fractional zoom or pan travel, e.g. 0.08 = 8%.
 */

/**
 * @typedef {object} Transition
 * @property {"none"|"fade"|"wipe"|"slide"|"blur"} type
 * @property {number} durationInFrames  Overlap with the following scene.
 */

/**
 * @typedef {object} Scene
 * @property {string} id
 * @property {string} name
 * @property {number} durationInFrames
 * @property {Camera} camera
 * @property {Transition} transition  Applies between this scene and the next.
 * @property {Layer[]} layers
 */

/**
 * @typedef {object} AudioClip
 * @property {string} id
 * @property {typeof AUDIO_KINDS[number]} kind
 * @property {string} name
 * @property {string} src        Project-relative path, e.g. "assets/audio/x.mp3".
 * @property {number} start      Frames on the project timeline.
 * @property {number} duration   Frames.
 * @property {number} trimStart  Frames skipped from the head of the source.
 * @property {number} volume     0..1.
 * @property {number} fadeIn     Frames.
 * @property {number} fadeOut    Frames.
 * @property {boolean} muted
 * @property {boolean} solo
 */

/**
 * @typedef {object} Asset
 * @property {string} id
 * @property {typeof ASSET_KINDS[number]} kind
 * @property {string} name
 * @property {string} src        Project-relative path.
 * @property {"user"|"generated"} origin
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [durationInSeconds]
 */

/**
 * @typedef {object} Project
 * @property {string} $schema
 * @property {number} version
 * @property {string} id
 * @property {string} name
 * @property {Composition} composition
 * @property {Scene[]} scenes
 * @property {AudioClip[]} audio
 * @property {Asset[]} assets
 * @property {{ createdAt: string, updatedAt: string }} meta
 */

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

/** @returns {Transform} */
export function defaultTransform() {
  return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0 };
}

/** @returns {Camera} */
export function defaultCamera() {
  return { move: "none", amount: 0.06 };
}

/** @returns {Transition} */
export function defaultTransition() {
  return { type: "none", durationInFrames: 0 };
}

/**
 * Per-type layer defaults. Kept here rather than in the renderer so that an
 * agent creating a layer over MCP produces exactly the same shape the UI
 * would have produced.
 *
 * @param {typeof LAYER_TYPES[number]} type
 * @returns {Record<string, unknown>}
 */
export function defaultLayerProps(type) {
  switch (type) {
    case "text":
      return {
        text: "Text",
        fontSize: 96,
        fontWeight: 500,
        letterSpacing: -0.02,
        lineHeight: 1.1,
        color: "#ffffff",
        align: "center",
        maxWidth: 0.8,
        split: "none", // "none" | "chars" | "words" | "lines"
      };
    case "image":
      return { src: "", fit: "contain", radius: 0 };
    case "video":
      return { src: "", fit: "cover", volume: 0, trimStart: 0, radius: 0 };
    case "shape":
      return {
        shape: "rect",
        width: 480,
        height: 300,
        radius: 24,
        fill: "#ffffff",
        fillOpacity: 0.06,
        stroke: "#ffffff",
        strokeOpacity: 0.12,
        strokeWidth: 1,
      };
    case "background":
      // Deliberately only the kind. Every other value - hue, intensity,
      // speed, dots - comes from the project theme, and a default here would
      // silently win over it: an `ember` project would render violet because
      // a hue of 250 was baked into every background layer. Explicit props
      // still override the theme; absent ones inherit.
      return { kind: "studio" };
    case "component":
      return { component: "", props: {} };
    default:
      return {};
  }
}

/**
 * @param {Partial<Layer> & { type: typeof LAYER_TYPES[number] }} init
 * @returns {Layer}
 */
export function createLayer(init) {
  const type = init.type;
  return {
    id: init.id ?? createId("lyr"),
    type,
    name: init.name ?? capitalise(type),
    start: clampInt(init.start ?? 0, 0),
    duration: clampInt(init.duration ?? 90, 1),
    hidden: init.hidden ?? false,
    locked: init.locked ?? false,
    transform: { ...defaultTransform(), ...(init.transform ?? {}) },
    props: { ...defaultLayerProps(type), ...(init.props ?? {}) },
    animation: init.animation ?? {},
    ...(init.layout ? { layout: normalizeLayout(init.layout) } : {}),
  };
}

/**
 * Grid placement for a layer.
 *
 * Optional, and its absence is meaningful: a layer without `layout` keeps the
 * original centre-and-offset behaviour, so projects authored before the grid
 * existed render identically. That is why this returns `undefined` rather
 * than a default-filled object.
 *
 * @param {any} raw
 * @returns {object|undefined}
 */
function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object") return undefined;

  const out = {};
  if (typeof raw.preset === "string") out.preset = raw.preset;
  for (const key of ["col", "span", "row", "rowSpan"]) {
    const value = clampInt(raw[key], 1, 1, 64);
    if (value !== undefined) out[key] = value;
  }
  for (const key of ["offsetX", "offsetY"]) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) out[key] = raw[key];
  }
  if (["left", "center", "right"].includes(raw.align)) out.align = raw.align;
  if (["top", "middle", "bottom"].includes(raw.valign)) out.valign = raw.valign;

  return Object.keys(out).length ? out : undefined;
}

/**
 * @param {Partial<Scene>} [init]
 * @returns {Scene}
 */
export function createScene(init = {}) {
  return {
    id: init.id ?? createId("scn"),
    name: init.name ?? "Scene",
    durationInFrames: clampInt(init.durationInFrames ?? 120, 1),
    camera: { ...defaultCamera(), ...(init.camera ?? {}) },
    transition: { ...defaultTransition(), ...(init.transition ?? {}) },
    layers: (init.layers ?? []).map((l) => createLayer(l)),
  };
}

/**
 * @param {object} [init]
 * @param {string} [init.name]
 * @param {Partial<Composition>} [init.composition]
 * @param {Scene[]} [init.scenes]
 * @param {string} [init.now] ISO timestamp; injected so the function stays pure.
 * @returns {Project}
 */
export function createProject(init = {}) {
  const now = init.now ?? new Date().toISOString();
  return {
    $schema: PROJECT_SCHEMA,
    version: PROJECT_SCHEMA_VERSION,
    id: createId("prj"),
    name: init.name ?? "Untitled",
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#070708",
      ...(init.composition ?? {}),
    },
    theme: { preset: init.theme ?? "midnight" },
    scenes: init.scenes?.length
      ? init.scenes.map((s) => createScene(s))
      : [createScene({ name: "Scene 1" })],
    audio: [],
    assets: [],
    meta: { createdAt: now, updatedAt: now },
  };
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/**
 * Coerce arbitrary parsed JSON into a valid Project.
 *
 * This is deliberately **tolerant rather than strict**. `project.json` is a
 * file humans and agents hand-edit, and rejecting the whole document because
 * one layer is missing an `opacity` would make the format hostile. Anything
 * unrecognised is replaced with a default; anything structurally impossible
 * (a project with no scenes, a zero-length scene) is repaired.
 *
 * Genuine corruption - unparseable JSON, a non-object root - is the caller's
 * problem and throws.
 *
 * @param {unknown} raw
 * @param {string} [now] ISO timestamp used when `meta` is missing.
 * @returns {Project}
 */
export function normalizeProject(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("project.json must contain a JSON object");
  }
  const input = /** @type {Record<string, any>} */ (raw);

  const composition = {
    width: clampInt(input.composition?.width, 16, 16, 7680) ?? 1920,
    height: clampInt(input.composition?.height, 16, 16, 7680) ?? 1080,
    fps: clampInt(input.composition?.fps, 1, 1, 240) ?? 30,
    background: str(input.composition?.background, "#070708"),
  };

  const scenes = asArray(input.scenes).map((scene, i) =>
    normalizeScene(scene, i),
  );

  return {
    $schema: PROJECT_SCHEMA,
    version: PROJECT_SCHEMA_VERSION,
    id: str(input.id, createId("prj")),
    name: str(input.name, "Untitled"),
    composition,
    theme: normalizeThemeRef(input.theme),
    // A project with zero scenes cannot be previewed or rendered - Remotion
    // rejects a zero-frame composition - so repair rather than propagate it.
    scenes: scenes.length ? scenes : [createScene({ name: "Scene 1" })],
    audio: asArray(input.audio).map(normalizeAudio),
    assets: asArray(input.assets).map(normalizeAsset),
    meta: {
      createdAt: str(input.meta?.createdAt, now),
      updatedAt: str(input.meta?.updatedAt, now),
    },
  };
}

/**
 * @param {any} raw
 * @param {number} index
 * @returns {Scene}
 */
/**
 * A project's theme reference.
 *
 * Stored as `{ preset, overrides }` rather than a flattened palette so that
 * changing the preset later re-themes everything, instead of leaving a
 * snapshot of the old palette baked into the file.
 *
 * @param {any} raw
 */
function normalizeThemeRef(raw) {
  if (typeof raw === "string") return { preset: raw };
  if (!raw || typeof raw !== "object") return { preset: "midnight" };

  const out = { preset: str(raw.preset, "midnight") };
  if (raw.overrides && typeof raw.overrides === "object") {
    out.overrides = raw.overrides;
  }
  return out;
}

function normalizeScene(raw, index) {
  const scene = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(scene.id, createId("scn")),
    name: str(scene.name, `Scene ${index + 1}`),
    durationInFrames: clampInt(scene.durationInFrames, 1, 1) ?? 120,
    camera: {
      move: oneOf(scene.camera?.move, ["none", "push", "pull", "pan"], "none"),
      amount: num(scene.camera?.amount, 0.06),
    },
    transition: {
      type: oneOf(
        scene.transition?.type,
        ["none", "fade", "wipe", "slide", "blur"],
        "none",
      ),
      durationInFrames: clampInt(scene.transition?.durationInFrames, 0, 0) ?? 0,
    },
    layers: asArray(scene.layers).map(normalizeLayer),
  };
}

/**
 * @param {any} raw
 * @returns {Layer}
 */
function normalizeLayer(raw) {
  const layer = raw && typeof raw === "object" ? raw : {};
  const type = oneOf(layer.type, LAYER_TYPES, "text");
  const t = layer.transform ?? {};
  return {
    id: str(layer.id, createId("lyr")),
    type,
    name: str(layer.name, capitalise(type)),
    start: clampInt(layer.start, 0, 0) ?? 0,
    duration: clampInt(layer.duration, 1, 1) ?? 90,
    hidden: Boolean(layer.hidden),
    locked: Boolean(layer.locked),
    transform: {
      x: num(t.x, 0),
      y: num(t.y, 0),
      scale: num(t.scale, 1),
      rotate: num(t.rotate, 0),
      opacity: clamp(num(t.opacity, 1), 0, 1),
      blur: Math.max(0, num(t.blur, 0)),
    },
    props: {
      ...defaultLayerProps(type),
      ...(layer.props && typeof layer.props === "object" ? layer.props : {}),
    },
    animation: {
      enter: normalizeAnimation(layer.animation?.enter),
      exit: normalizeAnimation(layer.animation?.exit),
    },
    ...(normalizeLayout(layer.layout) ? { layout: normalizeLayout(layer.layout) } : {}),
  };
}

/**
 * @param {any} raw
 * @returns {LayerAnimation|undefined}
 */
function normalizeAnimation(raw) {
  if (!raw || typeof raw !== "object" || !raw.preset) return undefined;
  return {
    preset: String(raw.preset),
    durationInFrames: clampInt(raw.durationInFrames, 1, 1) ?? 20,
    delay: clampInt(raw.delay, 0, 0) ?? 0,
    distance: raw.distance === undefined ? undefined : num(raw.distance, 60),
    spring: raw.spring === undefined ? undefined : Boolean(raw.spring),
  };
}

/**
 * @param {any} raw
 * @returns {AudioClip}
 */
function normalizeAudio(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(a.id, createId("aud")),
    kind: oneOf(a.kind, AUDIO_KINDS, "music"),
    name: str(a.name, "Audio"),
    src: str(a.src, ""),
    start: clampInt(a.start, 0, 0) ?? 0,
    duration: clampInt(a.duration, 1, 1) ?? 90,
    trimStart: clampInt(a.trimStart, 0, 0) ?? 0,
    volume: clamp(num(a.volume, 1), 0, 1),
    fadeIn: clampInt(a.fadeIn, 0, 0) ?? 0,
    fadeOut: clampInt(a.fadeOut, 0, 0) ?? 0,
    muted: Boolean(a.muted),
    solo: Boolean(a.solo),
  };
}

/**
 * @param {any} raw
 * @returns {Asset}
 */
function normalizeAsset(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(a.id, createId("ast")),
    kind: oneOf(a.kind, ASSET_KINDS, "image"),
    name: str(a.name, "Asset"),
    src: str(a.src, ""),
    origin: oneOf(a.origin, ["user", "generated"], "user"),
    ...(a.width !== undefined ? { width: num(a.width, 0) } : {}),
    ...(a.height !== undefined ? { height: num(a.height, 0) } : {}),
    ...(a.durationInSeconds !== undefined
      ? { durationInSeconds: num(a.durationInSeconds, 0) }
      : {}),
  };
}

/* ------------------------------------------------------------------ *
 * Timeline maths
 *
 * Everything that needs to know "where does scene 3 begin" goes through
 * `sceneTimings`. Duplicating this arithmetic anywhere else is how a
 * timeline and a renderer drift out of sync by a frame.
 * ------------------------------------------------------------------ */

/**
 * Frames by which scene `i` overlaps scene `i + 1`.
 *
 * A transition is an overlap, not extra time: a 15-frame fade means the two
 * scenes share 15 frames, so the project gets *shorter*, not longer. The
 * overlap is clamped to both neighbours because a transition longer than the
 * scene it lives in would place the next scene before this one starts.
 *
 * @param {Scene} scene
 * @param {Scene|undefined} next
 * @returns {number}
 */
export function transitionOverlap(scene, next) {
  if (!next) return 0;
  const t = scene.transition;
  if (!t || t.type === "none" || t.durationInFrames <= 0) return 0;
  return Math.min(
    t.durationInFrames,
    scene.durationInFrames,
    next.durationInFrames,
  );
}

/**
 * Absolute placement of every scene on the project timeline.
 *
 * @param {Project} project
 * @returns {{ id: string, index: number, from: number, duration: number, to: number, overlapWithNext: number }[]}
 */
export function sceneTimings(project) {
  const out = [];
  let cursor = 0;
  for (let i = 0; i < project.scenes.length; i += 1) {
    const scene = project.scenes[i];
    const overlap = transitionOverlap(scene, project.scenes[i + 1]);
    out.push({
      id: scene.id,
      index: i,
      from: cursor,
      duration: scene.durationInFrames,
      to: cursor + scene.durationInFrames,
      overlapWithNext: overlap,
    });
    cursor += scene.durationInFrames - overlap;
  }
  return out;
}

/**
 * Total project length in frames.
 *
 * Never falls below 1: Remotion refuses to mount a composition with
 * `durationInFrames: 0`, and an empty project must still preview.
 *
 * @param {Project} project
 * @returns {number}
 */
export function projectDurationInFrames(project) {
  const timings = sceneTimings(project);
  if (!timings.length) return 1;
  return Math.max(1, Math.max(...timings.map((t) => t.to)));
}

/**
 * The scene occupying a given absolute frame.
 *
 * During a transition two scenes are live at once; this returns the incoming
 * one, which is what selection and the inspector should follow.
 *
 * @param {Project} project
 * @param {number} frame
 * @returns {{ scene: Scene, timing: ReturnType<typeof sceneTimings>[number] } | null}
 */
export function sceneAtFrame(project, frame) {
  const timings = sceneTimings(project);
  for (let i = timings.length - 1; i >= 0; i -= 1) {
    if (frame >= timings[i].from) {
      return { scene: project.scenes[i], timing: timings[i] };
    }
  }
  return timings.length ? { scene: project.scenes[0], timing: timings[0] } : null;
}

/**
 * @param {Project} project
 * @returns {number} Project length in seconds.
 */
export function projectDurationInSeconds(project) {
  return projectDurationInFrames(project) / project.composition.fps;
}

/**
 * Format a frame index as `MM:SS:FF`, the convention every NLE uses.
 *
 * @param {number} frame
 * @param {number} fps
 * @returns {string}
 */
export function formatTimecode(frame, fps) {
  const safeFps = Math.max(1, Math.round(fps));
  const f = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(f / safeFps);
  const frames = f % safeFps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * Human-friendly duration, e.g. `4.5s` or `2:07`. Used in list rows where a
 * full timecode is more precision than the reader wants.
 *
 * @param {number} frame
 * @param {number} fps
 * @returns {string}
 */
export function formatDuration(frame, fps) {
  const seconds = frame / Math.max(1, fps);
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  return `${Math.floor(seconds / 60)}:${pad(Math.round(seconds % 60))}`;
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

/**
 * @param {Project} project
 * @param {string} layerId
 * @returns {{ scene: Scene, sceneIndex: number, layer: Layer, layerIndex: number } | null}
 */
export function findLayer(project, layerId) {
  for (let s = 0; s < project.scenes.length; s += 1) {
    const scene = project.scenes[s];
    const l = scene.layers.findIndex((layer) => layer.id === layerId);
    if (l !== -1) {
      return { scene, sceneIndex: s, layer: scene.layers[l], layerIndex: l };
    }
  }
  return null;
}

/**
 * @param {Project} project
 * @param {string} sceneId
 * @returns {Scene | null}
 */
export function findScene(project, sceneId) {
  return project.scenes.find((s) => s.id === sceneId) ?? null;
}

/**
 * Serialise for disk.
 *
 * Key order is fixed and the output is 2-space indented with a trailing
 * newline, because `project.json` is version-controlled by users: an unstable
 * key order would produce a whole-file diff on every save.
 *
 * @param {Project} project
 * @returns {string}
 */
export function serializeProject(project) {
  const ordered = {
    $schema: PROJECT_SCHEMA,
    version: PROJECT_SCHEMA_VERSION,
    id: project.id,
    name: project.name,
    composition: project.composition,
    theme: project.theme,
    scenes: project.scenes,
    audio: project.audio,
    assets: project.assets,
    meta: project.meta,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/* ------------------------------------------------------------------ *
 * Coercion helpers
 * ------------------------------------------------------------------ */

function str(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function num(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Round to an integer and clamp. Returns `undefined` for non-numeric input so
 * callers can distinguish "absent" from "zero" via `??`.
 */
function clampInt(value, min = 0, floor = min, ceil = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(ceil, Math.max(floor, Math.round(value)));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function capitalise(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pad(n) {
  return String(n).padStart(2, "0");
}
