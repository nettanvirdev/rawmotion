/**
 * Reading and writing projects on disk.
 *
 * A project is a *directory*, not a file:
 *
 *   Aurora Launch.rawmotion/
 *     project.json     the model - the single source of truth
 *     assets/          user and generated media
 *     components/      custom motion components (real source files)
 *     renders/         export output
 *     cache/           derived data, safe to delete
 *
 * The directory shape is what makes the project legible to an agent: Claude
 * can list `components/`, read `project.json`, and drop a file into
 * `assets/` using ordinary file tools, and the app picks all of it up.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  createProject,
  normalizeProject,
  serializeProject,
} from "../shared/project.js";
import {
  PROJECT_DIRS,
  availableProjectDirName,
  ensureWorkspace,
  exists,
  resolveInProject,
  resolveProjectDir,
  workspaceRoot,
} from "./workspace.js";
import { noteOwnWrite } from "./project-watcher.js";

const PROJECT_FILE = "project.json";

/**
 * @typedef {object} ProjectHandle
 * @property {string} dirName  Folder name inside the workspace.
 * @property {string} dir      Absolute directory path.
 * @property {import("../shared/project.js").Project} project
 */

/**
 * Create a project directory and write its initial model.
 *
 * @param {object} options
 * @param {string} options.name
 * @param {Partial<import("../shared/project.js").Composition>} [options.composition]
 * @param {import("../shared/project.js").Scene[]} [options.scenes]
 * @returns {Promise<ProjectHandle>}
 */
export async function createProjectOnDisk({ name, composition, scenes }) {
  await ensureWorkspace();
  const dirName = await availableProjectDirName(name);
  const dir = path.join(workspaceRoot(), dirName);

  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    PROJECT_DIRS.map((sub) => fs.mkdir(path.join(dir, sub), { recursive: true })),
  );

  const project = createProject({ name, composition, scenes });
  await writeProjectFile(dir, project);
  return { dirName, dir, project };
}

/**
 * @param {string} dirName
 * @returns {Promise<ProjectHandle>}
 */
export async function openProjectFromDisk(dirName) {
  const dir = resolveProjectDir(dirName);
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
    // Surface the parser's position - it is the only useful thing about a
    // JSON syntax error, and the user may have hand-edited the file.
    throw new Error(
      `${dirName}/${PROJECT_FILE} is not valid JSON: ${cause.message}`,
      { cause },
    );
  }

  // Missing subdirectories are repaired silently: a project cloned from git
  // will be missing every empty directory, and that is not an error.
  await Promise.all(
    PROJECT_DIRS.map((sub) => fs.mkdir(path.join(dir, sub), { recursive: true })),
  );

  return { dirName, dir, project: normalizeProject(parsed) };
}

/**
 * Persist a project model.
 *
 * Writes to a temporary file and renames over the target. `rename` is atomic
 * within a filesystem, so a crash mid-save leaves the previous project.json
 * intact rather than a half-written file - which for a creative tool is the
 * difference between "lost the last edit" and "lost the project".
 *
 * @param {string} dir Absolute project directory.
 * @param {import("../shared/project.js").Project} project
 * @returns {Promise<import("../shared/project.js").Project>} The saved model, with `meta.updatedAt` refreshed.
 */
export async function writeProjectFile(dir, project) {
  const stamped = {
    ...project,
    meta: { ...project.meta, updatedAt: new Date().toISOString() },
  };
  const content = serializeProject(stamped);
  // Fingerprint before writing, so the watcher recognises the resulting
  // event as our own and does not bounce it back into the renderer.
  noteOwnWrite(content);

  const target = path.join(dir, PROJECT_FILE);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, content, "utf8");
  await fs.rename(temp, target);
  return stamped;
}

/**
 * @param {string} dirName
 * @param {import("../shared/project.js").Project} project
 * @returns {Promise<import("../shared/project.js").Project>}
 */
export async function saveProject(dirName, project) {
  const dir = resolveProjectDir(dirName);
  return writeProjectFile(dir, normalizeProject(project));
}

/**
 * Every project in the workspace, newest first.
 *
 * Deliberately reads each `project.json` rather than trusting the folder
 * name, so the sidebar shows the real project name and composition. A
 * project whose JSON is broken is still listed - with `broken: true` - since
 * hiding it would leave the user with no way to notice or fix it.
 *
 * @returns {Promise<{ dirName: string, name: string, updatedAt: string, width: number, height: number, fps: number, sceneCount: number, broken?: boolean }[]>}
 */
export async function listProjects() {
  const root = await ensureWorkspace();
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = entries.filter(
    (e) => e.isDirectory() && e.name.endsWith(".rawmotion"),
  );

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
 *
 * These back both the renderer's code panel and the MCP `file.*` tools.
 * They are intentionally the *only* general-purpose file primitives in the
 * app, and every one of them routes through `resolveInProject`.
 * ------------------------------------------------------------------ */

/** Extensions the code panel and agents may read and write as text. */
const TEXT_EXTENSIONS = new Set([
  ".json", ".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".txt", ".svg",
]);

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/**
 * @param {string} dirName
 * @param {string} [relative] Subdirectory to list. Defaults to the project root.
 * @returns {Promise<{ path: string, name: string, kind: "file"|"directory", size: number }[]>}
 */
export async function listProjectFiles(dirName, relative = ".") {
  const dir = resolveProjectDir(dirName);
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
 * @param {string} dirName
 * @param {string} relative
 * @returns {Promise<{ path: string, content: string }>}
 */
export async function readProjectFile(dirName, relative) {
  const dir = resolveProjectDir(dirName);
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
 * @param {string} dirName
 * @param {string} relative
 * @param {string} content
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function writeTextFile(dirName, relative, content) {
  const dir = resolveProjectDir(dirName);
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
    throw new Error(
      `${ext || "This file type"} is not editable as text in Raw Motion`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

const ASSET_DIR_BY_KIND = {
  image: "assets/images",
  video: "assets/video",
  audio: "assets/audio",
  font: "assets/fonts",
};

const KIND_BY_EXT = {
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
  ".gif": "image", ".svg": "image", ".avif": "image",
  ".mp4": "video", ".webm": "video", ".mov": "video",
  ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".aac": "audio", ".ogg": "audio",
  ".woff": "font", ".woff2": "font", ".ttf": "font", ".otf": "font",
};

/**
 * @param {string} filePath
 * @returns {"image"|"video"|"audio"|"font"|null}
 */
export function assetKindForPath(filePath) {
  return KIND_BY_EXT[path.extname(filePath).toLowerCase()] ?? null;
}

/**
 * Copy an external file into the project's asset directory.
 *
 * Assets are *copied*, never referenced in place. A project that points at
 * `~/Downloads/logo.png` breaks the moment it is moved to another machine or
 * the download is cleared; a self-contained project directory does not.
 *
 * @param {string} dirName
 * @param {string} sourcePath Absolute path outside the project.
 * @returns {Promise<{ kind: string, name: string, src: string, bytes: number }>}
 */
export async function importAsset(dirName, sourcePath) {
  const dir = resolveProjectDir(dirName);
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
 * Every media file physically present in the project's asset directories.
 *
 * Scans the filesystem rather than reading `project.assets`, so a file
 * Claude or the user dropped in by hand shows up in the asset browser
 * without anyone having to register it in the model first.
 *
 * @param {string} dirName
 * @returns {Promise<{ kind: string, name: string, src: string, bytes: number, origin: "user"|"generated" }[]>}
 */
export async function scanAssets(dirName) {
  const dir = resolveProjectDir(dirName);
  const roots = [...new Set(Object.values(ASSET_DIR_BY_KIND)), "assets/generated"];

  const found = await Promise.all(
    roots.map(async (sub) => {
      const abs = resolveInProject(dir, sub);
      const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
      return Promise.all(
        entries
          .filter((e) => e.isFile() && !e.name.startsWith("."))
          .map(async (entry) => {
            const rel = `${sub}/${entry.name}`;
            const stat = await fs.stat(path.join(abs, entry.name));
            return {
              kind: assetKindForPath(entry.name) ?? "image",
              name: entry.name,
              src: rel,
              bytes: stat.size,
              origin: sub.endsWith("generated") ? "generated" : "user",
            };
          }),
      );
    }),
  );

  return found.flat().sort((a, b) => a.name.localeCompare(b.name));
}
