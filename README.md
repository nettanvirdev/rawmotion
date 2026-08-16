# Raw Motion

An AI-native motion-design and video-production environment. Motion graphics
live as real code, preview live in the app, and render frame-accurate to MP4 -
editable by hand or by Claude, against the same project.

Electron 43 + React 19 + Vite 8 + Tailwind 4 + Remotion 4.

> **Status: first vertical slice, working end to end.** Create a project,
> build a composition from scenes and layers, preview it live, edit it in the
> timeline and inspector, and export an MP4 through a non-blocking render
> queue. Read [docs/architecture.md](docs/architecture.md) for the design and
> for an explicit list of what is *not* built yet.

## The idea

The composition is not trapped in an opaque timeline format. A project is a
directory with a readable `project.json` and real source files:

```
Aurora Launch.rawmotion/
  project.json        the model - the single source of truth
  assets/             images, video, audio, fonts, generated
  components/         custom motion components
  renders/            export output
  cache/              derived data, safe to delete
```

One React component renders that model. The editor mounts it in
`@remotion/player`; the exporter mounts the same file in
`@remotion/renderer`. There is no second implementation, so the preview
cannot drift from the output.

Because the model is a watched file, the agent loop is real: Claude edits
`project.json`, the main process notices, and the preview updates. Anything
the user changes in the UI is written back to the same file.

**Duration is derived, never configured.** A project has no length field -
it is the sum of its scenes minus their transition overlaps. A 10-second
teaser and a 30-minute film use the same architecture.

## Driving it from a harness

Raw Motion's primary interface is an **MCP server**. The app is a window onto
a project; the server is how a project gets made.

```bash
npm run mcp          # stdio MCP, 23 tools
```

```jsonc
// .mcp.json - already present in this repo
{ "mcpServers": { "rawmotion": { "command": "node", "args": ["src/mcp/server.js"] } } }
```

An agent calls `describe_capabilities` to learn the vocabulary, `build_scenes`
to commit a whole storyboard atomically, **`render_frame` and
`render_contact_sheet` to actually look at what it made**, and `render_video`
to export.

That looking step is the design decision the whole server is built around. An
agent that cannot see its own output composes from arithmetic - it can check
that a layer's `y` is 250, but not that 250 puts the caption through the
middle of the product card. Both tools return real PNGs through MCP's image
content type, cheaply enough to afford after every change.

Every mutation writes `project.json` immediately. If the desktop app has the
project open, its watcher reloads and the preview updates - so a user can
watch a film being composed, and reach into the inspector mid-session. Both
sides are editing the same document.

Full tool reference: [docs/mcp.md](docs/mcp.md).

Two skills ship in `.claude/skills/` - `raw-motion` for video from a prompt,
`codebase-explainer` for turning real source into a motion explainer. They
carry the craft rules, not just the API.

## Getting started

```bash
npm install
npm run dev
```

Vite serves the renderer on `:5173` and Electron attaches to it with HMR.
Projects live in `Documents/Raw Motion/`.

On first run, create a project from the **Aurora launch** template - a
five-scene product film that is entirely procedural, with no bundled assets.

## Scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Vite dev server + Electron, concurrently                         |
| `npm run mcp`       | stdio MCP server, for agent harnesses                            |
| `npm run build`     | Build the renderer into `dist/`                                  |
| `npm test`          | Run the Vitest suite once                                        |
| `npm run typecheck` | `tsc --noEmit`                                                   |
| `npm run logo`      | Rasterize `public/assets/logo.svg` into the PNG logos            |
| `npm run icons`     | Run `logo`, then regenerate `build/icon.ico` and the NSIS bitmaps |
| `npm run pack`      | Unpacked build, for smoke-testing packaging                      |
| `npm run release`   | Windows installer + portable exe into `release/`                 |

Release output:

- `Raw Motion-Setup-<version>.exe` - installer with a custom Additional Tasks page
- `Raw Motion-<version>-portable.exe` - no-install portable build

Rendering downloads a headless Chromium on first use. Set `RAWMOTION_CHROME`
to an existing binary in CI or restricted environments.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` `→` | Step one frame (`Shift` for one second) |
| `J` / `K` / `L` | Previous scene / pause / next scene |
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+Z` | Undo (`Shift` to redo) |
| `Cmd/Ctrl+S` | Save |
| `Cmd/Ctrl+D` | Duplicate selection |
| `Cmd/Ctrl+0` / `1` | Fit to window / actual pixels |
| `Cmd/Ctrl+B` | Toggle left panel |

Shortcuts and palette commands come from one declaration in `EditorShell`,
so they cannot disagree.

## Layout

```
src/
  shared/                Project model, IPC channels, templates.
                         Imported by BOTH processes - one contract.
  main/                  Electron main (ESM) + sandboxed preload (CJS)
    workspace.js         Path sandbox - the only place paths are resolved
    project-store.js     Atomic reads/writes, asset import
    project-watcher.js   Pushes external edits to the renderer
    render/queue.js      Serial, non-blocking MP4 queue
  motion/                The composition engine. Outside renderer/ because
                         the render bundle and the tests use it too.
    timing.ts            Easings, springs, stagger, deterministic random
    presets.ts           Entrance/exit presets
    text.tsx             Masked line reveals - the house typography move
    backgrounds.tsx      Procedural cinematic backgrounds
    components.tsx       HeroTitle, ProductCard, FeatureList, LogoLockup
    explainer.tsx        CodeBlock, Terminal, FileTree, DiagramFlow, Chapter
    highlight.ts         Synchronous syntax tokenizer
    specs.js             Component prop schemas - plain JS, read by MCP too
    RawMotionComposition.tsx   Renders a project. Preview AND export.
  mcp/                   The MCP server - 23 tools over the same sandbox
  remotion/              registerRoot entry for the render bundle
  renderer/
    editor/              Canvas, Timeline, Inspector, panels, palette
    state/               projectStore (undo), editorStore, renderStore, aiStore
    components/ui/       Design-system primitives
    styles/globals.css   Design tokens - the source of truth
.claude/skills/          raw-motion, codebase-explainer
docs/architecture.md     Read this before making structural changes
docs/mcp.md              The harness-facing tool reference
```

## Branding

`public/assets/logo.svg` is the single source for the app mark - a violet
squircle plate, a frosted-glass video frame, and a solid white play glyph.
Edit the SVG and run `npm run icons`; never hand-edit the PNGs, `.ico` or
BMPs, since they are all generated from it.

The `.ico` entries at 32px and below are cropped to the plate bounds so the
glyph survives at taskbar and title-bar sizes - see `CROP_AT_OR_BELOW` in
`scripts/generate-icons.mjs`.

## Design system

Everything visual is driven by `src/renderer/styles/globals.css`. Read that
file before adding UI - it is the spec, not just a stylesheet.

**Theming.** Class-based on `<html>`: `dark`, plus additive `oled` and
`high-contrast`. Light is the structural default; the app boots into dark via
an inline pre-paint guard in `index.html` (keep it there - moving it causes a
flash). State persists to `localStorage` under the `rawmotion.*` keys.

**The rules that carry the look:**

- One neutral ramp, authored in OKLCH so the steps are perceptually even. It
  includes a non-standard `850` step - that is the dark-mode surface, and
  `800`/`900` cannot cover for it.
- Two font weights, 400 and 500. No 600/700 anywhere in UI chrome.
- Chrome is 13px, body is 15px, controls are 14px.
- Surfaces _shift_ between themes (gray-50 → gray-850); the primary action
  _inverts_ (black-on-white → white-on-black). It is never a hue.
- **No borders.** No border, outline, rule, divider or hairline on any
  surface, in any state — including a `0 0 0 1px` spread shadow, which is a
  border in disguise. Separation comes from surface contrast, shadow and
  spacing. The one exception is the `focus-visible` ring, which stays because
  removing it makes the app unusable by keyboard.
- Because there are no borders, in-flow surfaces use `bg-surface-sunken`, not
  `bg-surface` — the latter is `#ffffff` in light mode, identical to the
  canvas, so a card using it would be invisible. `bg-surface` is for floating
  layers that also carry a shadow.
- Shadows are heavier than a bordered system needs, for the same reason.
  Verify **light** mode first; dark mode hides this failure entirely.
- Near-zero hue. Color appears only as status tints - 20% fill with 700/200
  text is the single status recipe.
- Nothing animates longer than 300ms. No bounce, no spring.
- There is no red button. Destructive intent is carried by a confirm dialog.
- Spinners and text for loading - never skeleton bars. Don't mix the two.

**Accessibility is a requirement here, not a nicety.** Every interactive
element gets a visible `focus-visible` ring, `prefers-reduced-motion` is
honored, and the muted palette (gray-400/500) fails contrast for body text -
use it only for genuinely secondary information. `high-contrast` raises it.

Utility naming maps to roles rather than raw colors: `bg-canvas`,
`bg-surface-sunken`, `text-ink-muted`, `bg-wash-ghost`, `bg-row-selected`,
`bg-action`/`text-action-fg`. Radii use the design vocabulary directly
(`rounded-sm` = 6px … `rounded-3xl` = 32px), and type sizes are named in px
(`text-13`, `text-15`).

> **If you add a size to the px type scale, add it to `FONT_SIZES` in
> [lib/utils.js](src/renderer/lib/utils.js) too.** `tailwind-merge` can't tell
> `text-14` from a color, so an unregistered size silently deletes whatever
> text color it's paired with — that shipped once as a white-on-white button
> and 16px sidebar chrome. `utils.test.js` guards the registered sizes.

**The editor is exempt, on purpose.** Section 11 of `globals.css` defines a
separate `.rm-editor` scope with absolute values that do not theme. A colour
grading surface has to be dark regardless of the room: the canvas should be
the only thing in the window emitting light, and a white panel beside a video
preview destroys the viewer's judgement of its exposure. That scope is also
the one place hairlines are allowed - between two dark panels a drop shadow
is invisible, so the no-borders rule cannot carry separation there. Its ramp
is warm-shifted by about 2% chroma; truly neutral greys read green next to a
saturated preview.

## Security

Context isolation on, `nodeIntegration` off, `sandbox: true`, a CSP on the
document, a single-instance lock, and a whitelisted `http(s)`-only external
link opener. The renderer reaches main only through the narrow `window.rawmotion`
surface in `src/main/preload.cjs`, and holds no filesystem access at all.

Every path from the renderer or from an agent is resolved by
`src/main/workspace.js`, which refuses traversal, absolute paths and denied
segments. It is the single choke point; nothing else joins a user-supplied
string onto a path. `workspace.test.js` tests it adversarially.

`component` layers resolve through a static allow-list rather than importing
source from the project directory. That is deliberate: evaluating code from a
project file would make opening a downloaded project equivalent to running it.

## License

CC0-1.0.
