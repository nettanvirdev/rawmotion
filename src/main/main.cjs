// Electron Main Process
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  shell,
} = require("electron");
const path = require("path");

// Environment check
const isDev = process.env.NODE_ENV === "development";

// Default (restored) window size, reused by the drag-out-of-maximize logic.
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

// Keep a global reference of the window object
let mainWindow = null;

function sendWindowState(state) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("window-state", state);
  }
}

function createWindow() {
  // In dev we point the window icon at the source PNG; in production the icon
  // is embedded into the .exe by electron-builder, so we leave it undefined.
  const devIcon = path.join(__dirname, "../../public/assets/logo.png");

  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 640,
    minHeight: 480,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    icon: isDev ? devIcon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Avoid a white/transparent flash: only show once the renderer has painted.
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Load the app - Vite dev server in development, built files in production
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  // Security: open external links in the user's browser, never in-app, and
  // block any attempt to navigate the window away from the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isDevServer = isDev && url.startsWith("http://localhost:5173");
    if (!isDevServer && !url.startsWith("file://")) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on("maximize", () => sendWindowState("maximized"));
  mainWindow.on("unmaximize", () => sendWindowState("normal"));
  mainWindow.on("enter-full-screen", () => sendWindowState("fullscreen"));
  mainWindow.on("leave-full-screen", () => sendWindowState("normal"));

  sendWindowState("normal");

  // Hide default application menu
  Menu.setApplicationMenu(null);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers for window controls
ipcMain.on("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on("window-close", () => {
  mainWindow?.close();
});

ipcMain.on("window-begin-drag", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    const { workArea } = screen.getPrimaryDisplay();
    const newX = workArea.x + Math.floor((workArea.width - DEFAULT_WIDTH) / 2);
    const newY = workArea.y + Math.floor((workArea.height - DEFAULT_HEIGHT) / 2);

    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.unmaximize();
    }

    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });
    sendWindowState("normal");
  }
});

// App / runtime info for the renderer (used by the About panel).
ipcMain.handle("app:get-info", () => ({
  name: app.getName(),
  appVersion: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  isDev,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
  },
}));

// Safe, whitelisted external-link opener exposed through the preload bridge.
ipcMain.handle("app:open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    return shell.openExternal(url);
  }
  return false;
});

// Enforce a single running instance; focus the existing window instead.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
