/**
 * Watches the open project on disk and pushes external edits to the renderer.
 *
 * This is the mechanism behind Raw Motion's core promise: Claude edits
 * `project.json` with ordinary file tools, and the preview updates. Without
 * it the app would only ever see its own writes and the agent workflow would
 * require a manual reload.
 *
 * Two problems make a naive `fs.watch` unusable here:
 *
 * 1. **Echo.** Every save the app makes fires the watcher, which would push
 *    the project straight back into the renderer and clobber whatever the
 *    user typed in the intervening milliseconds. We fingerprint what we
 *    write and ignore any change matching it.
 *
 * 2. **Chatter.** Editors write in several syscalls, and the atomic
 *    write-then-rename in `project-store` fires twice on some platforms. A
 *    short debounce collapses a burst into one reload.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeProject } from "../shared/project.js";

const DEBOUNCE_MS = 120;

/** @type {{ dir: string, watcher: fs.FSWatcher, timer: NodeJS.Timeout|null } | null} */
let active = null;

/** Digest of the last content this process wrote, to suppress self-echo. */
let ownWriteDigest = "";

/**
 * Record a fingerprint of content the app itself just saved.
 *
 * @param {string} content
 */
export function noteOwnWrite(content) {
  ownWriteDigest = digest(content);
}

/**
 * Start watching a project directory. Replaces any previous watch.
 *
 * @param {string} dir Absolute project directory.
 * @param {(payload: { project: import("../shared/project.js").Project } | { error: string }) => void} onChange
 */
export function watchProject(dir, onChange) {
  stopWatching();

  const file = path.join(dir, "project.json");

  let watcher;
  try {
    // Non-recursive: only `project.json` matters, and recursive watching of
    // an assets directory full of video would be needlessly expensive.
    watcher = fs.watch(dir, { persistent: false }, (_event, filename) => {
      if (filename && filename !== "project.json") return;
      schedule();
    });
  } catch (error) {
    // Watching is an enhancement, not a requirement - a project on a
    // filesystem that does not support it must still be editable.
    onChange({ error: `Live file watching unavailable: ${error.message}` });
    return;
  }

  active = { dir, watcher, timer: null };

  function schedule() {
    if (!active) return;
    if (active.timer) clearTimeout(active.timer);
    active.timer = setTimeout(reload, DEBOUNCE_MS);
  }

  async function reload() {
    if (!active || active.dir !== dir) return;
    try {
      const raw = await fsp.readFile(file, "utf8");
      if (digest(raw) === ownWriteDigest) return; // our own save
      onChange({ project: normalizeProject(JSON.parse(raw)) });
    } catch (error) {
      // A syntax error here is the common case: the file is mid-edit, or an
      // agent wrote invalid JSON. Report it so the renderer can show a
      // non-fatal banner, and keep watching - the next write may well fix it.
      onChange({ error: error.message });
    }
  }
}

export function stopWatching() {
  if (!active) return;
  if (active.timer) clearTimeout(active.timer);
  active.watcher.close();
  active = null;
}

function digest(content) {
  return crypto.createHash("sha1").update(content).digest("hex");
}
