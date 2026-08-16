/**
 * Electron's view of the workspace.
 *
 * The sandbox itself lives in `src/shared/paths.js`, without an Electron
 * dependency, so the MCP server enforces the identical boundary. This module
 * is only the part that genuinely needs Electron: locating the user's
 * Documents folder, and revealing a path in their file manager.
 *
 * Re-exports the pure helpers so main-process call sites - and the existing
 * tests - keep importing them from one place.
 */

import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  defaultWorkspaceRoot,
  resolveProjectDir as resolveProjectDirIn,
  workspacePointerPath,
} from "../shared/paths.js";
import {
  availableProjectDirName as availableProjectDirNameIn,
  ensureWorkspace as ensureWorkspaceAt,
  exists,
} from "../shared/project-fs.js";
import { getSettings, updateSettings } from "./settings.js";

export {
  PROJECT_DIRS,
  PROJECT_EXT,
  assetKindForPath,
  projectDirNameFor,
  resolveInProject,
} from "../shared/paths.js";
export { exists } from "../shared/project-fs.js";

let cachedRoot = null;

/**
 * Root directory holding every project.
 *
 * Under Documents rather than userData: projects are the user's creative
 * work, they contain their media, and they should survive an uninstall and
 * be trivially findable in a file manager. The settings file can override the
 * location - that is how "choose where projects are stored" works.
 *
 * @returns {string}
 */
export function workspaceRoot() {
  if (!cachedRoot) {
    cachedRoot =
      getSettings().workspace ?? defaultWorkspaceRoot(app.getPath("documents"));
  }
  return cachedRoot;
}

/**
 * Point the workspace at a new directory and persist the choice.
 *
 * The caller (the settings IPC handler) is responsible for only offering this
 * while no project is open - the open project's paths are resolved against
 * the old root.
 *
 * @param {string|null} dir Absolute directory, or null to restore the default.
 * @returns {Promise<string>} The new root, created if necessary.
 */
export async function setWorkspaceRoot(dir) {
  if (dir !== null && (typeof dir !== "string" || !path.isAbsolute(dir))) {
    throw new Error("Workspace must be an absolute path");
  }
  updateSettings({ workspace: dir });
  cachedRoot = null;
  const root = workspaceRoot();
  await ensureWorkspace();
  publishWorkspacePointer();
  return root;
}

/**
 * Publish the workspace path so the MCP server can find it.
 *
 * Without this the two halves of the product disagree: the app resolves its
 * workspace through Electron's `documents` path, which honours XDG on Linux
 * and the real Documents folder elsewhere, and a standalone Node process has
 * no way to reproduce that. An agent would then create projects in a folder
 * the app never lists, and the live loop would appear to be broken.
 *
 * Best-effort. A failure here costs discovery, not correctness - the server
 * still has RAWMOTION_WORKSPACE and its own default.
 */
export function publishWorkspacePointer() {
  try {
    const file = workspacePointerPath(app.getPath("home"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `${JSON.stringify({ workspace: workspaceRoot(), updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("[workspace] could not publish workspace pointer:", error.message);
  }
}

/** @returns {Promise<string>} */
export function ensureWorkspace() {
  return ensureWorkspaceAt(workspaceRoot());
}

/**
 * @param {string} projectDirName
 * @returns {string} Absolute path, asserted to be a child of the workspace.
 */
export function resolveProjectDir(projectDirName) {
  return resolveProjectDirIn(workspaceRoot(), projectDirName);
}

/** @param {string} name */
export function availableProjectDirName(name) {
  return availableProjectDirNameIn(workspaceRoot(), name);
}

/**
 * Open a path in the OS file manager.
 *
 * Refuses anything outside the workspace, so the renderer cannot use this as
 * a generic "reveal any file" primitive.
 *
 * @param {string} absolutePath
 */
export async function revealInFileManager(absolutePath) {
  const root = workspaceRoot();
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  // The workspace root itself is a legal target - "Open workspace folder" in
  // the launcher reveals it. Only paths *outside* the workspace are refused.
  if (absolutePath !== root && !absolutePath.startsWith(prefix)) {
    throw new Error("Path is outside the workspace");
  }

  if (await exists(absolutePath)) {
    // Directories open directly; showItemInFolder on a directory would open
    // its *parent* with the folder selected, which for the workspace root
    // means dumping the user in Documents.
    const stat = await fs.promises.stat(absolutePath);
    if (stat.isDirectory()) {
      const result = await shell.openPath(absolutePath);
      if (result) throw new Error(result);
      return true;
    }
    shell.showItemInFolder(absolutePath);
    return true;
  }
  // The target may not exist yet - a render that failed - so fall back to
  // its directory rather than doing nothing.
  await shell.openPath(path.dirname(absolutePath));
  return true;
}
