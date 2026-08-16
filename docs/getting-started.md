# Getting started

Two ways in, and they are for different things:

| You want to | Use |
| --- | --- |
| Watch, inspect and hand-edit videos | **The Windows app** — download and run |
| Have Claude *make* videos for you | **The MCP server** — needs the repo and Node |

The app is a window onto a project. The MCP server is how a project gets
made. Most people end up wanting both, so this guide sets up both.

---

## 1. Install the app

Download from [Releases](https://github.com/nettanvirdev/rawmotion/releases):

- **`Raw Motion-<version>-portable.exe`** — no install. Double-click it.
- **`Raw Motion-Setup-<version>.exe`** — installer, adds a Start Menu entry.

Windows x64. The portable build writes no registry keys; it unpacks to a temp
directory each run, so first launch is a few seconds slower than the
installed build.

> **SmartScreen will warn you.** The executables are unsigned — code signing
> certificates cost money and this is CC0 software. Click *More info* →
> *Run anyway*, or check the SHA-256 against the release notes if you would
> rather verify than trust.

### Where your projects live

`Documents\Raw Motion\`. Each project is a directory, not an opaque file:

```
Aurora Launch.rawmotion/
  project.json        the model — the single source of truth
  assets/             images, video, audio, fonts
  components/         custom motion components
  renders/            exported MP4s
  cache/              derived data, safe to delete
```

Set `RAWMOTION_WORKSPACE` to put that somewhere else. The app writes its
chosen location to `~/.rawmotion/workspace.json` so the MCP server finds the
same folder — that file is how the two halves agree, and you should not need
to touch it.

### First run

Create a project from the **Aurora launch** template. It is a five-scene
product film that is entirely procedural — no bundled images, no fonts to
install — so it renders identically on any machine.

Press `Space` to play. Drag in the timeline to scrub. Click any layer to see
its props in the inspector on the right.

### First render

`Cmd/Ctrl+K` → **Render** — or the Render button in the top bar. Output lands
in the project's `renders/` folder, and the queue runs in a separate process
so the UI keeps working while it encodes.

> **The first render downloads a headless Chromium** (~150 MB), once. If your
> machine has no internet access, or your network blocks `remotion.media`,
> point `RAWMOTION_CHROME` at any existing Chrome or Chromium binary instead:
>
> ```
> set RAWMOTION_CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
> ```

---

## 2. Connect Claude

This is the part that makes Raw Motion different from an editor, and it needs
the repository — the server runs on Node, outside the packaged app.

```bash
git clone https://github.com/nettanvirdev/rawmotion
cd rawmotion
npm install
```

**Claude Code** picks up `.mcp.json` from the repo automatically. Nothing to
configure — open the folder and the `rawmotion` server is there.

**Claude Desktop** — add to `claude_desktop_config.json`
(`%APPDATA%\Claude\` on Windows):

```jsonc
{
  "mcpServers": {
    "rawmotion": {
      "command": "node",
      "args": ["C:\\path\\to\\rawmotion\\src\\mcp\\server.js"]
    }
  }
}
```

**Any other harness** — it is a standard stdio MCP server:

```bash
npm run mcp
```

Check it works by asking Claude to call `describe_capabilities`. That returns
the whole vocabulary — components, props, themes, layout presets, transitions
— and is what a model should read before composing anything.

---

## 3. Make a video

### From a prompt

Just ask. The `raw-motion` skill in `.claude/skills/` carries the craft
rules, so you get a composed film rather than a slideshow:

> Make me a 30-second launch film for a developer tool called Ledger.
> Arctic theme, clean and cold, no stock-photo energy.

Claude will pick a theme, write a storyboard, build the scenes, **render a
contact sheet and look at it**, fix what is wrong, and render the MP4.

That looking step is the whole design. An agent that cannot see its output
composes from arithmetic — it can verify a layer's `y` is 250, but not that
250 puts the caption through the middle of the product card.

### From a codebase

The `codebase-explainer` skill reads real source before composing:

> Make a motion explainer about how the render queue in this repo works.

It pastes actual code from the repository rather than inventing plausible
code, because a viewer who opens the repo and cannot find the function you
showed stops trusting the whole video.

### Steering it

Say what you want in plain language — the vocabulary is designed to be
promptable:

> Make the background warmer, ember rather than violet.
> The chapter titles and the code panel should share a left edge.
> Hold scene 3 longer, people are still reading.

Themes are `midnight`, `graphite`, `aurora`, `ember`, `ultraviolet`,
`arctic`, `glass` and `paper`. `glass` is the Apple-style light treatment —
frosted panes on a soft chromatic ground.

---

## 4. Watch it happen live

Open the project in the app and leave it open while Claude works.

Every MCP mutation writes `project.json` immediately; the app watches that
file and reloads. So you see scenes appear as they are composed, and you can
reach into the inspector mid-session to nudge something. Both sides are
editing the same document — there is no import, no sync, and no second copy
to get out of date.

If you hand-edit while Claude is working, your write wins and Claude sees it
on its next read. That is the intended workflow, not a hazard.

---

## Troubleshooting

**"Render failed" on a fresh machine.** Almost always the Chromium download.
Set `RAWMOTION_CHROME` as above.

**Claude cannot find my projects.** The app and the server disagree about the
workspace. Set `RAWMOTION_WORKSPACE` to the same absolute path in both, or
launch the app once so it publishes `~/.rawmotion/workspace.json`.

**Renders are slow.** Rendering is CPU-bound Chromium rasterization, and the
blurred backgrounds are the expensive part. Render one video at a time —
Remotion already spreads a single render across every core, so running two
at once makes both slower rather than finishing sooner.

**A long film "hangs" near the end.** It is encoding. Frame rendering and
h264 encoding are separate phases and the progress figure covers the first.

**The app opened but the canvas is black.** Check the scene actually has a
background layer. A scene with no layers renders as nothing, correctly.

---

## Where to go next

- [`docs/mcp.md`](mcp.md) — every tool, with arguments
- [`docs/architecture.md`](architecture.md) — the design, and what is *not*
  built yet
- [`examples/`](../examples) — six finished films and the scripts that made
  them
- `.claude/skills/raw-motion/references/vocabulary.md` — every component and
  prop, generated from the specs the engine actually uses
