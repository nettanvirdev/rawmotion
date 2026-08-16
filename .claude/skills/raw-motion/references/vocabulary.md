# Vocabulary

Generated from the engine. `describe_capabilities` returns the same data live
and is authoritative if these ever disagree.

## Themes

Set with `set_theme` or `create_project`. Components inherit accent, text and
panel colours - do not hand-colour them.

| id | look |
| --- | --- |
| `midnight` | Deep indigo with a violet mesh and a soft top spotlight. The default technical-SaaS look - Linear and Vercel territory. |
| `graphite` | Near-neutral charcoal with a faint blue cast and a fine grid. Restrained and editorial - lets code and type carry the frame. |
| `aurora` | Teal and green flowing bands over deep navy. Fresh and energetic - developer tooling and infrastructure. |
| `ember` | Warm amber and rose on near-black. Premium and cinematic - launches, brand films, anything that should feel expensive. |
| `ultraviolet` | Magenta and violet with strong beams. High-energy - AI products, launches, anything that wants to feel loud. |
| `arctic` | Ice blue on slate with a crisp dot grid. Clean and clinical - data, dashboards, analytics. |
| `glass` | Apple-style light glass. Near-white ground with soft colour bleed, frosted squircle panels, near-black type. For consumer product films and anything that should feel like hardware. |
| `paper` | Light. Warm off-white with a soft grey mesh and near-black type. For documentation and anything that has to read as printed. |

## Layout presets

Position layers with `layout`, never `transform.x/y`. 12 columns x 8 rows.

- `center`
- `centerUpper`
- `centerLower`
- `splitLeft`
- `splitRight`
- `splitLeftWide`
- `splitRightNarrow`
- `topBand`
- `middleBand`
- `bottomBand`
- `topLeft`
- `bottomLeft`
- `bottomRight`
- `caption`

## Components

### HeroTitle

Eyebrow, display line and caption on a staggered reveal.

| prop | type | default |
| --- | --- | --- |
| `eyebrow` | text | `""` |
| `text` | text | `"Introducing Raw Motion"` |
| `caption` | text | `""` |
| `accent` | color | `inherits theme` |
| `size` | number (24-400) | `112` |
| `align` | select (center or left) | `"center"` |

### ProductCard

Floating glass card with a slow 3D sway and specular edge.

| prop | type | default |
| --- | --- | --- |
| `title` | text | `"Raw Motion"` |
| `caption` | text | `"AI-native motion design"` |
| `badge` | text | `"v1.0"` |
| `accent` | color | `inherits theme` |
| `width` | number (120-3840) | `720` |
| `height` | number (120-2160) | `440` |
| `sway` | number (0-12) | `2.5` |

### FeatureList

Staggered bullet lines. One feature per line.

| prop | type | default |
| --- | --- | --- |
| `items` | text | `"Code-first compositions\nLive preview\nFrame-accurat…"` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (12-160) | `34` |

### LogoLockup

Drawn mark beside a wordmark. Built for outros.

| prop | type | default |
| --- | --- | --- |
| `wordmark` | text | `"Raw Motion"` |
| `accent` | color | `inherits theme` |
| `size` | number (24-400) | `96` |

### GlassCard

Apple-style frosted glass card: translucent white pane, large continuous radius, specular sweep tied to its sway. Use on the `glass` theme.

| prop | type | default |
| --- | --- | --- |
| `eyebrow` | text | `""` |
| `title` | text | `"Raw Motion"` |
| `caption` | text | `"Motion design, natively"` |
| `accent` | color | `inherits theme` |
| `width` | number (200-3200) | `720` |
| `height` | number (160-2000) | `420` |
| `sway` | number (0-10) | `1.8` |
| `radius` | number (0-160) | `42` |

### GlassBar

Floating frosted toolbar with a selection pill that slides to the active item. Pipe-separated labels.

| prop | type | default |
| --- | --- | --- |
| `items` | text | `"Overview | Library | Settings"` |
| `active` | number (1-8) | `1` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (10-90) | `26` |
| `radius` | number (0-999) | `999` |

### Chapter

Numbered section card with a masked title reveal. Gives a long explainer structure.

| prop | type | default |
| --- | --- | --- |
| `number` | text | `"01"` |
| `title` | text | `"Architecture"` |
| `subtitle` | text | `""` |
| `accent` | color | `inherits theme` |
| `size` | number (24-320) | `96` |

### CodeBlock

Syntax-highlighted code window. Lines arrive on a stagger; focusLines dims everything else.

| prop | type | default |
| --- | --- | --- |
| `filename` | text | `"src/motion/timing.ts"` |
| `code` | text | `"export function progress() {}"` |
| `language` | select (auto or ts or tsx or js or json or bash or text) | `"auto"` |
| `focusLines` | text | `""` |
| `focusAt` | number (0-3000) | `0` |
| `fontSize` | number (8-80) | `22` |
| `lineStagger` | number (0-20) | `1.4` |
| `delay` | number (0-3000) | `0` |
| `width` | number (200-3840) | `900` |
| `maxLines` | number (0-200) | `0` |

### Terminal

Types a command, then prints its output. Output timing derives from the command.

| prop | type | default |
| --- | --- | --- |
| `title` | text | `"zsh"` |
| `prompt` | text | `"$"` |
| `command` | text | `"npm run render"` |
| `output` | text | `""` |
| `typeSpeed` | number (2-120) | `30` |
| `fontSize` | number (8-80) | `22` |
| `width` | number (200-3840) | `860` |
| `delay` | number (0-3000) | `0` |

### FileTree

Indented tree. Two spaces per level, trailing / for a directory, trailing * to highlight.

| prop | type | default |
| --- | --- | --- |
| `title` | text | `""` |
| `tree` | text | `"src/\n  motion/\n    timing.ts *\n  shared/\n    pro…"` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (8-80) | `24` |
| `stagger` | number (0-20) | `2.5` |
| `delay` | number (0-3000) | `0` |
| `width` | number (160-2000) | `520` |

### DiagramFlow

Chain of frosted nodes traced in reading order; a light pulse then travels the connectors. Prefix a line with > to emphasise it.

| prop | type | default |
| --- | --- | --- |
| `nodes` | text | `"Prompt\nProject model\nComposition\n> MP4"` |
| `direction` | select (vertical or horizontal) | `"vertical"` |
| `shape` | select (rounded, pill or square) | `"rounded"` |
| `tone` | select (frosted, filled or outline) | `"frosted"` |
| `connector` | select (line, arrow or dotted) | `"line"` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (8-90) | `26` |
| `nodeWidth` | number (80-1600) | `340` |
| `gap` | number (4-300) | `40` |
| `beat` | number (4-40) | `12` |
| `pulse` | select (on or off) | `"on"` |
| `delay` | number (0-3000) | `0` |

### Callout

Labelled note on a frosted pane with an accent chip. For the one sentence that must not be missed.

| prop | type | default |
| --- | --- | --- |
| `label` | text | `"NOTE"` |
| `text` | text | `""` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (8-90) | `26` |
| `width` | number (160-2400) | `720` |

### BrowserFrame

Window chrome around a screenshot. Product footage in a frame reads as an application.

| prop | type | default |
| --- | --- | --- |
| `url` | text | `"rawmotion.app"` |
| `src` | text | `""` |
| `width` | number (200-3840) | `1080` |
| `height` | number (200-2160) | `660` |
| `sway` | number (0-10) | `1.6` |

### StatGrid

Headline figures that count up to their value, each over a short accent rule. One per line as `value | label`. Spans the full width of its layout cell, so give it a wide one - `middleBand` or `center`, not a split.

| prop | type | default |
| --- | --- | --- |
| `stats` | text | `"161 | tests passing\n644 | frames rendered\n0 | dura…"` |
| `accent` | color | `inherits theme` |
| `size` | number (16-260) | `72` |
| `columns` | number (1-6) | `3` |
| `countUp` | select (on or off) | `"on"` |
| `tile` | select (off or on) | `"off"` |

### Caption

Subtitle plate. Sits on a slab so contrast holds over a moving background.

| prop | type | default |
| --- | --- | --- |
| `text` | text | `""` |
| `fontSize` | number (10-90) | `30` |
| `maxWidth` | number (200-3840) | `1200` |

## Fonts

Text layers take a `fontFamily` prop naming a Google Fonts family from the
catalogue below (empty = system stack). Fonts load at preview/render time —
nothing needs installing on the machine. `describe_capabilities` returns the
same list under `fonts`.

- **Sans**: Inter, Roboto, Open Sans, Poppins, Montserrat, Lato, Manrope, DM Sans, Space Grotesk, Sora, Outfit, Plus Jakarta Sans
- **Serif**: Playfair Display, Lora, Merriweather, EB Garamond, Fraunces
- **Display**: Bebas Neue, Oswald, Anton, Righteous, Archivo Black
- **Mono**: JetBrains Mono, Fira Code, IBM Plex Mono, Space Mono
- **Script**: Caveat, Pacifico, Dancing Script, Permanent Marker

Pairing rule: one display or serif face for headlines plus the system stack
for support text is almost always enough. More than two families in one film
reads as a ransom note.

## Background kinds

A `background` layer takes `props.kind`. Leave other props empty to inherit
the theme.

- `studio` — Studio - mesh gradient, dot grid, spotlight, vignette, grain. The default; inherits the project theme.
- `mesh` — Mesh gradient - soft colour poles bleeding into one another
- `dotGrid` — Dot grid - the technical-product surface cue
- `gridLines` — Ruled grid - structural where dotGrid is textural
- `spotlight` — Spotlight - a wide light source above frame
- `auroraBands` — Aurora bands - flowing ribbons of light
- `beams` — Light beams - hard-edged shafts, high energy
- `waves` — Waves - stacked flowing water surfaces, for organic/lifestyle pieces
- `bokeh` — Bokeh - out-of-focus light discs, the shallow depth-of-field cue
- `depth` — Depth - the older particle-based composite
- `cinematicGradient` — Cinematic gradient
- `atmosphere` — Atmosphere - drifting pools of light
- `particleField` — Particle field
- `lightField` — Light shafts
- `noise` — Film grain
- `glow` — Single soft light source
- `vignette` — Corner darkening

## Animation presets

- `fade` — Fade *(Basic)*
- `riseFade` — Rise *(Basic)*
- `dropFade` — Drop *(Basic)*
- `slideLeft` — Slide from right *(Basic)*
- `slideRight` — Slide from left *(Basic)*
- `scaleIn` — Scale in *(Emphasis)*
- `scaleOut` — Scale out *(Emphasis)*
- `blurIn` — Blur in *(Emphasis)*
- `depthIn` — Depth - back, blurred, resolving forward *(Cinematic)*
- `driftIn` — Drift - slow lateral settle *(Cinematic)*
- `tiltIn` — Tilt - slight rotation on arrival *(Cinematic)*
- `popIn` — Pop - overshoot scale; badges, stats, beat hits *(Energy)*
- `whipLeft` — Whip from right - motion-blurred snap *(Energy)*
- `whipRight` — Whip from left - motion-blurred snap *(Energy)*
- `zoomBlur` — Crash zoom - resolves out of blur; also the "morph" crossfade tool *(Energy)*
- `glitchIn` — Glitch - deterministic jitter that settles *(Energy)*
- `floatIn` — Float - rises, then keeps a gentle bob; the Apple hero-shot look *(Organic)*
- `waveIn` — Wave - water-like sway on arrival *(Organic)*
- `swingIn` — Swing - decaying pendulum entrance *(Organic)*
- `orbitIn` — Orbit - arcs in along a curve *(Organic)*
- `flipIn` — Flip - card settling flat *(Organic)*

## Composite layers (custom components)

Layer type `composite` renders a component you design yourself as
`props.nodes` - a JSON tree of primitives, styled with theme tokens so it
belongs to the film's design language:

- Node types: `column`, `row`, `box` (containers), `text`, `circle`,
  `spacer`, `svg` (raw markup), `path` ({d, viewBox, stroke, strokeWidth,
  fill}; `enter.preset: "draw"` traces the stroke), `image` (project asset).
- Container props: `children`, `gap`, `pad`, `align`, `justify`, `stagger`.
- Surface props: `fill`, `radius`, `stroke`, `strokeWidth`, `glass`, `glow`,
  `opacity`, `width`, `height`, `grow`.
- Text props: `text`, `size`, `weight`, `color`, `letterSpacing`, `mono`,
  `fontFamily`.
- Motion: `enter { preset: fade|rise|pop|scale|blur|draw|none, delay?,
  duration? }`; children stagger automatically (`props.stagger` frames).
- Colour tokens: `accent`, `accentSoft`, `text`, `textDim`, `panel`,
  `surface`, `none`. Prefer tokens over raw CSS colours - the component then
  restyles with the theme like every built-in.

Composites are ordinary layers - timing, layout, transform, entrance/exit
and `morphId` all work - so the editor can select and edit them. Reach for
one whenever no registered component fits: pricing cards, charts, UI
mockups, badges, illustrations.

## Custom components (project TSX modules)

Beyond composites, every project can carry real React/TSX components in its
`components/` directory. They are first-class: compiled on save, hot-reload
the preview, render identically in the final MP4, and their manifest gives
the user full inspector controls over what you built.

Authoring (MCP: `write_component`, or write the file directly - the app
watches the directory):

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { EASINGS, progress, staggerDelay, useTheme } from "rawmotion";

export const manifest = {
  name: "GlassPricingCard",
  label: "Glass pricing card",
  description: "Editable pricing card with entrance animation.",
  category: "Cards",
  version: 1,
  props: {
    title: { type: "text", label: "Title", default: "Pro" },
    accent: { type: "color", label: "Accent", default: "" },
    radius: { type: "number", label: "Radius", default: 32, min: 0, max: 160 },
    featured: { type: "toggle", label: "Featured", default: true },
    tone: { type: "select", options: ["soft", "loud"], default: "soft" },
  },
};

const GlassPricingCard: React.FC<{...}> = (props) => { ... };
export default GlassPricingCard;
```

Rules and surface:

- Imports allowed: `react`, `remotion`, `rawmotion`, and sibling files in
  `components/` (nesting/composition works; esbuild bundles them).
- `rawmotion` exports: `EASINGS`, `progress`, `springProgress`, `mix`,
  `staggerDelay`, `oscillate`, `seededRandom`, `blurFilter`, `useTheme`,
  `useGrid`, `themed`, `MaskedLines`, `WordReveal`, `Counter`, `TypeOn`,
  `DrawLine`, `useAssetUrl`, `resolveFontStack`, layout helpers, and every
  built-in component (`GlassCard`, `DiagramFlow`, ...).
- Inline styles only; everything a deterministic function of the frame
  (no `Date.now`, no unseeded random). Default accent `""` = theme accent.
- Prop types: `text`/`multiline`, `number` (min/max/step), `color`,
  `select` (options), `image` (asset picker), `toggle`.
- Use it via a `component` layer: `props.component = "GlassPricingCard"`,
  `props.props = {...}`. Built-in names win over custom ones.
- `write_component` compiles in the same call - fix returned errors before
  rendering. `list_components` shows what exists; extend rather than
  duplicate.

Prefer a custom component over a composite when the design needs logic,
loops over data, or reuse across scenes with different props.

## Morph transitions (continuity cuts)

`transition.type: "morph"` is the signature move of high-end product films:
the scene change reads as one composition re-arranging itself, not a cut.

- Matched layers glide and transform across the boundary. Match explicitly
  with `morphId` (works across types - a shape can become a card, a card a
  diagram), or automatically by identical type + name.
- Two single-line text layers morph per character: shared letters travel to
  their new positions, removed letters defocus away, new letters resolve out
  of blur left to right.
- Same-type layers whose props differ only numerically interpolate those
  props mid-glide (a GlassBar's active pill slides, a bar re-scores).
- Everything else gets a container transform: one continuous surface glides
  while the old content defocuses into the new.
- Unmatched layers fade with their own entrances/exits; backgrounds
  crossfade, so give consecutive scenes the same background and the ground
  never moves.
- Use overlaps of 14-24 frames; camera `none` or `push` on the incoming
  scene. Chain several morph boundaries to make a whole film feel like one
  continuous shot.

## Scene transitions

`scene.transition.type`, overlapping this scene with the next:

- `none` — hard cut
- `morph` — continuity glide; matched layers travel and transform (see above)
- `fade` — cross dissolve; the default between related scenes
- `blur` — blur dissolve; a change of subject
- `slide` — incoming scene rises in
- `wipe` — hard edge travels across frame
- `zoom` — incoming scene settles down from 114%; the product-film cut
- `push` — incoming scene pushes in laterally; narrative "meanwhile"
- `circle` — iris reveal from centre; the big reveal
- `spin` — slight rotational settle; high energy only
- `glitch` — jittered arrival; tech/hype pieces only
