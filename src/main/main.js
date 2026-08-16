/**
 * Raw Motion - Electron main process.
 *
 * ESM rather than CommonJS, which is what lets this process import
 * `src/shared/*` directly: the project schema, the timeline maths and the
 * IPC channel names are then literally the same modules the renderer uses,
 * so the two can never disagree about the shape of a project.
 *
 * The preload script stays CommonJS - a sandboxed preload cannot load ESM,
 * and giving up `sandbox: true` to change that would be a bad trade.
 */

import { BrowserWindow, Menu, app, ipcMain, screen, shell } from "electron";
import path from "node:path";
import { CHANNELS } from "../shared/ipc.js";
import { registerIpc, sendWindowState } from "./ipc.js";
import { ensureWorkspace, publishWorkspacePointer } from "./workspace.js";

const isDev = !app.isPackaged;
const dirname = import.meta.dirname;

/**
 * Restored-window size. An editor needs considerably more room than the
 * document-shaped starter this grew out of: below roughly 1100 x 720 the
 * timeline and inspector cannot both be usable, so that is the floor.
 */
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 1100;
const MIN_HEIGHT = 720;

/** @type {BrowserWindow | null} */
let mainWindow = null;

const getWindow = () => mainWindow;

function createWindow() {
  const devIcon = path.join(dirname, "../../public/assets/logo.png");

  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    icon: isDev ? devIcon : undefined,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The canvas composites a lot of blurred, animated layers; without
      // this the preview drops frames on machines with a discrete GPU.
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(dirname, "../../dist/index.html"));
  }

  // Security: external links go to the user's browser, and the window can
  // never be navigated away from the app itself.
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

  // A renderer crash in a creative tool must be visible, not silent - the
  // user needs to know their unsaved edits are at risk.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[main] renderer process gone:", details.reason);
  });

  const relay = (state) => sendWindowState(mainWindow, state);
  mainWindow.on("maximize", () => relay("maximized"));
  mainWindow.on("unmaximize", () => relay("normal"));
  mainWindow.on("enter-full-screen", () => relay("fullscreen"));
  mainWindow.on("leave-full-screen", () => relay("normal"));
  mainWindow.webContents.once("did-finish-load", () =>
    relay(mainWindow?.isMaximized() ? "maximized" : "normal"),
  );

  Menu.setApplicationMenu(null);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Dragging a maximized frameless window: restore it first and re-centre it
 * under the cursor, which is what a native titlebar does.
 */
ipcMain.on(CHANNELS.WINDOW_BEGIN_DRAG, () => {
  if (!mainWindow) return;
  if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) return;

  const { workArea } = screen.getPrimaryDisplay();
  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  else mainWindow.unmaximize();

  mainWindow.setBounds({
    x: workArea.x + Math.floor((workArea.width - DEFAULT_WIDTH) / 2),
    y: workArea.y + Math.floor((workArea.height - DEFAULT_HEIGHT) / 2),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  sendWindowState(mainWindow, "normal");
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    // The workspace must exist before the renderer asks for a project list,
    // and its location must be discoverable by the MCP server before an
    // agent tries to create a project in it.
    await ensureWorkspace();
    publishWorkspacePointer();
    registerIpc(getWindow);
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
