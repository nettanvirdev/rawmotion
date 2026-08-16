# Raw Motion — architecture

This document is written for whoever works on Raw Motion next, human or
agent. It explains how the pieces fit together and, where a decision was
contested, why it went the way it did.

## The one-paragraph version

A Raw Motion project is a directory containing a `project.json` model plus
its media. A single React component, `RawMotionComposition`, renders that
model. The editor mounts it in `@remotion/player` for live preview; the
export pipeline mounts the same file in `@remotion/renderer` to write an MP4.
The Electron main process owns the filesystem, the render queue and a
sandbox that no path may escape. The renderer owns the UI and never touches
disk.

```
                      project.json  ◄──────── Claude (files / MCP)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      main process                    renderer
   (fs, watcher, queue)          (editor, stores)
              │                           │
              └──────────► IPC ◄──────────┘
                            │
                RawMotionComposition
                 ┌──────────┴──────────┐
                 ▼                     ▼
         @remotion/player      @remotion/renderer
            (preview)               (MP4)
```

## Process layout

| Process | Language | Entry | Owns |
| --- | --- | --- | --- |
| Main | ESM JavaScript | `src/main/main.js` | Filesystem, dialogs, watcher, render queue, window |
| Preload | CommonJS | `src/main/preload.cjs` | The context bridge, nothing else |
| Renderer | TypeScript + React | `src/renderer/main.jsx` | Editor UI and state |

**Main is ESM.** This is what lets it import `src/shared/*` directly, so the
project schema, the timeline maths and the IPC channel names are literally
the same modules the renderer uses. A duplicated schema between processes
is the failure mode this avoids.

**Preload is CommonJS and self-contained.** A preload running under
`sandbox: true` may only `require("electron")` — it cannot load local files
and cannot be ESM. So it repeats the channel names as literals.
`preload.contract.test.js` asserts the two copies agree; that test is the
only reason the duplication is acceptable.

## The project model

`src/shared/project.js` is pure data plus pure functions — no I/O, no React,
no Electron. It can be imported from any process and is fully unit-tested.

Two invariants hold the system together.

**Duration is derived, never stored.** There is no `duration` field on a
project. Total length is `sum(scene durations) − transition overlaps`,
computed by `sceneTimings`. This is what makes a 10-second teaser and a
30-minute film the same architecture: there is no maximum to raise.

**Frames are the unit.** Every time value is an integer frame count, never
seconds. Seconds are derived at the edges for display. Storing seconds would
make the model frame-rate dependent and reintroduce rounding drift on every
fps change.

A transition is an *overlap*, not additional time. A 15-frame cross dissolve
means the two scenes share 15 frames, so the project gets shorter. Any code
that needs to know where a scene begins must go through `sceneTimings`;
duplicating that arithmetic is how a timeline and a renderer drift apart by a
frame.

### Normalisation is tolerant on purpose

`normalizeProject` repairs rather than rejects. `project.json` is a file
humans and agents hand-edit, and refusing to open a document because one
layer lacks an `opacity` would make the format hostile. Unknown values become
defaults; structurally impossible states (no scenes, a zero-length scene) are
fixed. Only genuine corruption — unparseable JSON, a non-object root —
throws.

### Directory layout

```
Aurora Launch.rawmotion/
  project.json        the model — the single source of truth
  assets/             images, video, audio, fonts, generated
  components/         custom motion components (source files)
  renders/            export output
  cache/              derived data, safe to delete
```

The shape is what makes a project legible to an agent: Claude can list
`components/`, read `project.json`, and drop a file into `assets/` with
ordinary file tools, and the app picks all of it up.

## The composition engine

`src/motion/` is deliberately outside `src/renderer/`, because it is consumed
by three things: the editor, the webpack render bundle, and the tests.

| File | Role |
| --- | --- |
| `timing.ts` | The motion vocabulary — named easings, springs, stagger, deterministic randomness |
| `presets.ts` | Entrance/exit presets as pure functions returning a transform delta |
| `backgrounds.tsx` | Procedural cinematic backgrounds |
| `text.tsx` | Masked line reveals, word reveals, counters, type-on |
| `components.tsx` | Higher-level composed components (`HeroTitle`, `ProductCard`, …) |
| `explainer.tsx` | `CodeBlock`, `Terminal`, `FileTree`, `DiagramFlow`, `Chapter`, … |
| `highlight.ts` | Synchronous syntax tokenizer for on-screen code |
| `specs.js` | Component prop schemas as plain data — read by MCP too |
| `registry.ts` | Name → component, paired with the specs |
| `layers.tsx` | One renderer per layer type, plus the timing/transform wrapper |
| `RawMotionComposition.tsx` | The composition: scenes, transitions, camera, audio |

Three rules apply throughout:

1. **Inline styles only.** No Tailwind, no imported CSS. This is what lets
   the render bundle compile with no CSS pipeline, and it keeps compositions
   portable.
2. **Everything is a function of `frame`.** No `Date.now`, no unseeded
   `Math.random`. A composition must produce identical frames in preview and
   export, and on a re-render months later. `seededRandom` exists for this.
3. **Presets are additive.** A preset returns a delta applied *on top of* the
   layer's transform, so the inspector's position controls and an entrance
   animation coexist instead of overwriting each other.

### Alignment is a grid, not arithmetic

`src/motion/layout.ts`.

The original renderer made every layer an `AbsoluteFill` centred on its own
content, then nudged it with `transform.x`. Two layers given the same `x`
therefore had **different left edges**, offset by half the difference in
their widths. Nothing could sit on a shared line, because no shared line
existed — and no amount of tuning the numbers could produce one.

A layer now names a cell on a 12-column × 8-row grid inside a safe margin.
Its edge is a property of the grid rather than of its content, so a
40-character headline and a three-word label in column 1 line up exactly.
Named presets (`splitLeft`, `splitRight`, `caption`, `bottomLeft`, …) mean an
agent picks a composition instead of doing geometry.

Layers with no `layout` keep the old centred behaviour, so projects authored
before the grid render identically — which is why `hasLayout` distinguishes
absent from `{}`.

`layout.test.ts` pins the guarantee at four aspect ratios.

### Themes

`src/motion/themes.js` (plain JS, so the MCP server can read it) plus
`theme.tsx` for the context. A theme carries the backdrop, the accent and the
type colours; components read them from context rather than taking hard-coded
defaults, so one `set_theme` call restyles a whole film instead of an agent
editing forty layers and missing one.

Explicit props still win — a deliberately off-theme callout is possible.
`themed()` treats the empty string as absent, because both the inspector and
the MCP schema produce `""` for "not set" and `??` would render it as a
colour.

### Light grounds are not dark grounds inverted

The `glass` and `paper` themes needed three separate fixes that only appeared
on screen, and the shape of each is worth remembering:

- **Blend mode.** Dark grounds composite mesh poles with `screen`, so
  overlapping poles read as light adding up. Light grounds must composite
  *normally*: `multiply` averages every overlap toward mud, and a deliberate
  130-degree hue spread collapsed into one flat lavender tint.
- **Pole size.** Poles are sized as a fraction of the diagonal. Larger than
  the frame is correct on a dark ground, where they are ambient light; on a
  light ground it means every pole overlaps every other and the colour
  averages out. Light poles are smaller than the frame.
- **Chroma.** Light grounds need *more* chroma, not less. On a dark field the
  eye reads a faint tint as coloured light; on near-white the same tint reads
  as dirt.

The syntax palette is likewise not the dark one darkened - hue relationships
that read on a dark field fall apart on white, and the dark comment grey
becomes invisible. `codeColors()` picks per surface.

Three colour bugs are worth recording, because all three were invisible in
code and obvious on screen:

- The background layer's defaults hard-coded `hue: 250`, which silently
  overrode every theme. An `ember` project rendered violet. Defaults are now
  the `kind` alone.
- **HSL lightness is not perceptual.** The same `L` reads far brighter in
  amber than in blue, so one palette could not hold across hues. The
  backgrounds are authored in OKLCH.
- OKLCH fixes the *pole* colour, but poles are composited with `screen`,
  which works per-channel in sRGB — amber has high red *and* green, so it
  piles up far more luminance than violet at identical OKLCH lightness.
  `screenCompensation()` scales alpha down for the hues that screen brightest.

### Type rises out of a mask

The house rule for typography, and the thing that most separates designed
motion from generated motion: text is revealed by a clipping wrapper it
translates into, not by a fade.

A fade implies the words were always there and the camera just noticed them.
A masked reveal implies they arrived — there is an edge they came from, so
the eye reads a direction and a cause. It costs one `overflow: hidden`
wrapper per line. `MaskedLines` sizes that mask with a descender allowance
and cancels it with a negative margin, because a mask sized by `line-height`
alone shaves the tails off "g" and "y" — the kind of detail nobody can name
and everyone notices.

Syntax highlighting is a small hand-written tokenizer rather than Shiki,
because Shiki loads grammars asynchronously and a promise resolving
mid-render produces one unhighlighted frame in the middle of an otherwise
highlighted shot. Coarser tokens beat an inconsistent frame.

### Layers are Remotion Sequences

`LayerView` uses `<Sequence>` rather than an opacity gate. A layer outside
its window is not mounted at all, so an off-screen video decodes nothing and
an off-screen particle field costs nothing. This is what keeps a long
project tractable.

### Asset resolution

The composition runs in two environments that disagree about what a URL is,
and `src/motion/assets.tsx` hides the difference behind a context:

- **Preview** — the renderer has no filesystem access, so main converts each
  project-relative path to a `file://` URL over IPC (`useAssetUrls` collects
  them into a map).
- **Export** — the bundler is pointed at the project's `assets/` directory,
  so paths resolve through Remotion's `staticFile`.

Without this indirection every layer component would need to know which
environment it is in, and the composition would stop being one thing.

## State

Four separate stores (`src/renderer/state/`), deliberately not one:

| Store | Holds | Persisted | Undoable |
| --- | --- | --- | --- |
| `projectStore` | The document | Yes, to `project.json` | Yes |
| `editorStore` | Selection, playhead, zoom, panels | No | No |
| `renderStore` | Mirror of the main-process queue | No | No |
| `aiStore` | Operation log | No | No |

Mixing them would mean a playhead move dirties the document and a scrub lands
in the undo stack.

### Undo

History holds whole `Project` snapshots rather than inverse operations. The
operations in `operations.ts` share structure, so a snapshot costs a handful
of objects rather than a copy of the document — and a snapshot cannot get out
of step with its operation the way a hand-written inverse can.

Two mechanisms keep the stack meaningful:

- **Coalescing.** Edits sharing a `coalesceKey` within 700 ms replace the top
  entry instead of pushing, so one slider drag is one undo.
- **Transactions.** `transaction(label, fn)` collapses many edits into one
  entry. This is what will make an AI operation — which may add a scene, six
  layers and a soundtrack — undo as a single action.

### Editing is one-way through operations

Every edit is a pure `Project → Project` function in `operations.ts`. Nothing
mutates. The UI never holds form state: a control reads its value from the
project on every render, so a change from undo, from a timeline drag, or from
an agent editing the file on disk is reflected immediately without the
component knowing those paths exist.

## The live loop

```
Claude edits project.json
        ↓
fs.watch (project-watcher.js)
        ↓  debounce 120 ms, skip our own writes
IPC: project:changed-on-disk
        ↓
projectStore.adoptFromDisk
        ↓
preview updates
```

Two hazards are handled. **Echo**: every save the app makes fires the
watcher, so writes are fingerprinted and matching events ignored — otherwise
a save would bounce back and clobber whatever the user typed in the interim.
**Chatter**: editors write in several syscalls and the atomic
write-then-rename fires twice on some platforms, so a short debounce
collapses a burst.

Saves are atomic (write temp, rename). For a creative tool this is the
difference between "lost the last edit" and "lost the project".

## IPC

Every handler lives in `src/main/ipc.js`. Collected in one file on purpose:
the IPC surface *is* the renderer's privilege boundary, and a boundary spread
across a dozen modules is one nobody can audit.

- Handlers never throw across the bridge. Each resolves with
  `{ ok: true, value }` or `{ ok: false, error }`; `bridge.ts` unwraps and
  rethrows on the renderer side so callers can use ordinary try/catch.
- **No handler takes an absolute path.** Callers name a project by its
  directory name and pass project-relative paths.

### The sandbox

`src/main/workspace.js` is the single choke point. Nothing else in the app
joins a user-supplied string onto a path. `resolveInProject` refuses
traversal, absolute paths, and denied segments (`.git`, `node_modules`).

The threat is not a malicious user; it is a confused one, or an agent that
writes `../../.ssh/config` because a relative path looked plausible. See
`workspace.test.js` — it is written adversarially, including the
`Demo.rawmotion-evil` case that a naive `startsWith` check would let through.

## Rendering

`src/main/render/queue.js`. Three rules, each the reason the module exists
rather than a bare `renderMedia()` call at the IPC boundary:

1. **Never on the UI path.** `enqueue` returns a job id immediately;
   everything after is reported through progress events. The editor stays
   fully interactive during a render.
2. **One at a time.** Remotion already parallelises across every core;
   running two jobs concurrently makes both slower and can exhaust memory.
3. **Bundle once.** Webpack-bundling costs seconds and is identical for every
   job in a project, so it is cached per project directory.

Progress is throttled to whole percentage points — a long render would
otherwise flood the renderer with per-frame events.

`@remotion/renderer` downloads its own headless Chromium on first use. Set
`RAWMOTION_CHROME` to an existing binary for CI or restricted environments.

**Known limitation.** `getBundle` resolves the Remotion entry relative to
`import.meta.url`, which works from source but not from inside an `asar`
archive. Packaged builds need the entry (and `src/motion`, `src/shared`)
unpacked — `asarUnpack`, or a bundle built at package time. The
`build.files` list already ships the sources; the unpack step is not done.

## Keyboard and commands

`src/renderer/lib/shortcuts.ts` is one listener over one table. Bindings are
written as `"mod+z"`, which means Cmd on macOS and Ctrl elsewhere.

Commands are declared once in `EditorShell.commands`, and both the palette
and the shortcut table are derived from that array — so a command can never
have a key the palette does not show, or a palette entry that does something
different from its key.

## The MCP server

`src/mcp/server.js`. This is the product's primary interface — see
[mcp.md](mcp.md) for the tool reference.

It runs in plain Node, with no Electron, which is why `src/shared/paths.js`
and `src/shared/project-fs.js` exist as an Electron-free core. Both the app
and the server call the same sandbox and the same store, parameterised by
workspace root. Two implementations of "is this path inside the project"
would be one implementation and one hole — and the agent-facing surface is
the one most likely to be handed `../../.ssh/config` by a model that guessed
at a relative path.

The server cannot import TSX, so the component vocabulary is described in
`src/motion/specs.js` as plain data and implemented in `registry.ts`.
`registry.test.ts` fails if either half drifts, so an agent can never be told
about a component that has no implementation.

Its render helpers (`src/mcp/render.js`) are separate from the app's queue
because the requirements differ: the app's queue is asynchronous and reports
to a UI, whereas a tool call wants a promise that resolves when the file
exists — and wants stills far more often than video.

## What is not built yet

Stated plainly so nothing here reads as more finished than it is.

- **User-authored components.** `component` layers resolve through a static
  allow-list. Loading arbitrary components from a project's `components/`
  directory needs a compilation step; evaluating source from a project file
  would make opening a downloaded project equivalent to running it, so the
  allow-list is a security boundary, not an oversight.
- **Keyframes.** The model has entrance/exit presets and per-scene camera
  moves; there is no per-property keyframe track. The `Layer` shape
  anticipates one.
- **Speech and asset generation.** Not built. The asset system already treats
  generated files as ordinary project assets (`assets/generated/`, tagged
  `origin: "generated"`), which is the integration point. There is no
  `speech.generate` tool.
- **Code editor panel.** The Files panel browses the project read-only.
  `file:read` and `file:write` exist and are sandboxed on both interfaces.
- **Audio waveforms, snapping, app sound design.**
- **Packaged rendering.** `getBundle` resolves the Remotion entry relative to
  `import.meta.url`, which works from source but not from inside an `asar`
  archive. Packaged builds need the entry and `src/motion`, `src/shared`
  unpacked — `asarUnpack`, or a bundle built at package time. `build.files`
  already ships the sources; the unpack step is not done.

## Extension points

- **A new layer type** — add to `LAYER_TYPES` and `defaultLayerProps` in
  `shared/project.js`, a renderer in `motion/layers.tsx`, and a section in
  `Inspector.tsx`.
- **A new motion component** — write it in `motion/components.tsx` and add a
  registry entry with its prop schema. The inspector generates its controls
  automatically; no UI work.
- **A new background** — add to `BACKGROUND_REGISTRY`; it appears in the
  background layer's Kind dropdown.
- **A new preset** — add to the table in `motion/presets.ts`; it appears in
  every animation picker.
- **A new IPC call** — add the channel to `shared/ipc.js`, the handler to
  `main/ipc.js`, the literal to `preload.cjs`, and the typed wrapper to
  `renderer/lib/bridge.ts`. The contract test will fail until the preload is
  updated.
- **A new MCP tool** — add it to `mcp/server.js`. If it mutates, route it
  through an operation in `shared/` rather than editing the model inline, so
  the app and the agent stay on one code path.

Registering a component means editing two files: the spec in `specs.js` and
the mapping in `registry.ts`. That is deliberate — it is what lets Node read
the vocabulary — and `registry.test.ts` catches you if you forget one.

## Testing

`npm test`. Coverage is concentrated where a regression is dangerous or
invisible rather than spread evenly:

- `shared/project.test.js` — timeline arithmetic, tolerant normalisation,
  serialisation round-trips and stable key order.
- `motion/timing.test.ts` — clamping, monotonicity, determinism, and that no
  preset ever yields `NaN`.
- `state/operations.test.ts` — immutability, clamping, id freshness on
  duplicate.
- `main/workspace.test.js` — adversarial path traversal.
- `main/preload.contract.test.js` — the two copies of the channel list agree.
- `motion/registry.test.ts` — the described vocabulary and the implemented
  vocabulary match, in both directions.
