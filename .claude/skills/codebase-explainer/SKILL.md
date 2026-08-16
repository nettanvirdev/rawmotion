---
name: codebase-explainer
description: Turn a codebase, feature, PR or architecture into a motion explainer video using Raw Motion. Use when the user asks to explain, document, demo or onboard someone to code as a video - "make a video about how X works", "explain this repo", "video walkthrough of this feature", "animate this architecture". Reads the real source, writes a storyboard, composes scenes over MCP, and renders MP4.
---

# Codebase explainer

Turning code into a video is a **research task first and a composition task
second**. The failure mode is not ugly slides; it is a beautiful video that
explains nothing because nobody read the code before making it.

Requires the `rawmotion` MCP server. Load the `raw-motion` skill for the
motion-design rules and the component vocabulary — this skill covers only
what is different about explaining code.

## Order of work

### 1. Read the code. Actually read it.

Find the thing that is genuinely worth six scenes:

- a decision with a real trade-off, and the reason it went that way
- a constraint that shaped the design
- a mechanism that is not obvious from the file names
- the invariant everything else depends on

Search for the "why" comments, the tests around the tricky part, the module
everything imports. Read the README's architecture section if there is one.

**Do not** produce a video that walks the directory tree. "Here is the src
folder, here is the components folder" is what an agent makes when it has not
understood the code, and it is instantly recognisable as such.

If you genuinely cannot find something interesting, say so and ask what the
user wants emphasised. That is a better outcome than a hollow video.

### 2. Write the storyboard before composing

One line per scene: what is on screen, what it says. Save it to the project
with `write_file` as `storyboard.md`, then compose from it. Writing it first
is what stops the video becoming a list of files.

A structure that works, 5-9 scenes:

```
1. Title          What this explains, and why it is interesting.
2. The shape      The one diagram that orients the viewer.
3-6. The parts    One idea each. Real code, one focused region.
7. The payoff     What it adds up to. The invariant, the guarantee.
8. Close          Mark, held still.
```

### 3. Compose

Chapter cards carry the structure. The standard technical scene is:

```
Chapter card    layout: splitLeft    ← number, title, one-line subtitle
CodeBlock       layout: splitRight   ← real source, 8-16 lines, focusLines
Callout         layout: bottomLeft   ← delayed, the sentence that lands it
```

Use exactly those layout presets. `splitLeft` and `bottomLeft` both start at
column 1, so the chapter title and the callout share a left edge precisely -
which is what makes the frame read as designed rather than assembled. Never
position these with `transform.x/y`; see the alignment section of the
`raw-motion` skill for why.

Time the callout 100+ frames in, after the viewer has had a chance to read
the code.

## Code on screen

**Paste real source. Never invent code.** A viewer who opens the repo and
cannot find the function you showed stops trusting the whole video. Trimming
is fine: drop the error branches, keep the shape, keep the identifiers exact.

- 8-16 lines. Beyond that nobody reads it, they just see "code".
- `fontSize` 19-22 at 1080p.
- Size the panel to the content: `width >= longest_line * fontSize * 0.62`.
  Overflow fades at the right edge, which looks deliberate but loses the code.
- `lineStagger: 1.5-2` so lines arrive as if being written.
- **Always use `focusLines`** with a `focusAt` timed to when the point
  arrives. Dimming the rest is the single most effective explanatory device
  available — it does the work narration would otherwise have to.

`focusAt` is relative to the layer's own start, not the scene or the project.

## Picking the component

| Showing | Use |
| --- | --- |
| A function, a config, a type | `CodeBlock` |
| A pipeline, a data flow, a request path | `DiagramFlow` |
| Project layout, where a file lives | `FileTree` |
| Install, build, run | `Terminal` |
| Benchmarks, coverage, counts | `StatGrid` |
| The one sentence that matters | `Callout` |
| The running app | `BrowserFrame` with a screenshot |

Prefer a diagram to a paragraph, and real code to a diagram of code.

## Pacing

Technical content needs longer holds than a product film — the viewer is
reading, not watching.

- A scene with code on it: 170-200 frames (6-7s) minimum.
- Reveal the code, hold, *then* focus. Do not focus on the first frame.
- Chapter cards can be brief, 90-120 frames.
- `fade` transitions between sections; `blur` when the subject changes
  entirely.

A six-scene explainer lands around 30-40 seconds. That is the right length
for something someone will actually watch.

## Verify before rendering

`render_contact_sheet` and look at every shot. Specifically check:

- Does the code panel overlap the chapter card?
- Is any text running off the edge?
- Is the callout colliding with the code?
- Does any scene look empty at its midpoint?

Then `render_frame` on the frames where a `focusAt` or a delayed callout
fires, since a contact sheet samples the midpoint and can miss both.

## Accuracy

You are putting claims on screen where they are hard to correct. Every number
must come from something you actually ran or read — a test count from running
the tests, a benchmark from the benchmark. If you are not certain of a figure,
leave it out; a video with three true numbers beats one with six plausible
ones.
