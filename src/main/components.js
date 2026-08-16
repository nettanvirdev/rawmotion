/**
 * Custom component service for the desktop app.
 *
 * Owns the `components/` directory of the open project: discovery,
 * compilation, saving, renaming, deletion, and the file watcher that makes
 * an external edit (Claude writing a `.tsx` with ordinary file tools, a user
 * in VS Code) hot-reload the preview - the same live loop `project.json`
 * already has.
 *
 * Compilation itself lives in `src/shared/component-compiler.js` so the MCP
 * server uses byte-identical logic; this module adds the filesystem policy
 * (sandboxed paths, name validation) and the watch lifecycle.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  COMPONENTS_DIR,
  buildEntry,
  discoverComponents,
} from "../shared/component-compiler.js";
import { resolveInProject, resolveProjectDir } from "./workspace.js";

const DEBOUNCE_MS = 150;

/** A component file name: a bare identifier plus a JSX extension. */
const FILE_NAME = /^[A-Za-z_]\w*\.(t|j)sx$/;

/**
 * @param {string} fileName
 * @returns {string} The validated name.
 */
function checkFileName(fileName) {
  const name = String(fileName ?? "");
  if (!FILE_NAME.test(name)) {
    throw new Error(
      `"${name}" is not a valid component file name - use letters/digits and end with .tsx`,
    );
  }
  return name;
}

/**
 * All components of a project, compiled.
 *
 * @param {string} dirName
 */
export function listComponents(dirName) {
  return discoverComponents(resolveProjectDir(String(dirName)));
}

/**
 * Write (create or update) a component source file and compile it.
 *
 * Returns the compiled entry rather than a bare acknowledgement so the
 * caller gets its compile errors in the same round-trip - the editor shows
 * them beside the source immediately, with no second request.
 *
 * @param {string} dirName
 * @param {string} fileName e.g. "GlassCard.tsx"
 * @param {string} content
 */
export async function saveComponent(dirName, fileName, content) {
  const name = checkFileName(fileName);
  const projectDir = resolveProjectDir(String(dirName));
  const abs = resolveInProject(projectDir, `${COMPONENTS_DIR}/${name}`);

  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, String(content ?? ""), "utf8");

  return buildEntry(projectDir, name);
}

/**
 * @param {string} dirName
 * @param {string} fileName
 */
export async function readComponent(dirName, fileName) {
  const name = checkFileName(fileName);
  const projectDir = resolveProjectDir(String(dirName));
  const abs = resolveInProject(projectDir, `${COMPONENTS_DIR}/${name}`);
  const content = await fsp.readFile(abs, "utf8");
  return { file: `${COMPONENTS_DIR}/${name}`, content };
}

/**
 * Delete a component source file.
 *
 * A hard delete, not trash: the file is text the editor showed seconds ago,
 * undoable by re-saving, and `shell.trashItem` is asynchronous UI noise for
 * a file this small. The caller confirms in the UI.
 *
 * @param {string} dirName
 * @param {string} fileName
 */
export async function deleteComponent(dirName, fileName) {
  const name = checkFileName(fileName);
  const projectDir = resolveProjectDir(String(dirName));
  await fsp.rm(resolveInProject(projectDir, `${COMPONENTS_DIR}/${name}`));
  return true;
}

/**
 * @param {string} dirName
 * @param {string} fromFile
 * @param {string} toFile
 */
export async function renameComponent(dirName, fromFile, toFile) {
  const from = checkFileName(fromFile);
  const to = checkFileName(toFile);
  const projectDir = resolveProjectDir(String(dirName));
  const target = resolveInProject(projectDir, `${COMPONENTS_DIR}/${to}`);

  try {
    await fsp.access(target);
    throw new Error(`"${to}" already exists`);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }

  await fsp.rename(resolveInProject(projectDir, `${COMPONENTS_DIR}/${from}`), target);
  return buildEntry(projectDir, to);
}

/* ------------------------------------------------------------------ *
 * Watching
 * ------------------------------------------------------------------ */

/** @type {{ dir: string, watcher: fs.FSWatcher | null, timer: NodeJS.Timeout | null } | null} */
let active = null;

/**
 * Watch a project's components directory and push the full recompiled list
 * on every change.
 *
 * The full list, not a delta: compilation is tens of milliseconds for a
 * handful of files, and a delta protocol would need the renderer to
 * replicate the reconciliation this module already does.
 *
 * @param {string} projectDir Absolute project directory.
 * @param {(components: import("../shared/component-compiler.js").CompiledComponent[]) => void} onChange
 */
export function watchComponents(projectDir, onChange) {
  stopWatchingComponents();

  const dir = path.join(projectDir, COMPONENTS_DIR);
  // The directory may not exist yet - watch lazily by retrying on demand
  // would complicate the lifecycle, so ensure it exists instead. An empty
  // `components/` directory is also self-documenting for users and agents.
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }

  let watcher = null;
  try {
    watcher = fs.watch(dir, { persistent: false }, () => {
      if (!active || active.dir !== projectDir) return;
      if (active.timer) clearTimeout(active.timer);
      active.timer = setTimeout(() => {
        if (active) active.timer = null;
        void discoverComponents(projectDir).then((components) => {
          if (active && active.dir === projectDir) onChange(components);
        });
      }, DEBOUNCE_MS);
    });
  } catch {
    watcher = null;
  }

  active = { dir: projectDir, watcher, timer: null };
}

export function stopWatchingComponents() {
  if (!active) return;
  if (active.timer) clearTimeout(active.timer);
  active.watcher?.close();
  active = null;
}
