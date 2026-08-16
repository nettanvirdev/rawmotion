---
name: raw-motion
description: Make motion-design videos with Raw Motion - product launches, feature reveals, and motion explainers about a codebase. Use whenever the user asks for a video, an animation, a launch film, a product teaser, a demo video, an explainer, or asks to "explain this repo/feature as a video". Drives the rawmotion MCP server to compose scenes, preview frames, iterate, and render MP4.
---

# Raw Motion

You are directing a motion-design engine. You compose a project out of scenes
and layers, **look at the frames you produce**, fix what is wrong, and render.

The engine is driven by the `rawmotion` MCP server. If those tools are not
available, tell the user to add it (`node src/mcp/server.js` in this repo,
also exposed as `npm run mcp`) rather than trying to write video code by hand.

## The loop

```
describe_capabilities   once, before composing
        ↓
create_project
        ↓
build_scenes            the whole storyboard in one call
        ↓
render_contact_sheet    LOOK AT IT
        ↓
update_layer / update_scene    fix what is actually wrong
        ↓
render_frame            check the specific moment you changed
        ↓
render_video
```

**The looking step is not optional.** You cannot judge composition from
JSON. A layer at `y: 250` is either well placed or overlapping the caption,
and the only way to know is to render the frame. Budget for at least one
contact sheet and two or three frame checks on any video worth making.

## Non-negotiable craft rules

These are what separate a designed video from a generated one. Follow them
even when the user has not asked for "premium".

**Timing**

- Nothing on screen for less than 0.7s (21 frames at 30fps). If a beat needs
  to be shorter, cut it instead.
- A scene holds for at least 2s. Under that the viewer registers movement but
  reads nothing.
- Entrances run 20-34 frames. Faster reads as a glitch, slower as a stall.
- Stagger related elements 4-8 frames apart. Simultaneous arrival looks
  automated; that is exactly the tell to avoid.
- Give the last scene 20+ frames of stillness before it ends. A film that
  cuts on the final movement feels truncated.

**Alignment - use the grid, always**

This is the single biggest quality lever, and the easiest thing to get wrong.

**Position layers with `layout`, not with `transform.x/y`.** A layer without
a layout is centred on its own content, so two layers given the same `x` end
up with *different* left edges - off by half the difference in their widths.
Nothing lands on a shared line, and the frame looks subtly broken in a way
that is hard to name and impossible to miss.

With `layout`, an element's edge comes from a 12-column x 8-row grid rather
than from its content, so a 40-character headline and a three-word label in
column 1 line up exactly.

Prefer a preset: `splitLeft`, `splitRight`, `center`, `centerUpper`,
`bottomLeft`, `caption`, `topBand`, `middleBand`, `bottomBand` and the rest -
`describe_capabilities` lists them all. Drop to explicit `col`/`span`/`row`
only when no preset fits.

```json
{ "layout": { "preset": "splitLeft" } }
{ "layout": { "col": 7, "span": 6, "row": 2, "rowSpan": 5, "align": "center" } }
{ "layout": { "preset": "splitLeft", "row": 1 } }
```

Anything sharing a visual edge must share a column. A chapter title in
`splitLeft` and a callout in `bottomLeft` both start at column 1, so their
left edges are identical - that is the whole point.

Use `offsetX`/`offsetY` sparingly. A nudge is an admission the grid was
wrong; usually the right answer is a different cell.

**Composition**

- One idea per scene. If a scene needs two headlines, it is two scenes.
- Big type is 90-130px. Body is 26-36px. Captions 28-32px. Between 40 and 80
  is the dead zone that reads as neither.
- Never centre two things on the same point. Split left/right, or stack into
  different rows.

**Motion**

- Every scene gets a `background` layer, `kind: "studio"`. It inherits the
  theme, so leave its props empty. A flat colour behind type is the single
  clearest sign nobody designed this.
- Give most scenes a camera move: `push` amount 0.04-0.10 is the default.
  Static frames are for the outro.
- Use `depthIn` for hero objects, `riseFade` for text, `fade` for backgrounds
  and supporting elements. Do not use a different preset for every layer.
- The **Energy** presets (`popIn`, `whipLeft`/`whipRight`, `zoomBlur`,
  `glitchIn`) are for accents - a stat popping, a badge landing, a beat drop.
  One or two per film. A whole video of whips is a lyric-video template.
- The **Organic** presets (`floatIn`, `waveIn`, `swingIn`, `orbitIn`,
  `flipIn`) keep moving subtly after arrival - use them for hero imagery,
  logos and product art that must feel alive during a long hold. `floatIn`
  on a device mockup is the Apple-ad look.
- Transitions: `fade` 15-20 frames between related scenes, `blur` for a
  change of subject, `zoom` for a product-film cut, `push` for lateral
  narrative movement ("meanwhile"), `circle` for a big reveal, `spin` and
  `glitch` only on high-energy pieces, `none` before an outro. Remember a
  transition *overlaps* the scenes, so it shortens the film.
- "Morph" moments (a pen becoming a sugarcane, an icon becoming a product):
  the engine does not interpolate SVG paths, so build it as a **crossfade in
  motion** - both layers share the same layout cell, the outgoing layer exits
  with `zoomBlur` while the incoming one enters with `zoomBlur` over the same
  12-16 frames, on a `push` camera. At speed, with blur covering the swap,
  it reads as a transformation.

**Theme - set it, do not hand-colour**

Call `set_theme` (or pass `theme` to `create_project`) and let every
component inherit. Themes carry the backdrop, the accent and the type
colours, so "make it warmer" is one call rather than forty edits.

`midnight` (default, technical SaaS), `graphite` (neutral, editorial),
`aurora` (teal, developer tooling), `ember` (warm, premium launch),
`ultraviolet` (magenta, high energy), `arctic` (ice blue, data), `paper`
(light, documentation), `glass` (Apple-style light frosted glass).

On the `glass` theme use `GlassCard` and `GlassBar` rather than
`ProductCard`, and let panels stay translucent - the frosting over the
pastel ground *is* the design. Code blocks switch to a light syntax palette
automatically.

Do **not** set `accent` on individual components unless you deliberately
want one element off-theme. Leaving it unset is what makes a theme change
work. Fine-tune a backdrop through `set_theme`'s `backdrop` argument - `hue`,
`intensity`, `dots`, `grid`, `spotlight`, `aurora`, `beams`, `grain`.

**Restraint**

- One accent colour for the whole video, and it comes from the theme.
- No more than 4 layers in a scene beyond the background.
- Never animate something that does not need to move.

**Surfaces - no borders**

Panels, cards and plates in a composition follow the same rule as the app's
own UI: **no borders or strokes**. A 1px outline around a card is the
fastest way to make motion graphics look like a slide deck. Separation comes
from surface contrast, a soft shadow (wide blur, low alpha - never a hard
drop), and generous corner radii (16-42px on cards; small radii read as
spreadsheet cells). Shape layers: keep `strokeWidth: 0` and use `fill` with
low `fillOpacity` for plates.

The one sanctioned exception is an **animated** edge - an aurora sweep or
specular highlight travelling around a hero card (what `GlassCard` does with
its specular edge). Light moving along an edge is lighting; a static stroke
is a border. If it does not move, it does not ship.

## Composing scenes

Use `build_scenes` to lay down the whole storyboard in one call rather than
adding layers one at a time - it is atomic and far fewer round trips.

Layer times are **relative to their scene**. Project frames are absolute -
`timeline` and `render_frame` use those. Do not mix them up: a layer with
`start: 200` in a 90-frame scene never appears.

A scene that reads well:

```json
{
  "name": "Product reveal",
  "durationInFrames": 180,
  "camera": { "move": "pull", "amount": 0.12 },
  "transition": { "type": "fade", "durationInFrames": 18 },
  "layers": [
    { "type": "background", "props": { "kind": "studio" } },
    {
      "type": "component",
      "layout": { "preset": "centerUpper" },
      "props": {
        "component": "ProductCard",
        "props": { "title": "Raw Motion", "caption": "AI-native motion design" }
      },
      "enter": { "preset": "depthIn", "durationInFrames": 34 }
    },
    {
      "type": "text",
      "start": 50,
      "layout": { "preset": "bottomBand" },
      "props": { "text": "Preview, edit and export the same composition.", "fontSize": 30 },
      "enter": { "preset": "riseFade", "durationInFrames": 26, "distance": 22 }
    }
  ]
}
```

Note the shape: background inheriting the theme, hero in an upper region,
supporting line in a lower band and delayed. Both content layers are placed
by the grid, so they share a centre line exactly. That pattern carries most
scenes.

## Explaining a codebase

When the request is "make a video explaining X" about real code:

1. **Read the code first.** Find the actual interesting thing - the decision,
   the constraint, the non-obvious mechanism. A video that narrates the
   directory structure is worthless.
2. **Write a storyboard before composing.** One line per scene: what it
   shows, what it says. Save it with `write_file` to `storyboard.md` in the
   project so the user can see your plan.
3. **Structure it.** `Chapter` cards between sections. Aim for 5-9 scenes.
4. **Show real code, short.** `CodeBlock` with 8-16 lines. Paste actual
   source, never invented code. Use `focusLines` with `focusAt` to dim
   everything except the lines you are talking about - that one prop does
   more explanatory work than any amount of narration.
5. **Use the right component.** `DiagramFlow` for a pipeline, `FileTree` for
   layout, `Terminal` for commands, `StatGrid` for numbers, `Callout` for the
   one sentence that matters.

Do not put more than ~16 lines of code on screen at once, and size it so the
lines do not run off the panel - roughly `width >= code_columns * fontSize * 0.62`.

## Aspect ratios and frame rate

`1920x1080` landscape, `1080x1920` vertical, `1080x1080` square. For vertical,
stack everything and reduce type by about 15% - a 118px headline that works
in landscape wraps badly at 1080 wide.

`fps` is free to set at `create_project` / `set_composition` - 24 for
cinematic, 30 default, 60/120 for silky product motion. **All timing rules
above are stated at 30fps; scale frame counts with the rate** (a 24-frame
entrance at 30fps is a 96-frame entrance at 120fps). Render time scales
linearly with frame count, so quote 4x the wait for 120fps.

## Audio

Audio lives **inside the project's data folder** - `assets/audio/` - never
referenced from an outside path. Copy any narration, music bed or SFX in
with `import_asset` first (it lands in `assets/audio/` and registers in the
asset list), then place it with `add_audio`. That keeps the project folder
self-contained: it can be zipped, moved or opened on another machine and
every clip still resolves. Reuse is free - once a track is in the data
folder, several clips can reference the same `src` with different trims.

Mixing defaults that read as designed: music bed at `volume` 0.25-0.4 with
`fadeIn`/`fadeOut` of 30-60 frames, voice at 0.9-1.0, SFX hits at 0.6-0.8
placed to land exactly on the frame their visual counterpart arrives.

## Product art

For a product ad (a phone, a watch, an app icon) do not hunt for PNGs first.
Draw a **pixel-perfect SVG** of the product with `write_file` into the
project's `assets/images/`, register it with `import_asset`, and use it as an
`image` layer - SVG scales losslessly to 4K, inherits nothing, and renders
identically in preview and export. Build it like a designer: one master
silhouette, large corner radii, layered soft gradients for body/screen/glass,
no strokes. Only reach for internet imagery when the subject genuinely
cannot be drawn (a photograph, a real screenshot), and then prefer clean
transparent PNGs.

## Rendering

- `render_video` returns a **`jobId` immediately** - it does not wait. Poll
  `render_status` with that id until it reports `done`.
- `scale: 0.5` for a draft the user can watch quickly; default scale and
  `crf: 18` for a final master.
- Roughly 1-3 frames per second at 1080p, so a 30-second film is several
  minutes. Say so before starting rather than going quiet, and space the
  polls out - checking every few seconds just burns turns.

## Reference

`references/vocabulary.md` in this skill lists every component and its props
with usage notes. `describe_capabilities` returns the same data live from the
engine, and is authoritative if they ever disagree.

## Failure modes to avoid

- Positioning with `transform.x/y` instead of `layout`. This is the number
  one cause of a video that looks almost right and reads as amateur.
- Setting `accent` on every component instead of setting the theme.
- Composing more than three scenes without rendering anything.
- Inventing a component name. Call `describe_capabilities` and use what exists.
- Putting `\n` inside a JSON string as `\\n` - it will print literally.
- Setting a layer `start` beyond its scene's duration.
- A transition longer than the scene it sits in.
- Fifteen-second scenes. Cut more often.
