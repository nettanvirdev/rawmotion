/**
 * Themes.
 *
 * A theme is the whole look of a film in one word: the backdrop, the accent,
 * the type colours, the panel treatment. Setting it is a single call, and
 * every component inherits it - so "make it warmer" is one edit rather than
 * forty.
 *
 * ## Why these backdrops
 *
 * The reference points are the sites that define the current technical-SaaS
 * look - Stripe, Linear, Vercel, Raycast - and they all ship variations of
 * the same small vocabulary: a **mesh gradient**, an **aurora glow**, a **dot
 * grid**, a **spotlight**, and **grain** over the top. Not starfields, not
 * floating 3D shapes, not particles. Particles read as a screensaver from
 * about 2016; a mesh gradient under a dot grid reads as a product.
 *
 * The rules each theme follows:
 *
 * - **Never pure black.** #05060a, not #000000. Pure black kills the sense
 *   of a lit space and crushes every shadow to nothing.
 * - **Never pure white text.** #eef1f7 on dark. Pure white on a dark field
 *   haloes on most displays and in most codecs.
 * - **One accent.** Used only for emphasis the viewer should follow.
 * - **Low chroma in the field, high chroma in the accent.** A saturated
 *   background competes with the content and, at video bitrates, banding and
 *   blocking show up in exactly those flat saturated areas.
 *
 * `backdrop.hue` is an **OKLCH** hue angle, not HSL. HSL lightness is not
 * perceptual - the same L reads far brighter in amber than in blue - so an
 * HSL-authored palette needed different numbers per theme to look equally
 * dark. In OKLCH one set of values holds everywhere. Rough angles:
 * red 29, amber 62, green 145, teal 178, blue 258, violet 278, magenta 316.
 *
 * Plain JS, no React: the MCP server reads this to tell an agent what themes
 * exist, and the server cannot import TSX.
 */

/**
 * @typedef {object} Theme
 * @property {string} name
 * @property {string} description       Shown to an agent choosing a theme.
 * @property {string} background        Composition backdrop colour.
 * @property {string} accent            The single emphasis colour.
 * @property {string} accentSoft        Same hue, for fills and glows.
 * @property {string} text              Primary type.
 * @property {string} textDim           Secondary type.
 * @property {string} textFaint         Labels, line numbers, footnotes.
 * @property {string} panel             Code and terminal window fill.
 * @property {string} panelEdge         Hairline on panels.
 * @property {string} surface           Subtle fill for un-emphasised chips and nodes.
 * @property {boolean} [isLight]        True for light themes; components invert a few cues.
 * @property {boolean} [glass]          Frosted-translucent panels rather than solid ones.
 * @property {object} backdrop          Props for the `studio` background.
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  midnight: {
    name: "Midnight",
    description:
      "Deep indigo with a violet mesh and a soft top spotlight. The default technical-SaaS look - Linear and Vercel territory.",
    background: "#05060c",
    accent: "#8b9bff",
    accentSoft: "#6b7bdd",
    text: "#eef1f7",
    textDim: "#9096ab",
    textFaint: "#5f6478",
    panel: "#0c0e16",
    panelEdge: "rgb(255 255 255 / 0.07)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 278, hueSpread: 34, intensity: 1, dots: 0.5, spotlight: 0.9, grain: 0.045 },
  },

  graphite: {
    name: "Graphite",
    description:
      "Near-neutral charcoal with a faint blue cast and a fine grid. Restrained and editorial - lets code and type carry the frame.",
    background: "#08090b",
    accent: "#c8ccd6",
    accentSoft: "#8b9099",
    text: "#f2f3f5",
    textDim: "#9599a2",
    textFaint: "#5e626b",
    panel: "#0e1013",
    panelEdge: "rgb(255 255 255 / 0.08)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 258, hueSpread: 12, intensity: 0.55, dots: 0.7, spotlight: 1, grain: 0.05, grid: 0.5 },
  },

  aurora: {
    name: "Aurora",
    description:
      "Teal and green flowing bands over deep navy. Fresh and energetic - developer tooling and infrastructure.",
    background: "#04090c",
    accent: "#4fd6b8",
    accentSoft: "#2f9e88",
    text: "#eaf5f2",
    textDim: "#87a09a",
    textFaint: "#546862",
    panel: "#081314",
    panelEdge: "rgb(255 255 255 / 0.07)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 178, hueSpread: 44, intensity: 1.05, dots: 0.35, spotlight: 0.75, grain: 0.045, aurora: 1 },
  },

  ember: {
    name: "Ember",
    description:
      "Warm amber and rose on near-black. Premium and cinematic - launches, brand films, anything that should feel expensive.",
    background: "#0a0605",
    accent: "#ffab5e",
    accentSoft: "#d97f3d",
    text: "#f7f0ea",
    textDim: "#a89388",
    textFaint: "#6b5b52",
    panel: "#150e0a",
    panelEdge: "rgb(255 255 255 / 0.07)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 62, hueSpread: 30, intensity: 1, dots: 0.3, spotlight: 1.1, grain: 0.05 },
  },

  ultraviolet: {
    name: "Ultraviolet",
    description:
      "Magenta and violet with strong beams. High-energy - AI products, launches, anything that wants to feel loud.",
    background: "#07040d",
    accent: "#c77dff",
    accentSoft: "#9d4edd",
    text: "#f3ecfa",
    textDim: "#a294b3",
    textFaint: "#665a75",
    panel: "#100a1a",
    panelEdge: "rgb(255 255 255 / 0.08)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 316, hueSpread: 40, intensity: 1.15, dots: 0.4, spotlight: 0.85, grain: 0.045, beams: 1 },
  },

  arctic: {
    name: "Arctic",
    description:
      "Ice blue on slate with a crisp dot grid. Clean and clinical - data, dashboards, analytics.",
    background: "#060a10",
    accent: "#67c9ff",
    accentSoft: "#3d9bd4",
    text: "#eaf2f9",
    textDim: "#8b9bab",
    textFaint: "#55636f",
    panel: "#0a1119",
    panelEdge: "rgb(255 255 255 / 0.08)",
    surface: "rgb(255 255 255 / 0.04)",
    backdrop: { hue: 238, hueSpread: 26, intensity: 0.85, dots: 0.75, spotlight: 1, grain: 0.05, grid: 0.35 },
  },


  glass: {
    name: "Glass",
    description:
      "Apple-style light glass. Near-white ground with soft colour bleed, frosted squircle panels, near-black type. For consumer product films and anything that should feel like hardware.",
    background: "#f2f2f5",
    accent: "#0071e3",
    accentSoft: "#5aa9f0",
    text: "#1d1d1f",
    textDim: "#6e6e73",
    textFaint: "#a1a1a6",
    // Panels are translucent white rather than solid: on a light ground the
    // frosting is the whole effect, and a solid panel just looks like a box.
    panel: "rgb(255 255 255 / 0.72)",
    panelEdge: "rgb(255 255 255 / 0.85)",
    surface: "rgb(255 255 255 / 0.55)",
    isLight: true,
    glass: true,
    // A wide hue spread is what produces the distinct pink, blue and violet
    // regions of an Apple ground, rather than one uniform tint. Five poles
    // rather than four so no single blob dominates the frame.
    backdrop: {
      hue: 286,
      hueSpread: 130,
      intensity: 1.25,
      points: 5,
      dots: 0,
      spotlight: 0.3,
      grain: 0.012,
      light: true,
      soft: 1,
    },
  },

  paper: {
    name: "Paper",
    description:
      "Light. Warm off-white with a soft grey mesh and near-black type. For documentation and anything that has to read as printed.",
    background: "#f4f4f2",
    accent: "#2f5bff",
    accentSoft: "#7d97ff",
    text: "#14161a",
    textDim: "#5a5f6a",
    textFaint: "#9aa0aa",
    panel: "#ffffff",
    panelEdge: "rgb(0 0 0 / 0.08)",
    surface: "rgb(0 0 0 / 0.045)",
    isLight: true,
    backdrop: { hue: 266, hueSpread: 16, intensity: 0.5, dots: 0.35, spotlight: 0.5, grain: 0.02, light: true },
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export const DEFAULT_THEME = "midnight";

/**
 * Resolve a theme by name, with optional per-project overrides.
 *
 * An unknown name falls back to the default rather than throwing: theme
 * names arrive from `project.json` and a typo should cost the intended look,
 * not the whole render.
 *
 * @param {string} [name]
 * @param {Partial<Theme>} [overrides]
 * @returns {Theme}
 */
export function resolveTheme(name, overrides) {
  const base = THEMES[name] ?? THEMES[DEFAULT_THEME];
  if (!overrides) return base;

  const clean = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return {
    ...base,
    ...clean,
    backdrop: { ...base.backdrop, ...(overrides.backdrop ?? {}) },
  };
}

/** Summary for `describe_capabilities`. */
export function themeCatalogue() {
  return Object.entries(THEMES).map(([id, theme]) => ({
    id,
    name: theme.name,
    description: theme.description,
    accent: theme.accent,
    background: theme.background,
  }));
}
