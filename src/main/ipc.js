/**
 * Every IPC handler in the application.
 *
 * Collected in one file on purpose: the IPC surface *is* the renderer's
 * privilege boundary, and a boundary spread across a dozen modules is one
 * nobody can audit. Adding a handler here should feel like a deliberate act.
 *
 * Conventions:
 *  - Handlers never throw across the bridge. `handle` wraps each one so the
 *    renderer always receives `{ ok: true, value }` or `{ ok: false, error }`.
 *  - Nothing takes an absolute path. Callers name a project by its directory
 *    name and pass project-relative paths, which `workspace.js` resolves.
 */

import { BrowserWindow, app, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CHANNELS, EVENTS, fail, ok } from "../shared/ipc.js";
import {
  createProjectOnDisk,
  importAsset,
  listProjectFiles,
  listProjects,
  openProjectFromDisk,
  readProjectFile,
  saveProject,
  scanAssets,
  writeTextFile,
} from "./project-store.js";
import { stopWatching, watchProject } from "./project-watcher.js";
import {
  cancel as cancelRender,
  enqueue as enqueueRender,
  invalidateBundle,
  listJobs,
  onQueueChange,
} from "./render/queue.js";
import {
  resolveInProject,
  resolveProjectDir,
  revealInFileManager,
  workspaceRoot,
} from "./workspace.js";

/**
 * The currently open project. The main process tracks this so the watcher
 * and the render queue do not need the renderer to re-send the directory
 * name on every call, and so closing one project reliably tears down the
 * resources of the previous one.
 *
 * @type {{ dirName: string, dir: string } | null}
 */
let openProject = null;

/**
 * @param {() => BrowserWindow | null} getWindow
 */
export function registerIpc(getWindow) {
  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  /* ---------------- app + window ---------------- */

  handle(CHANNELS.APP_GET_INFO, () => ({
    name: app.getName(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isDev: !app.isPackaged,
    workspace: workspaceRoot(),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  }));

  handle(CHANNELS.APP_OPEN_EXTERNAL, async (_e, url) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      throw new Error("Only http and https URLs can be opened");
    }
    await shell.openExternal(url);
    return true;
  });

  ipcMain.on(CHANNELS.WINDOW_MINIMIZE, () => getWindow()?.minimize());
  ipcMain.on(CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on(CHANNELS.WINDOW_CLOSE, () => getWindow()?.close());

  /* ---------------- workspace + projects ---------------- */

  handle(CHANNELS.WORKSPACE_LIST, () => listProjects());

  handle(CHANNELS.WORKSPACE_REVEAL, async (_e, dirName) => {
    const target = dirName ? resolveProjectDir(dirName) : workspaceRoot();
    await revealInFileManager(target);
    return true;
  });

  handle(CHANNELS.PROJECT_CREATE, async (_e, options) => {
    const handle_ = await createProjectOnDisk({
      name: String(options?.name ?? "Untitled"),
      composition: options?.composition,
      scenes: options?.scenes,
    });
    beginWatching(handle_.dirName, handle_.dir);
    return { dirName: handle_.dirName, project: handle_.project };
  });

  handle(CHANNELS.PROJECT_OPEN, async (_e, dirName) => {
    const handle_ = await openProjectFromDisk(String(dirName));
    beginWatching(handle_.dirName, handle_.dir);
    return { dirName: handle_.dirName, project: handle_.project };
  });

  handle(CHANNELS.PROJECT_SAVE, async (_e, { dirName, project }) => {
    const saved = await saveProject(String(dirName), project);
    return { dirName, project: saved };
  });

  handle(CHANNELS.PROJECT_CLOSE, () => {
    stopWatching();
    if (openProject) invalidateBundle(openProject.dir);
    openProject = null;
    return true;
  });

  /**
   * Turn a project-relative asset path into something an <img>/<video> tag
   * can load.
   *
   * The renderer runs under a strict CSP and has no filesystem access, so it
   * cannot construct this itself. `file://` URLs are used rather than reading
   * bytes over IPC because a 200 MB video must not travel through the bridge.
   */
  handle(CHANNELS.PROJECT_READ_ASSET_URL, (_e, { dirName, src }) => {
    const dir = resolveProjectDir(String(dirName));
    // resolveInProject is what makes this safe - without it this handler
    // would be an arbitrary-file-read primitive.
    const abs = resolveInProject(dir, String(src));
    return { url: pathToFileURL(abs).href };
  });

  /* ---------------- assets ---------------- */

  handle(CHANNELS.ASSET_LIST, (_e, dirName) => scanAssets(String(dirName)));

  handle(CHANNELS.ASSET_IMPORT, async (_e, { dirName, paths }) => {
    let sources = Array.isArray(paths) ? paths.filter((p) => typeof p === "string") : [];

    // No paths supplied means "ask the user" - the file picker runs in the
    // main process, which is the only place allowed to see absolute paths.
    if (!sources.length) {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win ?? undefined, {
        title: "Import media",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Media", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "mp4", "webm", "mov", "mp3", "wav", "m4a", "aac", "ogg"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (result.canceled) return { imported: [], canceled: true };
      sources = result.filePaths;
    }

    const imported = [];
    const errors = [];
    for (const source of sources) {
      try {
        // eslint-disable-next-line no-await-in-loop
        imported.push(await importAsset(String(dirName), source));
      } catch (error) {
        // One unsupported file in a multi-select must not discard the rest.
        errors.push(`${path.basename(source)}: ${error.message}`);
      }
    }
    return { imported, errors, canceled: false };
  });

  /* ---------------- sandboxed files ---------------- */

  handle(CHANNELS.FILE_LIST, (_e, { dirName, path: rel }) =>
    listProjectFiles(String(dirName), rel ? String(rel) : "."),
  );

  handle(CHANNELS.FILE_READ, (_e, { dirName, path: rel }) =>
    readProjectFile(String(dirName), String(rel)),
  );

  handle(CHANNELS.FILE_WRITE, (_e, { dirName, path: rel, content }) =>
    writeTextFile(String(dirName), String(rel), content),
  );

  /* ---------------- rendering ---------------- */

  onQueueChange((queue) => send(EVENTS.RENDER_PROGRESS, queue));

  handle(CHANNELS.RENDER_ENQUEUE, (_e, { dirName, project, label, format, width, height }) => {
    const dir = resolveProjectDir(String(dirName));
    return enqueueRender({
      projectDirName: String(dirName),
      projectDir: dir,
      project,
      label,
      format,
      width,
      height,
    });
  });

  handle(CHANNELS.RENDER_CANCEL, (_e, jobId) => cancelRender(String(jobId)));
  handle(CHANNELS.RENDER_LIST, () => listJobs());
  handle(CHANNELS.RENDER_REVEAL, async (_e, { dirName, outputRelative }) => {
    const dir = resolveProjectDir(String(dirName));
    await revealInFileManager(resolveInProject(dir, String(outputRelative)));
    return true;
  });

  /* ---------------- helpers bound to `send` ---------------- */

  function beginWatching(dirName, dir) {
    if (openProject && openProject.dir !== dir) invalidateBundle(openProject.dir);
    openProject = { dirName, dir };
    watchProject(dir, (payload) => {
      send(EVENTS.PROJECT_CHANGED_ON_DISK, { dirName, ...payload });
    });
  }
}

/** Send the current window state to the renderer. */
export function sendWindowState(win, state) {
  if (win && !win.isDestroyed()) win.webContents.send(EVENTS.WINDOW_STATE, state);
}

/**
 * Register an invoke handler that always resolves with an `IpcResult`.
 *
 * @param {string} channel
 * @param {(event: Electron.IpcMainInvokeEvent, ...args: any[]) => any} fn
 */
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return ok(await fn(event, ...args));
    } catch (error) {
      // Logged as well as returned: the renderer shows the message, but the
      // stack is only useful in the main-process console.
      console.error(`[ipc] ${channel} failed:`, error);
      return fail(error);
    }
  });
}
