// Electron Main Process
const { app, BrowserWindow, Menu, ipcMain, screen } = require("electron");
const path = require("path");

// Environment check
const isDev = process.env.NODE_ENV === "development";

// Keep a global reference of the window object
let mainWindow = null;

function sendWindowState(state) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("window-state", state);
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, "../../public/assets/logo.png");

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app - Vite dev server in development, built files in production
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

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
    const newWidth = 1000;
    const newHeight = 700;
    const newX = workArea.x + Math.floor((workArea.width - newWidth) / 2);
    const newY = workArea.y + Math.floor((workArea.height - newHeight) / 2);

    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.unmaximize();
    }

    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    });
    sendWindowState("normal");
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
