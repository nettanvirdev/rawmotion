# Authoring scripts

The scripts that composed the themed films in `examples/`. They are kept
because they are the honest answer to "how was this made": each one drives
the `rawmotion` MCP server over stdio, through the same tools any agent
gets. There is no privileged path — if these films could only be made
through an internal API, they would prove nothing about the MCP surface.

| Script | What it does |
| --- | --- |
| `client.mjs` | A ~40-line MCP stdio client. `call`, `json`, `saveImages`. |
| `five-themes.mjs` | Builds the five themed films, one per theme, and shoots a contact sheet of each. |
| `glass-lumen.mjs` | Builds the Apple-style glass film. |
| `render.mjs` | Renders the films to MP4. |

```bash
node examples/authoring/five-themes.mjs /tmp/shots
node examples/authoring/glass-lumen.mjs /tmp/shots
node examples/authoring/render.mjs           # all of them
node examples/authoring/render.mjs 06        # or one, by filename prefix
```

Projects are written to the Raw Motion workspace — `~/Documents/Raw Motion`
by default, or wherever `RAWMOTION_WORKSPACE` points. They are not in this
repository, because a project is a directory of media.

## Render one at a time

`render.mjs` is serial, and that is the whole point of it. An earlier
version queued all five films at once, which parallelised nothing:
Remotion already spreads a single render across every core, so six
concurrent jobs on four cores interleave into six renders each taking six
times as long, with none of them able to report meaningful progress. It
looked exactly like a hang. Rendering one film at a time finishes the batch
sooner *and* tells you where it is.

## If Chromium is not where Remotion expects

Set `RAWMOTION_CHROME` to a Chromium binary and Remotion will use it
instead of downloading its own headless shell — necessary on any machine
without egress to `remotion.media`.

```bash
export RAWMOTION_CHROME=/path/to/chrome
```
