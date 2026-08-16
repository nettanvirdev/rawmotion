/**
 * Prefixed, sortable-ish identifiers used across the project model.
 *
 * These IDs end up inside `project.json`, which humans and Claude both read
 * and hand-edit, so they are prefixed by entity type: seeing `lyr_k3f9a2`
 * in a diff tells you what changed without cross-referencing the file.
 *
 * Uses `crypto.randomUUID` where available (Electron main, modern renderers)
 * and falls back to `Math.random` only so unit tests in bare environments do
 * not need a polyfill. Collision risk at project scale is irrelevant.
 */

/** @typedef {"prj"|"scn"|"lyr"|"aud"|"ast"|"kf"|"job"|"op"} IdPrefix */

const RANDOM_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(length = 10) {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID().replace(/-/g, "").slice(0, length);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  }
  return out;
}

/**
 * @param {IdPrefix} prefix
 * @returns {string}
 */
export function createId(prefix) {
  return `${prefix}_${randomSuffix()}`;
}

/**
 * Make `base` unique against `taken` by appending " 2", " 3", ... - the
 * convention every desktop app uses for duplicated documents.
 *
 * @param {string} base
 * @param {Iterable<string>} taken
 * @returns {string}
 */
export function uniqueName(base, taken) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
