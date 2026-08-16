/**
 * Project filesystem operations, independent of Electron.
 *
 * Every function takes the workspace `root` explicitly rather than reaching
 * for a global, which is what lets three very different callers share one
 * implementation:
 *
 *   - the Electron main process, bound to the user's Documents folder;
 *   - the MCP server, bound to whatever workspace the harness points it at;
 *   - the tests, bound to a temp directory.
 *
 * Sharing matters more than tidiness here. The MCP surface is the one an
 * agent drives, so it is the one most likely to be handed a hostile or
 * merely careless path - it must not be running a second, weaker copy of
 * the sandbox.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  ASSET_DIR_BY_KIND,
  MAX_TEXT_BYTES,
  PROJECT_DIRS,
  PROJECT_EXT,
  TEXT_EXTENSIONS,
  assetKindForPath,
  projectDirNameFor,
  resolveInProject,
  resolveProjectDir,
} from "./paths.js";
import { createProject, normalizeProject, serializeProject } from "./project.js";

const PROJECT_FILE = "project.json";

/**
 * Notified of content this process writes, so a file watcher can recognise
 * its own saves and not bounce them back. Only the Electron main process
 * installs one; the MCP server deliberately does not, because its writes
 * *should* reach the running app as external edits.
 *
 * @type {(content: string) => void}
 */
let writeObserver = () => {};

/** @param {(content: string) => void} fn */
export function setWriteObserver(fn) {
  writeObserver = fn;
}

/* ------------------------------------------------------------------ *
 * Workspace
 * ------------------------------------------------------------------ */

/** @param {string} root */
export async function ensureWorkspace(root) {
  await fs.mkdir(root, { recursive: true });
  return root;
}

/** @param {string} target @returns {Promise<boolean>} */
export async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * A project folder name not yet taken in the workspace.
 *
 * @param {string} root
 * @param {string} name
 */
export async function availableProjectDirName(root, name) {
  await ensureWorkspace(root);
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

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */

/**
 * @param {string} root
 * @param {{ name: string, composition?: object, scenes?: object[] }} options
 */
export async function createProjectOnDisk(root, { name, composition, scenes }) {
  await ensureWorkspace(root);
  const dirName = await availableProjectDirName(root, name);
  const dir = path.join(root, dirName);

  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    PROJECT_DIRS.map((sub) => fs.mkdir(path.join(dir, sub), { recursive: true })),
  );

  const project = createProject({ name, composition, scenes });
  await writeProjectFile(dir, project);
  return { dirName, dir, project };
}

/**
 * @param {string} root
 * @param {string} dirName
 */
export async function openProjectFromDisk(root, dirName) {
  const dir = resolveProjectDir(root, dirName);
  const file = path.join(dir, PROJECT_FILE);

  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (cause) {
    throw new Error(`Could not read ${dirName}/${PROJECT_FILE}`, { cause });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    // The parser's position is the only useful thing about a JSON syntax
    // error, and this file is hand-edited by users and agents alike.
    throw new Error(
      `${dirName}/${PROJECT_FILE} is not valid JSON: ${cause.message}`,
      { cause },
    );
  }

  // A project cloned from git arrives without its empty directories.
  await Promise.all(
    PROJECT_DIRS.map((sub) => fs.mkdir(path.join(dir, sub), { recursive: true })),
  );

  return { dirName, dir, project: normalizeProject(parsed) };
}

/**
 * Persist a project model.
 *
 * Writes to a temp file and renames over the target. `rename` is atomic
 * within a filesystem, so a crash mid-save leaves the previous project.json
 * intact rather than a half-written one - for a creative tool that is the
 * difference between losing an edit and losing the project.
 *
 * @param {string} dir Absolute project directory.
 * @param {object} project
 */
export async function writeProjectFile(dir, project) {
  const stamped = {
    ...project,
    meta: { ...project.meta, updatedAt: new Date().toISOString() },
  };
  const content = serializeProject(stamped);

  // Fingerprint before writing, so a watcher in this process recognises the
  // resulting event as its own.
  writeObserver(content);

  const target = path.join(dir, PROJECT_FILE);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, content, "utf8");
  await fs.rename(temp, target);
  return stamped;
}

/**
 * @param {string} root
 * @param {string} dirName
 * @param {object} project
 */
export async function saveProject(root, dirName, project) {
  const dir = resolveProjectDir(root, dirName);
  return writeProjectFile(dir, normalizeProject(project));
}

/**
 * Every project in the workspace, newest first.
 *
 * A project whose JSON is broken is still listed, flagged `broken` - hiding
 * it would leave the user no way to notice or repair it.
 *
 * @param {string} root
 */
export async function listProjects(root) {
  await ensureWorkspace(root);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && e.name.endsWith(PROJECT_EXT));

  const summaries = await Promise.all(
    dirs.map(async (entry) => {
      const file = path.join(root, entry.name, PROJECT_FILE);
      try {
        const project = normalizeProject(JSON.parse(await fs.readFile(file, "utf8")));
        return {
          dirName: entry.name,
          name: project.name,
          updatedAt: project.meta.updatedAt,
          width: project.composition.width,
          height: project.composition.height,
          fps: project.composition.fps,
          sceneCount: project.scenes.length,
        };
      } catch {
        const stat = await fs.stat(path.join(root, entry.name)).catch(() => null);
        return {
          dirName: entry.name,
          name: entry.name.replace(/\.rawmotion$/, ""),
          updatedAt: stat?.mtime.toISOString() ?? new Date(0).toISOString(),
          width: 0,
          height: 0,
          fps: 0,
          sceneCount: 0,
          broken: true,
        };
      }
    }),
  );

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* ------------------------------------------------------------------ *
 * Sandboxed file access
 * ------------------------------------------------------------------ */

/**
 * @param {string} root
 * @param {string} dirName
 * @param {string} [relative]
 */
export async function listProjectFiles(root, dirName, relative = ".") {
  const dir = resolveProjectDir(root, dirName);
  const target = resolveInProject(dir, relative);
  const entries = await fs.readdir(target, { withFileTypes: true });

  const rows = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith("."))
      .map(async (entry) => {
        const abs = path.join(target, entry.name);
        const stat = await fs.stat(abs).catch(() => null);
        return {
          path: path.relative(dir, abs).split(path.sep).join("/"),
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : "file",
          size: stat?.size ?? 0,
        };
      }),
  );

  // Directories first, then alphabetical - the ordering every file tree uses.
  return rows.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1,
  );
}

/**
 * @param {string} root
 * @param {string} dirName
 * @param {string} relative
 */
export async function readProjectFile(root, dirName, relative) {
  const dir = resolveProjectDir(root, dirName);
  const target = resolveInProject(dir, relative);
  assertTextFile(target);

  const stat = await fs.stat(target);
  if (stat.size > MAX_TEXT_BYTES) {
    throw new Error(
      `${relative} is ${(stat.size / 1024 / 1024).toFixed(1)} MB - too large to open as text`,
    );
  }
  return { path: relative, content: await fs.readFile(target, "utf8") };
}

/**
 * @param {string} root
 * @param {string} dirName
 * @param {string} relative
 * @param {string} content
 */
export async function writeTextFile(root, dirName, relative, content) {
  const dir = resolveProjectDir(root, dirName);
  const target = resolveInProject(dir, relative);
  assertTextFile(target);
  if (typeof content !== "string") {
    throw new Error("File content must be a string");
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return { path: relative, bytes: Buffer.byteLength(content, "utf8") };
}

function assertTextFile(target) {
  const ext = path.extname(target).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    throw new Error(`${ext || "This file type"} is not editable as text in Raw Motion`);
  }
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

/**
 * Copy an external file into the project's asset directory.
 *
 * Assets are copied, never referenced in place: a project pointing at
 * `~/Downloads/logo.png` breaks the moment it moves machines.
 *
 * @param {string} root
 * @param {string} dirName
 * @param {string} sourcePath Absolute path outside the project.
 */
export async function importAsset(root, dirName, sourcePath) {
  const dir = resolveProjectDir(root, dirName);
  const kind = assetKindForPath(sourcePath);
  if (!kind) {
    throw new Error(`Unsupported file type: ${path.extname(sourcePath) || sourcePath}`);
  }

  const base = path.basename(sourcePath);
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);

  let relative = `${ASSET_DIR_BY_KIND[kind]}/${base}`;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await exists(resolveInProject(dir, relative))) {
    relative = `${ASSET_DIR_BY_KIND[kind]}/${stem} ${n}${ext}`;
    n += 1;
  }

  const target = resolveInProject(dir, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(sourcePath, target);
  const stat = await fs.stat(target);

  return { kind, name: base, src: relative, bytes: stat.size };
}

/**
 * Every media file physically present in the project.
 *
 * Scans the filesystem rather than reading `project.assets`, so a file an
 * agent dropped in by hand appears without anyone registering it first.
 *
 * @param {string} root
 * @param {string} dirName
 */
export async function scanAssets(root, dirName) {
  const dir = resolveProjectDir(root, dirName);
  const roots = [...new Set(Object.values(ASSET_DIR_BY_KIND)), "assets/generated"];

  const found = await Promise.all(
    roots.map(async (sub) => {
      const abs = resolveInProject(dir, sub);
      const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
      return Promise.all(
        entries
          .filter((e) => e.isFile() && !e.name.startsWith("."))
          .map(async (entry) => {
            const stat = await fs.stat(path.join(abs, entry.name));
            return {
              kind: assetKindForPath(entry.name) ?? "image",
              name: entry.name,
              src: `${sub}/${entry.name}`,
              bytes: stat.size,
              origin: sub.endsWith("generated") ? "generated" : "user",
            };
          }),
      );
    }),
  );

  return found.flat().sort((a, b) => a.name.localeCompare(b.name));
}
