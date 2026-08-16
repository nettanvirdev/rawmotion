/**
 * Compile custom components from a project's `components/` directory.
 *
 * Node-only (esbuild + filesystem): imported by the Electron main process,
 * the MCP server and the tests - never by the renderer, which receives the
 * *output* over IPC instead.
 *
 * The pipeline:
 *
 *   components/GlassCard.tsx --esbuild--> CJS text --------> everywhere
 *                                            |
 *                                            +--eval in Node--> manifest
 *
 * Each top-level `.tsx`/`.jsx` file is one component. esbuild bundles it -
 * so a component may import sibling files, shared helpers in subdirectories,
 * or other components - while `react`, `remotion` and `rawmotion` stay
 * external: those are provided by whichever environment finally evaluates
 * the code (the editor preview and the render bundle both already contain
 * them). That is what lets one compiled artefact serve the live preview and
 * the MP4 export identically.
 *
 * The manifest is extracted by evaluating the compiled module here in Node
 * with the real `react`/`remotion` and a benign stub for `rawmotion` (whose
 * implementation is TSX and browser-shaped). Only module-top-level code runs
 * during extraction - the component function itself is never called.
 */

import path from "node:path";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import { normalizeManifest, safeName } from "./component-manifest.js";

const require = createRequire(import.meta.url);

/** The directory, relative to a project root, that holds component sources. */
export const COMPONENTS_DIR = "components";

/** Modules the evaluating environment provides. */
const EXTERNALS = [
  "react",
  "react/*",
  "react-dom",
  "react-dom/*",
  "remotion",
  "remotion/*",
  "rawmotion",
];

/**
 * @typedef {object} CompiledComponent
 * @property {string} name      Registry name (manifest name, or file base).
 * @property {string} file      Project-relative source path, e.g. "components/Card.tsx".
 * @property {string} code      Compiled CJS, or "" when compilation failed.
 * @property {import("./component-manifest.js").ComponentManifest} manifest
 * @property {string|null} error Compile or manifest-evaluation error, human-readable.
 */

/**
 * Compile one source file to evaluatable CJS.
 *
 * @param {string} entryPath Absolute path to the component source.
 * @returns {Promise<{ code: string, warnings: string[] }>}
 * @throws {Error} With an esbuild-formatted message on syntax errors.
 */
export async function compileComponentFile(entryPath) {
  const esbuild = require("esbuild");
  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    target: "chrome120",
    jsx: "automatic",
    external: EXTERNALS,
    logLevel: "silent",
    // Readable output on purpose: this code shows up in error stacks the
    // user has to debug.
    minify: false,
  });

  const warnings = result.warnings.map(formatMessage);
  return { code: result.outputFiles[0].text, warnings };
}

/**
 * Evaluate compiled CJS in Node to pull out `manifest` (and check the
 * default export exists). React and Remotion resolve for real; `rawmotion`
 * is stubbed with a permissive proxy because its implementation is TSX.
 *
 * @param {string} code
 * @param {string} fallbackName
 * @returns {{ manifest: import("./component-manifest.js").ComponentManifest, hasDefault: boolean }}
 */
export function extractManifest(code, fallbackName) {
  const module = { exports: {} };
  const shim = (id) => {
    if (id === "react" || id.startsWith("react/")) return require(id);
    if (id === "react-dom" || id.startsWith("react-dom/")) return require(id);
    if (id === "remotion" || id.startsWith("remotion/")) return require("remotion");
    if (id === "rawmotion") return RAWMOTION_STUB;
    throw new Error(
      `Cannot import "${id}" - a custom component may import react, remotion, rawmotion, and its own project files`,
    );
  };

  const evaluate = new Function("require", "module", "exports", code);
  evaluate(shim, module, module.exports);

  const exports = /** @type {Record<string, unknown>} */ (module.exports);
  return {
    manifest: normalizeManifest(exports.manifest, fallbackName),
    hasDefault: typeof exports.default === "function" || typeof exports.default === "object",
  };
}

/**
 * A stand-in for the `rawmotion` runtime during manifest extraction.
 *
 * Top-level component code may read constants off it (`EASINGS.outExpo`) or
 * grab helpers it calls later; every property yields a callable proxy that
 * also proxies its own properties, so any such access is harmless.
 */
const RAWMOTION_STUB = new Proxy(function stub() {}, {
  get(_target, prop) {
    if (prop === Symbol.toPrimitive) return () => 0;
    if (prop === "default") return RAWMOTION_STUB;
    return RAWMOTION_STUB;
  },
  apply() {
    return RAWMOTION_STUB;
  },
});

/**
 * Discover and compile every component in a project.
 *
 * A file that fails to compile still appears in the result, carrying its
 * error - hiding it would make a typo indistinguishable from deletion in
 * the editor UI, and the agent-facing tools need the error text to fix it.
 *
 * @param {string} projectDir Absolute project directory.
 * @returns {Promise<CompiledComponent[]>}
 */
export async function discoverComponents(projectDir) {
  const dir = path.join(projectDir, COMPONENTS_DIR);

  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return []; // No components/ directory - a project without customs is fine.
  }

  const files = entries
    .filter((e) => e.isFile() && /\.(t|j)sx$/i.test(e.name))
    .map((e) => e.name)
    .sort();

  const out = [];
  for (const name of files) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await buildEntry(projectDir, name));
  }
  return out;
}

/**
 * Compile a single named component file into a registry entry.
 *
 * @param {string} projectDir
 * @param {string} fileName e.g. "GlassCard.tsx"
 * @returns {Promise<CompiledComponent>}
 */
export async function buildEntry(projectDir, fileName) {
  const base = safeName(fileName);
  const file = `${COMPONENTS_DIR}/${fileName}`;
  const abs = path.join(projectDir, COMPONENTS_DIR, fileName);

  try {
    const { code, warnings } = await compileComponentFile(abs);
    const { manifest, hasDefault } = extractManifest(code, base);
    return {
      name: manifest.name,
      file,
      code,
      manifest,
      error: hasDefault
        ? warnings.length
          ? warnings.join("\n")
          : null
        : "The module has no default export - export your component as `export default`.",
    };
  } catch (error) {
    return {
      name: base,
      file,
      code: "",
      manifest: normalizeManifest(null, base),
      error: describeError(error),
    };
  }
}

/** esbuild message -> `file:line:col message`. */
function formatMessage(message) {
  const loc = message.location;
  const where = loc ? `${path.basename(loc.file)}:${loc.line}:${loc.column} ` : "";
  return `${where}${message.text}`;
}

/** Human-readable error, preferring esbuild's located messages. */
function describeError(error) {
  if (error && typeof error === "object" && Array.isArray(error.errors) && error.errors.length) {
    return error.errors.map(formatMessage).join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}
