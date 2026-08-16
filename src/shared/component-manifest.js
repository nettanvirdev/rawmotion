/**
 * The custom component manifest format.
 *
 * A custom component is an ordinary TSX module in a project's `components/`
 * directory that exports a React component as `default` and describes itself
 * with `export const manifest = {...}`. The manifest is what makes the
 * component a first-class citizen everywhere at once: the inspector generates
 * controls from `manifest.props`, the MCP server reports it as vocabulary,
 * defaults are derived from it, and validation happens against it.
 *
 * This module is pure data + pure functions with no dependencies, so all
 * three environments can share one definition: the Electron main process
 * (discovery/compilation), the renderer (inspector controls), and the MCP
 * server (agent-facing schema).
 *
 * Manifest prop `type` is deliberately forgiving - `"string"`, `"text"`,
 * `"boolean"`, `"toggle"`, `"enum"`, `"select"`, `"asset"`, `"image"` all
 * mean what a human would guess. Normalisation maps them onto the same
 * PropSpec kinds the built-in registry uses, so one inspector renders both.
 */

/**
 * @typedef {(
 *   | { kind: "text", label: string, default: string, multiline?: boolean }
 *   | { kind: "number", label: string, default: number, min?: number, max?: number, step?: number }
 *   | { kind: "color", label: string, default: string }
 *   | { kind: "select", label: string, default: string, options: { value: string, label: string }[] }
 *   | { kind: "image", label: string, default: string }
 *   | { kind: "toggle", label: string, default: boolean }
 * )} PropSpec
 */

/**
 * @typedef {object} ComponentManifest
 * @property {string} name         Registry name; also the default file base.
 * @property {string} label        Human name shown in pickers.
 * @property {string} description
 * @property {string} category     Free-form grouping, e.g. "Cards".
 * @property {number} version
 * @property {Record<string, PropSpec>} props
 */

const TYPE_ALIASES = {
  text: "text",
  string: "text",
  multiline: "text",
  number: "number",
  int: "number",
  float: "number",
  color: "color",
  colour: "color",
  select: "select",
  enum: "select",
  image: "image",
  asset: "image",
  toggle: "toggle",
  boolean: "toggle",
  bool: "toggle",
};

/**
 * Coerce a raw `export const manifest` value into a valid manifest.
 *
 * Tolerant for the same reason `normalizeProject` is: this object is written
 * by hand (or by an agent), and refusing to load a component because a prop
 * lacked a label would make the format hostile. Anything unusable is dropped
 * or defaulted; the component still loads.
 *
 * @param {unknown} raw
 * @param {string} fallbackName Usually the file's base name.
 * @returns {ComponentManifest}
 */
export function normalizeManifest(raw, fallbackName) {
  const m = raw && typeof raw === "object" ? /** @type {Record<string, any>} */ (raw) : {};
  const name = safeName(typeof m.name === "string" && m.name ? m.name : fallbackName);

  /** @type {Record<string, PropSpec>} */
  const props = {};
  if (m.props && typeof m.props === "object" && !Array.isArray(m.props)) {
    for (const [key, value] of Object.entries(m.props)) {
      const spec = normalizeProp(key, value);
      if (spec) props[key] = spec;
    }
  }

  return {
    name,
    label: typeof m.label === "string" && m.label ? m.label : humanise(name),
    description: typeof m.description === "string" ? m.description : "",
    category: typeof m.category === "string" && m.category ? m.category : "Custom",
    version:
      typeof m.version === "number" && Number.isFinite(m.version)
        ? Math.max(1, Math.round(m.version))
        : 1,
    props,
  };
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {PropSpec | null}
 */
function normalizeProp(key, value) {
  if (!value || typeof value !== "object") return null;
  const kind = TYPE_ALIASES[String(value.type ?? value.kind ?? "").toLowerCase()];
  const label = typeof value.label === "string" && value.label ? value.label : humanise(key);

  switch (kind) {
    case "number": {
      const spec = {
        kind: "number",
        label,
        default: numberOr(value.default, 0),
      };
      if (typeof value.min === "number") spec.min = value.min;
      if (typeof value.max === "number") spec.max = value.max;
      if (typeof value.step === "number" && value.step > 0) spec.step = value.step;
      return spec;
    }
    case "color":
      return { kind: "color", label, default: stringOr(value.default, "#ffffff") };
    case "select": {
      const options = Array.isArray(value.options)
        ? value.options
            .map((o) =>
              typeof o === "string"
                ? { value: o, label: humanise(o) }
                : o && typeof o === "object" && typeof o.value === "string"
                  ? { value: o.value, label: stringOr(o.label, humanise(o.value)) }
                  : null,
            )
            .filter(Boolean)
        : [];
      if (!options.length) return null;
      const fallback = options[0].value;
      const def = stringOr(value.default, fallback);
      return {
        kind: "select",
        label,
        default: options.some((o) => o.value === def) ? def : fallback,
        options,
      };
    }
    case "image":
      return { kind: "image", label, default: stringOr(value.default, "") };
    case "toggle":
      return { kind: "toggle", label, default: Boolean(value.default) };
    case "text":
    default: {
      // Unknown types degrade to text rather than vanishing - the value stays
      // editable, which is what matters.
      const spec = { kind: "text", label, default: stringOr(value.default, "") };
      if (value.multiline || String(value.type ?? "").toLowerCase() === "multiline") {
        spec.multiline = true;
      }
      return spec;
    }
  }
}

/**
 * Default prop values for a manifest, same contract as `componentDefaults`
 * in the built-in registry.
 *
 * @param {ComponentManifest} manifest
 * @returns {Record<string, unknown>}
 */
export function manifestDefaults(manifest) {
  return Object.fromEntries(
    Object.entries(manifest.props).map(([key, spec]) => [key, spec.default]),
  );
}

/**
 * A valid component/registry name: it doubles as a file base name and a JSX
 * identifier, so it is restricted to word characters and starts uppercase.
 *
 * @param {string} raw
 * @returns {string}
 */
export function safeName(raw) {
  const cleaned = String(raw ?? "")
    .replace(/\.(t|j)sx?$/i, "")
    .replace(/[^\w]/g, "");
  if (!cleaned) return "Component";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function stringOr(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** `GlassPricingCard` -> `Glass pricing card`. */
export function humanise(name) {
  const spaced = String(name)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return "Component";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Starter source for a new custom component.
 *
 * Deliberately a *worked example* rather than an empty shell: it shows the
 * manifest format, theme access, frame-based animation and the house easing
 * in twenty lines, which is exactly what a user (or an agent reading one
 * file) needs to write their own.
 *
 * @param {string} name
 * @returns {string}
 */
export function componentTemplate(name) {
  const safe = safeName(name);
  return `import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme, progress } from "rawmotion";

export const manifest = {
  name: "${safe}",
  label: "${humanise(safe)}",
  description: "A custom Raw Motion component.",
  category: "Custom",
  version: 1,
  props: {
    title: { type: "text", label: "Title", default: "Hello" },
    accent: { type: "color", label: "Accent", default: "" },
    size: { type: "number", label: "Size", default: 96, min: 12, max: 400, step: 1 },
  },
};

const ${safe}: React.FC<{ title?: string; accent?: string; size?: number }> = ({
  title = "Hello",
  accent = "",
  size = 96,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const t = progress(frame, 0, fps * 0.6, "outExpo");

  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        color: accent || theme.accent,
        opacity: t,
        transform: \`translateY(\${(1 - t) * size * 0.3}px)\`,
      }}
    >
      {title}
    </div>
  );
};

export default ${safe};
`;
}
