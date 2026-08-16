/**
 * The complete IPC surface of Raw Motion.
 *
 * Main and renderer both import this module, so a channel can never be
 * misspelled on one side only. The preload script cannot import it - a
 * sandboxed preload may only `require("electron")`, not local files - so it
 * repeats these strings as literals. `preload.contract.test.js` asserts the
 * two stay in sync, which is what makes the duplication safe.
 *
 * Naming: `namespace:verb`. Renderer -> main request/response uses
 * `ipcRenderer.invoke`; main -> renderer notifications are listed under
 * EVENTS and are one-way sends.
 */

/** Renderer -> main, invoke/handle. */
export const CHANNELS = {
  APP_GET_INFO: "app:get-info",
  APP_OPEN_EXTERNAL: "app:open-external",

  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close",
  WINDOW_BEGIN_DRAG: "window:begin-drag",

  WORKSPACE_LIST: "workspace:list",
  WORKSPACE_REVEAL: "workspace:reveal",

  PROJECT_CREATE: "project:create",
  PROJECT_OPEN: "project:open",
  PROJECT_SAVE: "project:save",
  PROJECT_CLOSE: "project:close",
  PROJECT_READ_ASSET_URL: "project:read-asset-url",

  ASSET_IMPORT: "asset:import",
  ASSET_LIST: "asset:list",

  FILE_LIST: "file:list",
  FILE_READ: "file:read",
  FILE_WRITE: "file:write",

  RENDER_ENQUEUE: "render:enqueue",
  RENDER_CANCEL: "render:cancel",
  RENDER_LIST: "render:list",
  RENDER_REVEAL: "render:reveal",
};

/** Main -> renderer, one-way sends. */
export const EVENTS = {
  WINDOW_STATE: "window:state",
  PROJECT_CHANGED_ON_DISK: "project:changed-on-disk",
  RENDER_PROGRESS: "render:progress",
};

/** Every string the preload bridge must know about. */
export const ALL_CHANNELS = [
  ...Object.values(CHANNELS),
  ...Object.values(EVENTS),
];

/**
 * Uniform result envelope for every `invoke` handler.
 *
 * Main-process failures must not reject across the bridge: an unhandled
 * rejection in the renderer is a much worse failure mode than a value the
 * caller has to check, and the renderer needs the error *message* to show
 * the user anyway. Every handler resolves with one of these.
 *
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: string, detail?: string }} IpcResult
 */

/**
 * @template T
 * @param {T} value
 * @returns {{ ok: true, value: T }}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * @param {unknown} error
 * @returns {{ ok: false, error: string, detail?: string }}
 */
export function fail(error) {
  if (error instanceof Error) {
    return { ok: false, error: error.message, detail: error.stack };
  }
  return { ok: false, error: String(error) };
}
