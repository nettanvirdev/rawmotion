/**
 * Persistent app settings.
 *
 * Stored as JSON in Electron's `userData` directory - deliberately *not* in
 * the workspace, because the settings include where the workspace itself
 * lives. Read lazily, cached for the process lifetime, written atomically on
 * every update.
 *
 * The shape is flat and tolerant: unknown keys survive a round-trip so an
 * older build does not destroy a newer build's settings.
 */

import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

/** @typedef {"auto"|"on"|"off"} GpuMode */
/** @typedef {"draft"|"standard"|"high"} RenderQuality */

/**
 * @typedef {object} Settings
 * @property {string|null} workspace  Absolute override for the workspace root.
 *   `null` means the default `<Documents>/Raw Motion`.
 * @property {{ gpu: GpuMode, quality: RenderQuality, concurrency: number|null }} render
 */

const DEFAULTS = Object.freeze({
  workspace: null,
  render: {
    gpu: "auto",
    quality: "standard",
    concurrency: null,
  },
});

/** @type {Settings | null} */
let cached = null;

/** @returns {string} Absolute path of settings.json. */
export function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

/** @returns {Settings} */
export function getSettings() {
  if (cached) return cached;
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    // Missing or corrupt file - defaults. The next update rewrites it.
  }
  cached = normalize(raw);
  return cached;
}

/**
 * Merge a partial patch into the settings and persist.
 *
 * @param {Partial<Settings>} patch
 * @returns {Settings}
 */
export function updateSettings(patch) {
  const current = getSettings();
  const next = normalize({
    ...current,
    ...(patch ?? {}),
    render: { ...current.render, ...(patch?.render ?? {}) },
  });
  cached = next;
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    // Write-then-rename so a crash mid-write cannot corrupt the file.
    const tmp = `${settingsPath()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, settingsPath());
  } catch (error) {
    console.error("[settings] could not persist settings:", error.message);
  }
  return next;
}

/** Coerce arbitrary parsed JSON into a valid Settings object. */
function normalize(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const render = input.render && typeof input.render === "object" ? input.render : {};
  const workspace =
    typeof input.workspace === "string" && path.isAbsolute(input.workspace)
      ? input.workspace
      : null;
  const concurrency =
    typeof render.concurrency === "number" && Number.isFinite(render.concurrency)
      ? Math.max(1, Math.min(64, Math.round(render.concurrency)))
      : null;

  return {
    workspace,
    render: {
      gpu: ["auto", "on", "off"].includes(render.gpu) ? render.gpu : DEFAULTS.render.gpu,
      quality: ["draft", "standard", "high"].includes(render.quality)
        ? render.quality
        : DEFAULTS.render.quality,
      concurrency,
    },
  };
}
