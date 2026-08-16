/**
 * The context bridge - the only route between renderer and main.
 *
 * This file repeats the channel names as string literals rather than
 * importing `src/shared/ipc.js`, because a preload running under
 * `sandbox: true` may only `require("electron")`; it cannot load local
 * modules, and it cannot be ESM. Dropping the sandbox to remove the
 * duplication would trade a real security boundary for tidiness.
 *
 * `preload.contract.test.js` asserts that every channel in the shared module
 * appears here, which is what keeps the two copies honest.
 *
 * Design rules for anything added below:
 *  - Expose *functions*, never `ipcRenderer` itself. Handing the renderer the
 *    raw object would let any script send on any channel.
 *  - Every subscription returns its own unsubscribe, so React effects can
 *    clean up without needing `removeAllListeners` (which would rip out
 *    other components' listeners too).
 */

const { contextBridge, ipcRenderer } = require("electron");

/** Wrap a main -> renderer subscription so callers get an unsubscribe fn. */
function subscribe(channel, callback) {
  const handler = (_event, payload) => {
    if (typeof callback === "function") callback(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("rawmotion", {
  /* ---- window chrome ---- */
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    beginDrag: () => ipcRenderer.send("window:begin-drag"),
    onState: (cb) => subscribe("window:state", cb),
  },

  /* ---- app ---- */
  app: {
    getInfo: () => ipcRenderer.invoke("app:get-info"),
    openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  },

  /* ---- workspace + projects ---- */
  workspace: {
    list: () => ipcRenderer.invoke("workspace:list"),
    reveal: (dirName) => ipcRenderer.invoke("workspace:reveal", dirName),
  },

  /* ---- settings ---- */
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch) => ipcRenderer.invoke("settings:update", patch),
    chooseWorkspace: () => ipcRenderer.invoke("settings:choose-workspace"),
  },

  project: {
    create: (options) => ipcRenderer.invoke("project:create", options),
    open: (dirName) => ipcRenderer.invoke("project:open", dirName),
    save: (dirName, project) =>
      ipcRenderer.invoke("project:save", { dirName, project }),
    close: () => ipcRenderer.invoke("project:close"),
    assetUrl: (dirName, src) =>
      ipcRenderer.invoke("project:read-asset-url", { dirName, src }),
    onChangedOnDisk: (cb) => subscribe("project:changed-on-disk", cb),
  },

  /* ---- assets ---- */
  assets: {
    list: (dirName) => ipcRenderer.invoke("asset:list", dirName),
    import: (dirName, paths) =>
      ipcRenderer.invoke("asset:import", { dirName, paths }),
  },

  /* ---- sandboxed project files ---- */
  files: {
    list: (dirName, path) => ipcRenderer.invoke("file:list", { dirName, path }),
    read: (dirName, path) => ipcRenderer.invoke("file:read", { dirName, path }),
    write: (dirName, path, content) =>
      ipcRenderer.invoke("file:write", { dirName, path, content }),
  },

  /* ---- rendering ---- */
  render: {
    enqueue: (options) => ipcRenderer.invoke("render:enqueue", options),
    cancel: (jobId) => ipcRenderer.invoke("render:cancel", jobId),
    list: () => ipcRenderer.invoke("render:list"),
    reveal: (dirName, outputRelative) =>
      ipcRenderer.invoke("render:reveal", { dirName, outputRelative }),
    onProgress: (cb) => subscribe("render:progress", cb),
  },
});
