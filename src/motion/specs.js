/**
 * Component specifications - plain data, no React.
 *
 * An accent default of `""` means "inherit the project theme". That is the
 * important case: an agent that copies defaults into `project.json` would
 * otherwise bake one theme's accent into every layer, and changing the theme
 * afterwards would restyle the backdrop while leaving forty components in
 * the old colour.
 *
 * Split out of `registry.ts` so three consumers can share one description:
 *
 *   - `registry.ts` pairs each spec with its React component;
 *   - the inspector generates its controls from the prop schema;
 *   - the MCP server reports it to an agent as the available vocabulary.
 *
 * The MCP server runs in plain Node and cannot import TSX, which is what
 * forces the split. It is a good split anyway: an agent asking "what can I
 * build with" should get the same answer the UI renders, from the same
 * object, rather than a hand-maintained list that quietly falls behind.
 *
 * `registry.test.ts` asserts every spec has a component and every component
 * has a spec, so the two halves cannot drift.
 *
 * @typedef {{ kind: "text", label: string, default: string, multiline?: boolean }} TextSpec
 * @typedef {{ kind: "number", label: string, default: number, min?: number, max?: number, step?: number }} NumberSpec
 * @typedef {{ kind: "color", label: string, default: string }} ColorSpec
 * @typedef {{ kind: "select", label: string, default: string, options: { value: string, label: string }[] }} SelectSpec
 * @typedef {TextSpec | NumberSpec | ColorSpec | SelectSpec} PropSpec
 */

export const COMPONENT_SPECS = {
  HeroTitle: {
    label: "Hero title",
    description: "Eyebrow, display line and caption on a staggered reveal.",
    props: {
      eyebrow: { kind: "text", label: "Eyebrow", default: "" },
      text: { kind: "text", label: "Title", default: "Introducing Raw Motion" },
      caption: { kind: "text", label: "Caption", default: "", multiline: true },
      accent: { kind: "color", label: "Accent", default: "" },
      size: { kind: "number", label: "Size", default: 112, min: 24, max: 400, step: 2 },
      align: {
        kind: "select",
        label: "Align",
        default: "center",
        options: [
          { value: "center", label: "Center" },
          { value: "left", label: "Left" },
        ],
      },
    },
  },

  ProductCard: {
    label: "Product card",
    description: "Floating glass card with a slow 3D sway and specular edge.",
    props: {
      title: { kind: "text", label: "Title", default: "Raw Motion" },
      caption: { kind: "text", label: "Caption", default: "AI-native motion design" },
      badge: { kind: "text", label: "Badge", default: "v1.0" },
      accent: { kind: "color", label: "Accent", default: "" },
      width: { kind: "number", label: "Width", default: 720, min: 120, max: 3840, step: 10 },
      height: { kind: "number", label: "Height", default: 440, min: 120, max: 2160, step: 10 },
      sway: { kind: "number", label: "Sway", default: 2.5, min: 0, max: 12, step: 0.5 },
    },
  },

  FeatureList: {
    label: "Feature list",
    description: "Staggered bullet lines. One feature per line.",
    props: {
      items: {
        kind: "text",
        label: "Items",
        default: "Code-first compositions\nLive preview\nFrame-accurate export",
        multiline: true,
      },
      accent: { kind: "color", label: "Accent", default: "" },
      fontSize: { kind: "number", label: "Size", default: 34, min: 12, max: 160, step: 1 },
    },
  },

  LogoLockup: {
    label: "Logo lockup",
    description: "Drawn mark beside a wordmark. Built for outros.",
    props: {
      wordmark: { kind: "text", label: "Wordmark", default: "Raw Motion" },
      accent: { kind: "color", label: "Accent", default: "" },
      size: { kind: "number", label: "Size", default: 96, min: 24, max: 400, step: 4 },
    },
  },

  GlassCard: {
    label: "Glass card",
    description:
      "Apple-style frosted glass card: translucent white pane, large continuous radius, specular sweep tied to its sway. Use on the `glass` theme.",
    props: {
      eyebrow: { kind: "text", label: "Eyebrow", default: "" },
      title: { kind: "text", label: "Title", default: "Raw Motion" },
      caption: { kind: "text", label: "Caption", default: "Motion design, natively" },
      accent: { kind: "color", label: "Accent", default: "" },
      width: { kind: "number", label: "Width", default: 720, min: 200, max: 3200, step: 10 },
      height: { kind: "number", label: "Height", default: 420, min: 160, max: 2000, step: 10 },
      sway: { kind: "number", label: "Sway", default: 1.8, min: 0, max: 10, step: 0.2 },
      radius: { kind: "number", label: "Radius", default: 42, min: 0, max: 160, step: 2 },
    },
  },

  GlassBar: {
    label: "Glass bar",
    description:
      "Floating frosted toolbar with a selection pill that slides to the active item. Pipe-separated labels.",
    props: {
      items: { kind: "text", label: "Items", default: "Overview | Library | Settings" },
      active: { kind: "number", label: "Active", default: 1, min: 1, max: 8, step: 1 },
      accent: { kind: "color", label: "Accent", default: "" },
      fontSize: { kind: "number", label: "Font size", default: 26, min: 10, max: 90, step: 1 },
      radius: { kind: "number", label: "Radius", default: 999, min: 0, max: 999, step: 1 },
    },
  },

  /* ---- explainer vocabulary ---- */

  Chapter: {
    label: "Chapter card",
    description: "Numbered section card with a masked title reveal. Gives a long explainer structure.",
    props: {
      number: { kind: "text", label: "Number", default: "01" },
      title: { kind: "text", label: "Title", default: "Architecture" },
      subtitle: { kind: "text", label: "Subtitle", default: "", multiline: true },
      accent: { kind: "color", label: "Accent", default: "" },
      size: { kind: "number", label: "Size", default: 96, min: 24, max: 320, step: 4 },
    },
  },

  CodeBlock: {
    label: "Code block",
    description:
      "Syntax-highlighted code window. Lines arrive on a stagger; focusLines dims everything else.",
    props: {
      filename: { kind: "text", label: "Filename", default: "src/motion/timing.ts" },
      code: { kind: "text", label: "Code", default: "export function progress() {}", multiline: true },
      language: {
        kind: "select",
        label: "Language",
        default: "auto",
        options: [
          { value: "auto", label: "From filename" },
          { value: "ts", label: "TypeScript" },
          { value: "tsx", label: "TSX" },
          { value: "js", label: "JavaScript" },
          { value: "json", label: "JSON" },
          { value: "bash", label: "Shell" },
          { value: "text", label: "Plain" },
        ],
      },
      focusLines: { kind: "text", label: "Focus lines", default: "" },
      focusAt: { kind: "number", label: "Focus at", default: 0, min: 0, max: 3000, step: 1 },
      fontSize: { kind: "number", label: "Font size", default: 22, min: 8, max: 80, step: 1 },
      lineStagger: { kind: "number", label: "Line stagger", default: 1.4, min: 0, max: 20, step: 0.2 },
      delay: { kind: "number", label: "Delay", default: 0, min: 0, max: 3000, step: 1 },
      width: { kind: "number", label: "Width", default: 900, min: 200, max: 3840, step: 10 },
      maxLines: { kind: "number", label: "Max lines", default: 0, min: 0, max: 200, step: 1 },
    },
  },

  Terminal: {
    label: "Terminal",
    description: "Types a command, then prints its output. Output timing derives from the command.",
    props: {
      title: { kind: "text", label: "Title", default: "zsh" },
      prompt: { kind: "text", label: "Prompt", default: "$" },
      command: { kind: "text", label: "Command", default: "npm run render" },
      output: { kind: "text", label: "Output", default: "", multiline: true },
      typeSpeed: { kind: "number", label: "Chars/sec", default: 30, min: 2, max: 120, step: 1 },
      fontSize: { kind: "number", label: "Font size", default: 22, min: 8, max: 80, step: 1 },
      width: { kind: "number", label: "Width", default: 860, min: 200, max: 3840, step: 10 },
      delay: { kind: "number", label: "Delay", default: 0, min: 0, max: 3000, step: 1 },
    },
  },

  FileTree: {
    label: "File tree",
    description:
      "Indented tree. Two spaces per level, trailing / for a directory, trailing * to highlight.",
    props: {
      title: { kind: "text", label: "Title", default: "" },
      tree: {
        kind: "text",
        label: "Tree",
        default: "src/\n  motion/\n    timing.ts *\n  shared/\n    project.js",
        multiline: true,
      },
      accent: { kind: "color", label: "Accent", default: "" },
      fontSize: { kind: "number", label: "Font size", default: 24, min: 8, max: 80, step: 1 },
      stagger: { kind: "number", label: "Stagger", default: 2.5, min: 0, max: 20, step: 0.5 },
      delay: { kind: "number", label: "Delay", default: 0, min: 0, max: 3000, step: 1 },
      width: { kind: "number", label: "Width", default: 520, min: 160, max: 2000, step: 10 },
    },
  },

  DiagramFlow: {
    label: "Flow diagram",
    description:
      "Chain of frosted nodes traced in reading order; a light pulse then travels the connectors. Prefix a line with > to emphasise it.",
    props: {
      nodes: {
        kind: "text",
        label: "Nodes",
        default: "Prompt\nProject model\nComposition\n> MP4",
        multiline: true,
      },
      direction: {
        kind: "select",
        label: "Direction",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      shape: {
        kind: "select",
        label: "Shape",
        default: "rounded",
        options: [
          { value: "rounded", label: "Rounded" },
          { value: "pill", label: "Pill" },
          { value: "square", label: "Square" },
        ],
      },
      tone: {
        kind: "select",
        label: "Tone",
        default: "frosted",
        options: [
          { value: "frosted", label: "Frosted" },
          { value: "filled", label: "Filled" },
          { value: "outline", label: "Outline" },
        ],
      },
      connector: {
        kind: "select",
        label: "Connector",
        default: "line",
        options: [
          { value: "line", label: "Line" },
          { value: "arrow", label: "Arrow" },
          { value: "dotted", label: "Dotted" },
        ],
      },
      accent: { kind: "color", label: "Accent", default: "" },
      fontSize: { kind: "number", label: "Font size", default: 26, min: 8, max: 90, step: 1 },
      nodeWidth: { kind: "number", label: "Node width", default: 340, min: 80, max: 1600, step: 10 },
      gap: { kind: "number", label: "Gap", default: 40, min: 4, max: 300, step: 2 },
      beat: { kind: "number", label: "Beat", default: 12, min: 4, max: 40, step: 1 },
      pulse: { kind: "select", label: "Pulse", default: "on", options: [
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ] },
      delay: { kind: "number", label: "Delay", default: 0, min: 0, max: 3000, step: 1 },
    },
  },

  Callout: {
    label: "Callout",
    description: "Labelled note on a frosted pane with an accent chip. For the one sentence that must not be missed.",
    props: {
      label: { kind: "text", label: "Label", default: "NOTE" },
      text: { kind: "text", label: "Text", default: "", multiline: true },
      accent: { kind: "color", label: "Accent", default: "" },
      fontSize: { kind: "number", label: "Font size", default: 26, min: 8, max: 90, step: 1 },
      width: { kind: "number", label: "Width", default: 720, min: 160, max: 2400, step: 10 },
    },
  },

  BrowserFrame: {
    label: "Browser frame",
    description: "Window chrome around a screenshot. Product footage in a frame reads as an application.",
    props: {
      url: { kind: "text", label: "URL", default: "rawmotion.app" },
      src: { kind: "image", label: "Image", default: "" },
      width: { kind: "number", label: "Width", default: 1080, min: 200, max: 3840, step: 10 },
      height: { kind: "number", label: "Height", default: 660, min: 200, max: 2160, step: 10 },
      sway: { kind: "number", label: "Sway", default: 1.6, min: 0, max: 10, step: 0.2 },
    },
  },

  StatGrid: {
    label: "Stat grid",
    description:
      "Headline figures that count up to their value, each over a short accent rule. One per line as `value | label`. Spans the full width of its layout cell, so give it a wide one - `middleBand` or `center`, not a split.",
    props: {
      stats: {
        kind: "text",
        label: "Stats",
        default: "161 | tests passing\n644 | frames rendered\n0 | duration limits",
        multiline: true,
      },
      accent: { kind: "color", label: "Accent", default: "" },
      size: { kind: "number", label: "Size", default: 72, min: 16, max: 260, step: 2 },
      columns: { kind: "number", label: "Columns", default: 3, min: 1, max: 6, step: 1 },
      countUp: { kind: "select", label: "Count up", default: "on", options: [
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ] },
      tile: { kind: "select", label: "Tiles", default: "off", options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ] },
    },
  },

  Caption: {
    label: "Caption",
    description: "Subtitle plate. Sits on a slab so contrast holds over a moving background.",
    props: {
      text: { kind: "text", label: "Text", default: "", multiline: true },
      fontSize: { kind: "number", label: "Font size", default: 30, min: 10, max: 90, step: 1 },
      maxWidth: { kind: "number", label: "Max width", default: 1200, min: 200, max: 3840, step: 20 },
    },
  },
};

/**
 * Background kinds addressable from a `background` layer's `props.kind`.
 * Mirrors BACKGROUND_REGISTRY in backgrounds.tsx; guarded by a test.
 */
export const BACKGROUND_KINDS = [
  { value: "studio", label: "Studio - mesh gradient, dot grid, spotlight, vignette, grain. The default; inherits the project theme." },
  { value: "mesh", label: "Mesh gradient - soft colour poles bleeding into one another" },
  { value: "dotGrid", label: "Dot grid - the technical-product surface cue" },
  { value: "gridLines", label: "Ruled grid - structural where dotGrid is textural" },
  { value: "spotlight", label: "Spotlight - a wide light source above frame" },
  { value: "auroraBands", label: "Aurora bands - flowing ribbons of light" },
  { value: "beams", label: "Light beams - hard-edged shafts, high energy" },
  { value: "waves", label: "Waves - stacked flowing water surfaces, organic pieces" },
  { value: "bokeh", label: "Bokeh - out-of-focus light discs, shallow depth-of-field cue" },
  { value: "depth", label: "Depth - the older particle-based composite" },
  { value: "cinematicGradient", label: "Cinematic gradient" },
  { value: "atmosphere", label: "Atmosphere - drifting pools of light" },
  { value: "particleField", label: "Particle field" },
  { value: "lightField", label: "Light shafts" },
  { value: "noise", label: "Film grain" },
  { value: "glow", label: "Single soft light source" },
  { value: "vignette", label: "Corner darkening" },
];

/**
 * Entrance and exit presets. Mirrors the table in presets.ts; guarded by a test.
 */
export const PRESET_NAMES = [
  { value: "fade", label: "Fade", group: "Basic" },
  { value: "riseFade", label: "Rise", group: "Basic" },
  { value: "dropFade", label: "Drop", group: "Basic" },
  { value: "slideLeft", label: "Slide from right", group: "Basic" },
  { value: "slideRight", label: "Slide from left", group: "Basic" },
  { value: "scaleIn", label: "Scale in", group: "Emphasis" },
  { value: "scaleOut", label: "Scale out", group: "Emphasis" },
  { value: "blurIn", label: "Blur in", group: "Emphasis" },
  { value: "depthIn", label: "Depth - back, blurred, resolving forward", group: "Cinematic" },
  { value: "driftIn", label: "Drift - slow lateral settle", group: "Cinematic" },
  { value: "tiltIn", label: "Tilt - slight rotation on arrival", group: "Cinematic" },
  { value: "popIn", label: "Pop - overshoot scale, for badges and stats", group: "Energy" },
  { value: "whipLeft", label: "Whip from right - motion-blurred snap", group: "Energy" },
  { value: "whipRight", label: "Whip from left - motion-blurred snap", group: "Energy" },
  { value: "zoomBlur", label: "Crash zoom - resolves out of blur", group: "Energy" },
  { value: "glitchIn", label: "Glitch - deterministic jitter that settles", group: "Energy" },
  { value: "floatIn", label: "Float - rises, then keeps a gentle bob", group: "Organic" },
  { value: "waveIn", label: "Wave - water-like sway on arrival", group: "Organic" },
  { value: "swingIn", label: "Swing - decaying pendulum entrance", group: "Organic" },
  { value: "orbitIn", label: "Orbit - arcs in along a curve", group: "Organic" },
  { value: "flipIn", label: "Flip - card settling flat", group: "Organic" },
];
