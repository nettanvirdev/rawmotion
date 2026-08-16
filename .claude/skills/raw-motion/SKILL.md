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

**Composition**

- One idea per scene. If a scene needs two headlines, it is two scenes.
- Keep content within the middle 80% of frame. Layer `transform.x/y` are
  offsets from centre, so ±760 x and ±400 y is the safe box at 1920x1080.
- Never centre two things on the same point. Offset the title up and the
  supporting element down, or split left/right.
- Big type is 90-130px. Body is 26-36px. Captions 28-32px. Between 40 and 80
  is the dead zone that reads as neither.

**Motion**

- Every scene gets a `background` layer, usually `kind: "depth"`. A flat
  colour behind type is the single clearest sign nobody designed this.
- Give most scenes a camera move: `push` amount 0.04-0.10 is the default.
  Static frames are for the outro.
- Use `depthIn` for hero objects, `riseFade` for text, `fade` for backgrounds
  and supporting elements. Do not use a different preset for every layer.
- Transitions: `fade` 15-20 frames between related scenes, `blur` for a
  change of subject, `none` before an outro. Remember a transition *overlaps*
  the scenes, so it shortens the film.

**Restraint**

- One accent colour for the whole video. Default `#8b9bff`.
- No more than 4 layers in a scene beyond the background.
- Never animate something that does not need to move.

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
    { "type": "background", "props": { "kind": "depth", "hue": 252 } },
    {
      "type": "component",
      "transform": { "y": -40 },
      "props": {
        "component": "ProductCard",
        "props": { "title": "Raw Motion", "caption": "AI-native motion design" }
      },
      "enter": { "preset": "depthIn", "durationInFrames": 34 }
    },
    {
      "type": "text",
      "start": 50,
      "transform": { "y": 320 },
      "props": { "text": "Preview, edit and export the same composition.", "fontSize": 30, "color": "#8e93a8" },
      "enter": { "preset": "riseFade", "durationInFrames": 26, "distance": 22 }
    }
  ]
}
```

Note the shape: background, hero, supporting line offset downward and
delayed. That pattern carries most scenes.

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

## Aspect ratios

`1920x1080` landscape, `1080x1920` vertical, `1080x1080` square. For vertical,
stack everything and reduce type by about 15% - a 118px headline that works
in landscape wraps badly at 1080 wide.

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

- Composing more than three scenes without rendering anything.
- Inventing a component name. Call `describe_capabilities` and use what exists.
- Putting `\n` inside a JSON string as `\\n` - it will print literally.
- Setting a layer `start` beyond its scene's duration.
- A transition longer than the scene it sits in.
- Fifteen-second scenes. Cut more often.
