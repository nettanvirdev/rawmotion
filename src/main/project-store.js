/**
 * Project persistence, bound to the Electron workspace.
 *
 * All of the real work is in `src/shared/project-fs.js`, which takes the
 * workspace root as a parameter. This module supplies that root and installs
 * the write observer the file watcher needs. Keeping the split means the MCP
 * server runs the same code with a different root and no watcher.
 */

import * as store from "../shared/project-fs.js";
import { noteOwnWrite } from "./project-watcher.js";
import { workspaceRoot } from "./workspace.js";

// Saves made by this process must not bounce back through the watcher and
// clobber what the user typed during the round trip.
store.setWriteObserver(noteOwnWrite);

/** @typedef {{ dirName: string, dir: string, project: import("../shared/project.js").Project }} ProjectHandle */

/**
 * @param {{ name: string, composition?: object, scenes?: object[] }} options
 * @returns {Promise<ProjectHandle>}
 */
export function createProjectOnDisk(options) {
  return store.createProjectOnDisk(workspaceRoot(), options);
}

/**
 * @param {string} dirName
 * @returns {Promise<ProjectHandle>}
 */
export function openProjectFromDisk(dirName) {
  return store.openProjectFromDisk(workspaceRoot(), dirName);
}

/**
 * @param {string} dirName
 * @param {import("../shared/project.js").Project} project
 */
export function saveProject(dirName, project) {
  return store.saveProject(workspaceRoot(), dirName, project);
}

export function listProjects() {
  return store.listProjects(workspaceRoot());
}

/** @param {string} dirName @param {string} [relative] */
export function listProjectFiles(dirName, relative) {
  return store.listProjectFiles(workspaceRoot(), dirName, relative);
}

/** @param {string} dirName @param {string} relative */
export function readProjectFile(dirName, relative) {
  return store.readProjectFile(workspaceRoot(), dirName, relative);
}

/** @param {string} dirName @param {string} relative @param {string} content */
export function writeTextFile(dirName, relative, content) {
  return store.writeTextFile(workspaceRoot(), dirName, relative, content);
}

/** @param {string} dirName @param {string} sourcePath */
export function importAsset(dirName, sourcePath) {
  return store.importAsset(workspaceRoot(), dirName, sourcePath);
}

/** @param {string} dirName */
export function scanAssets(dirName) {
  return store.scanAssets(workspaceRoot(), dirName);
}

/** Re-exported for the render queue, which writes no project files itself. */
export const writeProjectFile = store.writeProjectFile;
