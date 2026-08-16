/**
 * The project sandbox.
 *
 * Every filesystem path that reaches the main process from the renderer - or
 * later from an MCP agent - is funnelled through `resolveInProject`. Nothing
 * else in the app is allowed to join user-supplied strings onto a path.
 *
 * The threat is not a malicious user; it is a *confused* one, or an agent
 * that writes `../../.ssh/config` because a relative path looked plausible.
 * A single choke point that refuses to escape the project directory is
 * cheaper and far more reliable than auditing every call site.
 */

import { app, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

/** Directory suffix that marks a folder as a Raw Motion project. */
export const PROJECT_EXT = ".rawmotion";

/** Subdirectories created inside every project. */
export const PROJECT_DIRS = [
  "assets",
  "assets/images",
  "assets/video",
  "assets/audio",
  "assets/generated",
  "assets/fonts",
  "components",
  "renders",
  "cache",
];

/** Files and directories the sandbox refuses to expose, at any depth. */
const DENIED_SEGMENTS = new Set([".git", "node_modules"]);

let cachedRoot = null;

/**
 * Root directory holding every project. Created on first access.
 *
 * Lives under Documents rather than userData: projects are the user's
 * creative work, they contain their media, and they should survive an
 * uninstall and be trivially findable in a file manager.
 *
 * @returns {string}
 */
export function workspaceRoot() {
  if (!cachedRoot) {
    cachedRoot = path.join(app.getPath("documents"), "Raw Motion");
  }
  return cachedRoot;
}

/** @returns {Promise<string>} */
export async function ensureWorkspace() {
  const root = workspaceRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

/**
 * Resolve a project directory by id (its folder name) and assert it is a
 * direct child of the workspace root.
 *
 * @param {string} projectDirName
 * @returns {string} Absolute path.
 */
export function resolveProjectDir(projectDirName) {
  if (typeof projectDirName !== "string" || !projectDirName) {
    throw new Error("A project directory name is required");
  }
  // Reject anything with structure: a project folder is one path segment.
  if (projectDirName !== path.basename(projectDirName)) {
    throw new Error(`Invalid project directory: ${projectDirName}`);
  }
  if (!projectDirName.endsWith(PROJECT_EXT)) {
    throw new Error(`Not a Raw Motion project: ${projectDirName}`);
  }
  return path.join(workspaceRoot(), projectDirName);
}

/**
 * Resolve a project-relative path to an absolute one, refusing to escape.
 *
 * `path.resolve` collapses `..` before we check, so a traversal attempt
 * lands outside `projectDir` and is caught by the prefix test. The trailing
 * separator on the prefix matters: without it, `/projects/a.rawmotion-evil`
 * would pass a naive `startsWith("/projects/a.rawmotion")`.
 *
 * @param {string} projectDir Absolute project directory.
 * @param {string} relative   Project-relative path, e.g. "assets/images/x.png".
 * @returns {string} Absolute path, guaranteed inside `projectDir`.
 */
export function resolveInProject(projectDir, relative) {
  if (typeof relative !== "string") {
    throw new Error("Path must be a string");
  }
  if (path.isAbsolute(relative)) {
    throw new Error(`Path must be project-relative: ${relative}`);
  }
  const resolved = path.resolve(projectDir, relative);
  const prefix = projectDir.endsWith(path.sep)
    ? projectDir
    : projectDir + path.sep;
  if (resolved !== projectDir && !resolved.startsWith(prefix)) {
    throw new Error(`Path escapes the project sandbox: ${relative}`);
  }
  const segments = path.relative(projectDir, resolved).split(path.sep);
  if (segments.some((s) => DENIED_SEGMENTS.has(s))) {
    throw new Error(`Path is not accessible: ${relative}`);
  }
  return resolved;
}

/**
 * Turn a display name into a safe directory name.
 *
 * @param {string} name
 * @returns {string} e.g. "Aurora Launch" -> "Aurora Launch.rawmotion"
 */
export function projectDirNameFor(name) {
  const cleaned = String(name)
    // Characters illegal in Windows filenames, plus path separators and
    // control codes. Spaces and hyphens survive - the folder is user-facing.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80);
  return `${cleaned || "Untitled"}${PROJECT_EXT}`;
}

/**
 * Find a directory name that is not yet taken inside the workspace.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function availableProjectDirName(name) {
  const root = await ensureWorkspace();
  const base = projectDirNameFor(name).slice(0, -PROJECT_EXT.length);
  let candidate = `${base}${PROJECT_EXT}`;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await exists(path.join(root, candidate))) {
    candidate = `${base} ${n}${PROJECT_EXT}`;
    n += 1;
  }
  return candidate;
}

/**
 * @param {string} target
 * @returns {Promise<boolean>}
 */
export async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a path in the OS file manager. Refuses anything outside the workspace,
 * so the renderer cannot use it as a generic "reveal any file" primitive.
 *
 * @param {string} absolutePath
 */
export async function revealInFileManager(absolutePath) {
  const root = workspaceRoot();
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolutePath.startsWith(prefix)) {
    throw new Error("Path is outside the workspace");
  }
  if (await exists(absolutePath)) {
    shell.showItemInFolder(absolutePath);
    return true;
  }
  // The file may not exist yet (a render that failed); fall back to its
  // directory so the user still lands somewhere useful.
  await shell.openPath(path.dirname(absolutePath));
  return true;
}
