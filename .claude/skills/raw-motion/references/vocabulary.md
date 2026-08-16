# Component vocabulary

Generated from src/motion/specs.js. `describe_capabilities` returns the same
data live from the engine and is authoritative if these ever disagree.

## HeroTitle

Eyebrow, display line and caption on a staggered reveal.

| prop | type | default |
| --- | --- | --- |
| `eyebrow` | text | `""` |
| `text` | text | `"Introducing Raw Motion"` |
| `caption` | text | `""` |
| `accent` | color | `"#8b9bff"` |
| `size` | number (24-400) | `112` |
| `align` | select (center or left) | `"center"` |

## ProductCard

Floating glass card with a slow 3D sway and specular edge.

| prop | type | default |
| --- | --- | --- |
| `title` | text | `"Raw Motion"` |
| `caption` | text | `"AI-native motion design"` |
| `badge` | text | `"v1.0"` |
| `accent` | color | `"#8b9bff"` |
| `width` | number (120-3840) | `720` |
| `height` | number (120-2160) | `440` |
| `sway` | number (0-12) | `2.5` |

## FeatureList

Staggered bullet lines. One feature per line.

| prop | type | default |
| --- | --- | --- |
| `items` | text | `"Code-first compositions\nLive preview\nFrame-accurate ex..."` |
| `accent` | color | `"#8b9bff"` |
| `fontSize` | number (12-160) | `34` |

## LogoLockup

Drawn mark beside a wordmark. Built for outros.

| prop | type | default |
| --- | --- | --- |
| `wordmark` | text | `"Raw Motion"` |
| `accent` | color | `"#8b9bff"` |
| `size` | number (24-400) | `96` |

## Chapter

Numbered section card with a masked title reveal. Gives a long explainer structure.

| prop | type | default |
| --- | --- | --- |
| `number` | text | `"01"` |
| `title` | text | `"Architecture"` |
| `subtitle` | text | `""` |
| `accent` | color | `"#8b9bff"` |
| `size` | number (24-320) | `96` |

## CodeBlock

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

## Terminal

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

## FileTree

Indented tree. Two spaces per level, trailing / for a directory, trailing * to highlight.

| prop | type | default |
| --- | --- | --- |
| `title` | text | `""` |
| `tree` | text | `"src/\n  motion/\n    timing.ts *\n  shared/\n    project..."` |
| `accent` | color | `"#8b9bff"` |
| `fontSize` | number (8-80) | `24` |
| `stagger` | number (0-20) | `2.5` |
| `delay` | number (0-3000) | `0` |
| `width` | number (160-2000) | `520` |

## DiagramFlow

Chain of boxes with connectors that draw in sequence. Prefix a line with > to emphasise it.

| prop | type | default |
| --- | --- | --- |
| `nodes` | text | `"Prompt\nProject model\nComposition\n> MP4"` |
| `direction` | select (vertical or horizontal) | `"vertical"` |
| `accent` | color | `"#8b9bff"` |
| `fontSize` | number (8-90) | `26` |
| `nodeWidth` | number (80-1600) | `340` |
| `gap` | number (4-300) | `40` |
| `delay` | number (0-3000) | `0` |

## Callout

Labelled note on an accent slab. For the one sentence that must not be missed.

| prop | type | default |
| --- | --- | --- |
| `label` | text | `"NOTE"` |
| `text` | text | `""` |
| `accent` | color | `"#8b9bff"` |
| `fontSize` | number (8-90) | `26` |
| `width` | number (160-2400) | `720` |

## BrowserFrame

Window chrome around a screenshot. Product footage in a frame reads as an application.

| prop | type | default |
| --- | --- | --- |
| `url` | text | `"rawmotion.app"` |
| `src` | text | `""` |
| `width` | number (200-3840) | `1080` |
| `height` | number (200-2160) | `660` |
| `sway` | number (0-10) | `1.6` |

## StatGrid

Headline figures. One per line as `value | label`.

| prop | type | default |
| --- | --- | --- |
| `stats` | text | `"161 | tests passing\n644 | frames rendered\n0 | duration..."` |
| `accent` | color | `"#8b9bff"` |
| `size` | number (16-260) | `72` |
| `columns` | number (1-6) | `3` |

## Caption

Subtitle plate. Sits on a slab so contrast holds over a moving background.

| prop | type | default |
| --- | --- | --- |
| `text` | text | `""` |
| `fontSize` | number (10-90) | `30` |
| `maxWidth` | number (200-3840) | `1200` |

## Background kinds

A `background` layer takes `props.kind` plus `hue`, `intensity`, `speed`.

- `depth` - Depth (composed: gradient, atmosphere, light, particles, vignette, grain)
- `cinematicGradient` - Cinematic gradient
- `atmosphere` - Atmosphere - drifting pools of light
- `particleField` - Particle field
- `lightField` - Light shafts
- `noise` - Film grain
- `glow` - Single soft light source
- `vignette` - Corner darkening

## Animation presets

Used as `enter.preset` / `exit.preset`.

- `fade` - Fade (Basic)
- `riseFade` - Rise (Basic)
- `dropFade` - Drop (Basic)
- `slideLeft` - Slide from right (Basic)
- `slideRight` - Slide from left (Basic)
- `scaleIn` - Scale in (Emphasis)
- `scaleOut` - Scale out (Emphasis)
- `blurIn` - Blur in (Emphasis)
- `depthIn` - Depth - back, blurred, resolving forward (Cinematic)
- `driftIn` - Drift - slow lateral settle (Cinematic)
- `tiltIn` - Tilt - slight rotation on arrival (Cinematic)
