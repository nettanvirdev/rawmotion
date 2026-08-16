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

Chain of boxes with connectors that draw in sequence. Prefix a line with > to emphasise it.

| prop | type | default |
| --- | --- | --- |
| `nodes` | text | `"Prompt\nProject model\nComposition\n> MP4"` |
| `direction` | select (vertical or horizontal) | `"vertical"` |
| `accent` | color | `inherits theme` |
| `fontSize` | number (8-90) | `26` |
| `nodeWidth` | number (80-1600) | `340` |
| `gap` | number (4-300) | `40` |
| `delay` | number (0-3000) | `0` |

### Callout

Labelled note on an accent slab. For the one sentence that must not be missed.

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

Headline figures. One per line as `value | label`.

| prop | type | default |
| --- | --- | --- |
| `stats` | text | `"161 | tests passing\n644 | frames rendered\n0 | dura…"` |
| `accent` | color | `inherits theme` |
| `size` | number (16-260) | `72` |
| `columns` | number (1-6) | `3` |

### Caption

Subtitle plate. Sits on a slab so contrast holds over a moving background.

| prop | type | default |
| --- | --- | --- |
| `text` | text | `""` |
| `fontSize` | number (10-90) | `30` |
| `maxWidth` | number (200-3840) | `1200` |

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
