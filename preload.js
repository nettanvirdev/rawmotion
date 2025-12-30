const { contextBridge, ipcRenderer } = require("electron");

// Expose a small, safe API to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  nodeEnv: process.env.NODE_ENV || "production",
  // Window control functions
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
