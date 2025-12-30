const { contextBridge, ipcRenderer } = require("electron");

// Expose a small, safe API to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,
  isDev: process.env.NODE_ENV === "development",

  // Window control functions
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  beginDrag: () => ipcRenderer.send("window-begin-drag"),
  onWindowState: (callback) => {
    ipcRenderer.on("window-state", (_event, state) => {
      if (typeof callback === "function") callback(state);
    });
  },

  // Add more IPC methods here as needed
  // Example: invoke pattern for async operations
  // getData: (key) => ipcRenderer.invoke("get-data", key),
});
