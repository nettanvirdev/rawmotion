# Demo reel

Two films, both composed by an agent driving the `rawmotion` MCP server —
`create_project`, `build_scenes`, `render_contact_sheet`, look, fix,
`render_video`. No hand-editing of `project.json`, no manual work in the
desktop editor.

Both are entirely procedural: no bundled images, no fonts to install, no
generated assets. Everything on screen is a component.

| File | What it is |
| --- | --- |
| `raw-motion-launch.mp4` | Product launch. 29.5s, 1920×1080 h264, 885 frames, 11 MB. |
| `inside-raw-motion.mp4` | Motion explainer built from this codebase. 33.5s, 1920×1080 h264, 1002 frames, 12.7 MB. Every code block is pasted from the repository. |

## How they were made

The interesting part is not the output, it is that the iteration loop worked
the way it is supposed to. Rendering the contact sheet and *looking at it*
caught four real problems that reading the JSON would not have:

- `HeroTitle` collapsed a two-line headline onto one line, and faded in
  rather than revealing from a mask.
- `DiagramFlow` let horizontal nodes shrink to their text, so a four-stage
  pipeline occupied a third of the frame and read as an afterthought.
- `CodeBlock` clipped long lines mid-glyph.
- The stat grid and flow diagram were both sized for a smaller frame than
  they were in.

Each was fixed in the engine — not worked around in the project — and
re-shot. That is the loop the MCP server exists to support, and it is why
`render_frame` and `render_contact_sheet` return images rather than paths.

Rendering them also exposed a defect in the server itself: `render_video`
was synchronous, so the client timed out at 60 seconds while the render
carried on and wrote the file. An agent seeing that would either retry —
doubling the load on a machine already rendering — or abandon a video that
exists. Rendering is now a job with a `render_status` poll.

## Reproducing

The projects live in the workspace, not in this repo, because a project is a
directory of media. To rebuild them, point an agent at the `raw-motion` and
`codebase-explainer` skills and ask for a product launch or an explainer.

The storyboard for each was written to `storyboard.md` inside its project
directory before any scene was composed — which is the discipline the skills
ask for, and the reason both films have a shape rather than a sequence.
