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

import { BrowserWindow, Menu, app, ipcMain, protocol, screen, shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { CHANNELS } from "../shared/ipc.js";
import { registerIpc, sendWindowState } from "./ipc.js";
import {
  ensureWorkspace,
  publishWorkspacePointer,
  resolveInProject,
  resolveProjectDir,
} from "./workspace.js";

/**
 * The scheme that carries project media into the renderer.
 *
 * `file://` URLs only load when the page itself is a file:// page - in
 * development the app is served from the Vite dev server over http, and
 * Chromium refuses file:// subresources on an http page regardless of CSP.
 * That made every image and audio asset a broken placeholder in dev preview.
 * A privileged custom scheme loads in both environments, and the handler
 * still routes every request through the project sandbox.
 *
 * Must be registered before `app.whenReady`.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: "rawmotion-asset",
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);

/**
 * URL shape: `rawmotion-asset://project/<dirName>/<project-relative path>`,
 * every segment URI-encoded. The constant `project` host exists because a
 * `standard` scheme requires one and hosts are lowercased - a project
 * directory name could not survive there.
 */
/** Content types the preview actually loads. Media elements need a real
 * type on the response, or Chromium's sniffing can refuse to play. */
const ASSET_MIME = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function registerAssetProtocol() {
  protocol.handle("rawmotion-asset", async (request) => {
    try {
      const { pathname } = new URL(request.url);
      const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const [dirName, ...rest] = segments;
      // resolveProjectDir + resolveInProject are the sandbox - a crafted URL
      // cannot escape the workspace any more than an IPC call can.
      const abs = resolveInProject(resolveProjectDir(dirName), rest.join("/"));

      // Served by hand rather than proxied through `net.fetch(file://...)`,
      // because that proxy answers every request with a full-body 200 and
      // drops the Range header. Media elements *depend* on ranges: every
      // timeline scrub and every trimmed clip's `startFrom` issues one, and
      // an unanswered range leaves the <audio> element stalled forever -
      // which presented as "audio hangs when I click around the timeline".
      const stat = await fsp.stat(abs);
      const type = ASSET_MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") ?? "");

      if (range && (range[1] !== "" || range[2] !== "")) {
        // "bytes=a-b", "bytes=a-" or "bytes=-n" (a suffix of n bytes).
        const start = range[1] === "" ? Math.max(0, stat.size - Number(range[2])) : Number(range[1]);
        const end =
          range[1] !== "" && range[2] !== ""
            ? Math.min(Number(range[2]), stat.size - 1)
            : stat.size - 1;
        if (start >= stat.size || start > end) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${stat.size}` },
          });
        }
        return new Response(Readable.toWeb(fs.createReadStream(abs, { start, end })), {
          status: 206,
          headers: {
            "Content-Type": type,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      return new Response(Readable.toWeb(fs.createReadStream(abs)), {
        status: 200,
        headers: {
          "Content-Type": type,
          "Content-Length": String(stat.size),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      return new Response(`Asset not found: ${error.message}`, { status: 404 });
    }
  });
}

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
    registerAssetProtocol();
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
