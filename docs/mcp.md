# Driving Raw Motion from a harness

Raw Motion's primary interface is an MCP server. The desktop app is a window
onto a project; the server is how a project gets made.

## Connecting

```jsonc
// .mcp.json
{
  "mcpServers": {
    "rawmotion": {
      "command": "node",
      "args": ["src/mcp/server.js"]
    }
  }
}
```

Or directly: `npm run mcp`. It speaks stdio.

| Variable | Purpose |
| --- | --- |
| `RAWMOTION_WORKSPACE` | Directory holding projects. Defaults to `~/Raw Motion`. |
| `RAWMOTION_CHROME` | Path to a Chromium binary. Remotion downloads its own headless shell if unset; set this in containers and CI that cannot reach the download host. |

The server writes only inside the workspace, and only inside a single
project directory per call. Every path it is handed goes through
`resolveInProject`, the same sandbox the desktop app uses — see
[architecture.md](architecture.md).

## The tools

**Discovery**

| Tool | Returns |
| --- | --- |
| `list_projects` | Every project in the workspace, newest first. |
| `describe_capabilities` | The whole vocabulary: components with their prop schemas, background kinds, animation presets, transitions, composition presets. Call this before composing. |

**Authoring**

| Tool | Notes |
| --- | --- |
| `create_project` | Returns `dirName`, which every other tool takes. |
| `inspect_project` | Full model plus computed scene timings. |
| `set_composition` | Dimensions, fps, backdrop, name. |
| `set_theme` | The whole film's look in one call. Components inherit it. |
| `build_scenes` | Whole storyboard in one atomic call. The efficient path. |
| `add_scene` / `update_scene` / `delete_scene` / `reorder_scenes` | |
| `add_layer` / `update_layer` / `delete_layer` | Patches merge into existing props. |
| `add_audio` | |
| `timeline` | Compact view in frames and timecode. |

**Files** — `list_files`, `read_file`, `write_file`, `list_assets`,
`import_asset`. All sandboxed to the project.

**Custom components**

| Tool | Notes |
| --- | --- |
| `list_components` | Every TSX module in `components/`, with manifest and compile status. |
| `write_component` | Write **and compile** in one call - errors come back immediately. |
| `delete_component` | |

A custom component is a real React module: `export default` the component,
`export const manifest` the schema. It may import `react`, `remotion`,
`rawmotion` (theme, timing, text kit, every built-in component) and sibling
files. Once compiled it is used like any built-in: a `component` layer with
`props.component` set to the manifest name, with inspector controls
generated from `manifest.props`.

**Seeing and rendering**

| Tool | Notes |
| --- | --- |
| `render_frame` | One frame, returned **as an image**. |
| `render_contact_sheet` | The midpoint of every scene, as images. |
| `render_video` | Starts a job, returns a `jobId` immediately. |
| `render_status` | Poll a job; reports progress, then the output path and size. |

## Why rendering is a job

`render_video` returns a `jobId` rather than the finished file.

A full-length 1080p render takes minutes, and MCP clients apply a request
timeout — the reference SDK defaults to 60 seconds. A synchronous render tool
therefore reports a timeout *error* to the agent while the render happily
continues and writes the file. The agent then either retries, doubling the
load, or abandons a video that exists. This was found by hitting it, not by
reasoning about it.

So: start, then poll `render_status`. Roughly 1–3 frames per second at 1080p,
so a 30-second film is several minutes. Use `scale: 0.5` for a draft.

Renders run detached from the call that started them, which means a failure
arrives as an unhandled rejection rather than as a thrown error someone is
awaiting. The server traps those and records the failure on the job — losing
a render must not end the agent's session.

## Why the render tools return images

An agent that cannot see its own output is composing from arithmetic. It can
verify that a layer's `y` is `250`, but not that `250` puts the caption
through the middle of the product card.

`render_frame` and `render_contact_sheet` return real PNGs through MCP's
image content type, so the model looks at the frame the same way a designer
looks at a monitor. This is the single most important design decision in the
server, and it is why both tools default to a reduced scale — the agent is
judging composition and timing, not pixel detail, and a cheap look is one it
can afford to take after every change.

The contact sheet samples each scene's **midpoint** rather than its first
frame, because a scene's opening frame is usually mid-entrance and shows
nothing about what the shot actually looks like.

## The shape of a session

```
describe_capabilities        learn the vocabulary
create_project
write_file  storyboard.md    so the user can see the plan
build_scenes                 the whole film, one call
render_contact_sheet         look at it
update_layer                 fix what is actually wrong
render_frame                 check the moment you changed
render_video
```

`build_scenes` exists because authoring a seven-scene film one `add_layer` at
a time is forty round trips, and an agent that has already decided on the
storyboard should be able to commit it at once. It is also atomic: either the
whole film lands or none of it does.

## Positioning: use the grid

**Place layers with `layout`, not `transform.x/y`.** This is the single
biggest quality difference between a video that looks designed and one that
looks assembled.

A layer without a layout is centred on its own content, so two layers given
the same `x` end up with different left edges — off by half the difference in
their widths. With `layout`, an element's edge comes from a 12-column × 8-row
grid, so two layers in column 1 line up exactly whatever is inside them.

```jsonc
{ "layout": { "preset": "splitLeft" } }              // named region
{ "layout": { "preset": "splitLeft", "row": 1 } }    // preset, adjusted
{ "layout": { "col": 7, "span": 6, "align": "left" } } // explicit
```

`describe_capabilities` lists every preset. `transform.x/y` still exists and
still works — it is the right tool for an animation offset, and the wrong one
for placement.

## Coordinate conventions

These cause most first-attempt mistakes, so they are worth stating flatly.

- **Layer `start` and `duration` are relative to their scene.** A layer with
  `start: 200` in a 90-frame scene never appears.
- **`render_frame` and `timeline` use absolute project frames.**
- **`transform.x/y` are pixel offsets from the centre of frame**, not
  top-left coordinates — and not the way to align things.
- **A transition overlaps its scene with the next one**, so adding one makes
  the film shorter, not longer.
- **Everything is integer frames.** Seconds are `frames / composition.fps`.

## Errors

Tools return `isError` with a message written for a model that will retry
immediately: an unknown scene id lists the scenes that exist, and an
unopenable project lists the projects in the workspace. Failing usefully
matters more here than failing precisely, because the caller cannot ask a
human what it did wrong.

## The live loop

Every mutation saves `project.json` immediately. If the desktop app has that
project open, its file watcher notices, reloads and re-renders the preview.

No coordination between the two processes is needed beyond the file itself.
A user can watch the app while an agent composes, and can pick up the
inspector mid-session and change anything — both are writing to the same
document, and the app's own saves are fingerprinted so they do not echo back
through the watcher.
