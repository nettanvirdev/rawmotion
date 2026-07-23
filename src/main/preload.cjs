const { contextBridge, ipcRenderer } = require("electron");

// Expose a small, safe API to the renderer. Everything crosses the context
// bridge — the renderer never touches Node or ipcRenderer directly.
contextBridge.exposeInMainWorld("electronAPI", {
  // Window control functions
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  beginDrag: () => ipcRenderer.send("window-begin-drag"),
  onWindowState: (callback) => {
    const handler = (_event, state) => {
      if (typeof callback === "function") callback(state);
    };
    ipcRenderer.on("window-state", handler);
    // Return an unsubscribe function so React effects can clean up.
    return () => ipcRenderer.removeListener("window-state", handler);
  },

  // App / runtime info (name, version, platform, engine versions)
  getAppInfo: () => ipcRenderer.invoke("app:get-info"),

  // Open a URL in the user's default browser (http/https only)
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),

  // Add more IPC methods here as needed
  // Example: invoke pattern for async operations
  // getData: (key) => ipcRenderer.invoke("get-data", key),
});
