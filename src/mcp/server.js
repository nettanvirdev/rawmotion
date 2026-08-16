#!/usr/bin/env node
/**
 * The Raw Motion MCP server.
 *
 * This is the product surface. The Electron app is a window onto a project;
 * this is the interface a harness uses to *make* one. Everything the editor
 * can do to a project, a tool here can do, because both call the same pure
 * operations in `src/shared`.
 *
 * ## Design rules
 *
 * **Tools return the consequences of an edit, not "ok".** Adding a layer
 * returns the new project duration and the scene's layer list, because the
 * agent's next decision depends on them and a round trip to ask is wasted
 * turns.
 *
 * **The agent can see.** `render_frame` and `render_contact_sheet` return
 * actual images through MCP's image content type. An agent that cannot look
 * at its own output is composing from arithmetic; one that can look iterates
 * like a designer. This is the single most important tool here.
 *
 * **Errors teach.** A failure explains what was expected and lists the valid
 * values, since the caller is a model that will retry immediately.
 *
 * **Writes land on disk immediately.** Every mutation saves `project.json`.
 * If the desktop app has the project open, its watcher picks the change up
 * and the preview updates - that is the live loop, and it needs no
 * coordination between the two processes beyond the file itself.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  COMPOSITION_PRESETS,
  LAYER_TYPES,
  createScene,
  findLayer,
  formatTimecode,
  projectDurationInFrames,
  sceneTimings,
} from "../shared/project.js";
import { resolveInProject, resolveWorkspaceRoot } from "../shared/paths.js";
import * as store from "../shared/project-fs.js";
import { TEMPLATES } from "../shared/templates.js";
import { BACKGROUND_REGISTRY } from "./registry-data.js";
import { THEME_NAMES, themeCatalogue } from "../motion/themes.js";
import { LAYOUT_PRESET_NAMES } from "./layout-data.js";
import {
  getRenderJob,
  listRenderJobs,
  renderContactSheet,
  renderFrame,
  startRenderJob,
} from "./render.js";

/**
 * The workspace this server operates on.
 *
 * Prefers the pointer the desktop app publishes on startup, so an agent and
 * a running app are always looking at the same folder. Falls back to
 * `~/Raw Motion` when the app has never run.
 */
const ROOT = resolveWorkspaceRoot(os.homedir(), os.homedir(), (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Load a project, or throw a message that tells the agent how to recover. */
async function load(dirName) {
  try {
    return await store.openProjectFromDisk(ROOT, dirName);
  } catch (error) {
    const available = await store.listProjects(ROOT).catch(() => []);
    throw new Error(
      `${error.message}\n\nProjects in this workspace: ${
        available.length ? available.map((p) => p.dirName).join(", ") : "(none)"
      }`,
    );
  }
}

/** Save and return the standard "what changed" summary. */
async function commit(dirName, project, extra = {}) {
  const saved = await store.saveProject(ROOT, dirName, project);
  return {
    dirName,
    name: saved.name,
    durationInFrames: projectDurationInFrames(saved),
    durationTimecode: formatTimecode(projectDurationInFrames(saved), saved.composition.fps),
    scenes: saved.scenes.length,
    ...extra,
  };
}

/** MCP text content. */
const text = (value) => ({
  content: [
    { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
  ],
});

/** MCP image content, read from a file on disk. */
async function image(filePath, caption) {
  const data = await fs.readFile(filePath);
  return {
    content: [
      ...(caption ? [{ type: "text", text: caption }] : []),
      { type: "image", data: data.toString("base64"), mimeType: "image/png" },
    ],
  };
}

/** Wrap a handler so a thrown error becomes a readable tool error. */
function tool(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      };
    }
  };
}

const server = new McpServer({ name: "rawmotion", version: "1.0.0" });

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

server.tool(
  "list_projects",
  "List every Raw Motion project in the workspace, newest first.",
  {},
  tool(async () => {
    const projects = await store.listProjects(ROOT);
    return text({ workspace: ROOT, projects });
  }),
);

server.tool(
  "describe_capabilities",
  "The full vocabulary available when composing: layer types, registered components with their props, background kinds, animation presets, transitions and composition presets. Call this before authoring a project.",
  {},
  tool(async () => {
    const { COMPONENT_SPECS, PRESET_NAMES } = await import("./registry-data.js");
    return text({
      layerTypes: LAYER_TYPES,
      themes: themeCatalogue(),
      layoutPresets: LAYOUT_PRESET_NAMES,
      components: COMPONENT_SPECS,
      backgroundKinds: Object.keys(BACKGROUND_REGISTRY),
      animationPresets: PRESET_NAMES,
      transitions: ["none", "fade", "blur", "slide", "wipe"],
      cameraMoves: ["none", "push", "pull", "pan"],
      compositionPresets: COMPOSITION_PRESETS,
      templates: TEMPLATES.map((t) => ({ id: t.id, label: t.label, description: t.description })),
      notes: [
        "All times are integer frames. Seconds = frames / composition.fps.",
        "Project duration is derived: sum(scene durations) - transition overlaps. There is no duration field.",
        "A scene's transition overlaps it with the NEXT scene, so adding one shortens the project.",
        "Layer start/duration are relative to the layer's own scene, not the project.",
        "Layer transform x/y are pixel offsets from the centre of frame.",
        "ALIGNMENT: use layer.layout (a 12-column x 8-row grid) rather than transform x/y. Two layers in the same column get identical left edges regardless of their content width; transform x/y cannot do that, because each layer is centred on its own box.",
        "Set the project theme rather than colouring components individually - components inherit accent, text and panel colours, so one set_theme call restyles everything.",
      ],
    });
  }),
);

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

server.tool(
  "create_project",
  "Create a new project. Returns its dirName, which every other tool takes.",
  {
    name: z.string().describe("Display name; also becomes the folder name."),
    width: z.number().int().optional().describe("Default 1920."),
    height: z.number().int().optional().describe("Default 1080."),
    fps: z.number().int().optional().describe("Default 30."),
    background: z.string().optional().describe("CSS colour behind every scene. Omit to use the theme's."),
    theme: z
      .enum(THEME_NAMES)
      .optional()
      .describe("Visual theme. Sets the backdrop, accent and type colours for the whole film."),
    template: z
      .enum(["blank", "aurora", "empty"])
      .optional()
      .describe("'empty' creates a project with one bare scene. Default 'empty'."),
  },
  tool(async ({ name, width, height, fps, background, theme, template = "empty" }) => {
    const composition = {
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(fps ? { fps } : {}),
      ...(background ? { background } : {}),
    };

    let scenes;
    if (template !== "empty") {
      const found = TEMPLATES.find((t) => t.id === template);
      if (found) scenes = found.build().scenes;
    }

    const created = await store.createProjectOnDisk(ROOT, { name, composition, scenes });
    if (theme) {
      await store.saveProject(ROOT, created.dirName, {
        ...created.project,
        theme: { preset: theme },
      });
      created.project.theme = { preset: theme };
    }
    return text({
      dirName: created.dirName,
      path: created.dir,
      ...(await commit(created.dirName, created.project)),
    });
  }),
);

server.tool(
  "inspect_project",
  "The full project model, plus computed scene timings. The primary read tool - call it before editing so frame numbers are grounded in the current state.",
  {
    dirName: z.string(),
    includeLayers: z
      .boolean()
      .optional()
      .describe("Include every layer's full props. Default true; set false for a compact overview."),
  },
  tool(async ({ dirName, includeLayers = true }) => {
    const { project } = await load(dirName);
    const timings = sceneTimings(project);
    const { fps } = project.composition;

    return text({
      dirName,
      name: project.name,
      composition: project.composition,
      durationInFrames: projectDurationInFrames(project),
      durationSeconds: Number((projectDurationInFrames(project) / fps).toFixed(2)),
      scenes: project.scenes.map((scene, i) => ({
        index: i,
        id: scene.id,
        name: scene.name,
        durationInFrames: scene.durationInFrames,
        startsAtFrame: timings[i].from,
        endsAtFrame: timings[i].to,
        camera: scene.camera,
        transition: scene.transition,
        overlapWithNext: timings[i].overlapWithNext,
        layers: includeLayers
          ? scene.layers
          : scene.layers.map((l) => ({
              id: l.id,
              name: l.name,
              type: l.type,
              start: l.start,
              duration: l.duration,
            })),
      })),
      audio: project.audio,
      assets: project.assets,
    });
  }),
);

server.tool(
  "set_composition",
  "Change the project's dimensions, frame rate, backdrop or name.",
  {
    dirName: z.string(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    fps: z.number().int().optional(),
    background: z.string().optional(),
    name: z.string().optional(),
  },
  tool(async ({ dirName, name, ...patch }) => {
    const { project } = await load(dirName);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

    const next = {
      ...project,
      ...(name ? { name } : {}),
      composition: { ...project.composition, ...clean },
    };
    return text(await commit(dirName, next, { composition: next.composition }));
  }),
);

server.tool(
  "set_theme",
  "Change the whole film's look in one call: backdrop, accent and type colours. Every component inherits it unless a layer sets a colour explicitly. This is the right way to answer 'make it warmer' or 'try a different background'.",
  {
    dirName: z.string(),
    theme: z.enum(THEME_NAMES).describe("Theme id. Call describe_capabilities for descriptions."),
    accent: z.string().optional().describe("Override just the accent, keeping the theme otherwise."),
    background: z.string().optional().describe("Override just the backdrop colour."),
    backdrop: z
      .record(z.any())
      .optional()
      .describe(
        "Fine-tune the backdrop: hue, hueSpread, intensity, speed, dots, grid, spotlight, aurora, beams, grain, vignette.",
      ),
  },
  tool(async ({ dirName, theme, accent, background, backdrop }) => {
    const { project } = await load(dirName);

    const overrides = {
      ...(accent ? { accent } : {}),
      ...(background ? { background } : {}),
      ...(backdrop ? { backdrop } : {}),
    };

    const next = {
      ...project,
      theme: {
        preset: theme,
        ...(Object.keys(overrides).length ? { overrides } : {}),
      },
    };

    return text(await commit(dirName, next, { theme: next.theme }));
  }),
);

/* ------------------------------------------------------------------ *
 * Scenes
 * ------------------------------------------------------------------ */

const cameraSchema = z
  .object({
    move: z.enum(["none", "push", "pull", "pan"]),
    amount: z.number().describe("Fractional travel, e.g. 0.08 = an 8% push."),
  })
  .optional();

const transitionSchema = z
  .object({
    type: z.enum(["none", "fade", "blur", "slide", "wipe"]),
    durationInFrames: z.number().int().describe("Frames of overlap with the NEXT scene."),
  })
  .optional();

server.tool(
  "add_scene",
  "Append or insert a scene. Returns its id and where it lands on the timeline.",
  {
    dirName: z.string(),
    name: z.string(),
    durationInFrames: z.number().int().describe("Length of the scene itself."),
    atIndex: z.number().int().optional().describe("Insert position. Omit to append."),
    camera: cameraSchema,
    transition: transitionSchema,
  },
  tool(async ({ dirName, name, durationInFrames, atIndex, camera, transition }) => {
    const { project } = await load(dirName);
    const scene = createScene({ name, durationInFrames, camera, transition });

    const scenes = [...project.scenes];
    scenes.splice(atIndex ?? scenes.length, 0, scene);

    const next = { ...project, scenes };
    const timings = sceneTimings(next);
    const index = scenes.findIndex((s) => s.id === scene.id);

    return text(
      await commit(dirName, next, {
        sceneId: scene.id,
        sceneIndex: index,
        startsAtFrame: timings[index].from,
      }),
    );
  }),
);

server.tool(
  "update_scene",
  "Change a scene's name, duration, camera move or outgoing transition.",
  {
    dirName: z.string(),
    sceneId: z.string().describe("Scene id, or its 0-based index as a string."),
    name: z.string().optional(),
    durationInFrames: z.number().int().optional(),
    camera: cameraSchema,
    transition: transitionSchema,
  },
  tool(async ({ dirName, sceneId, ...patch }) => {
    const { project } = await load(dirName);
    const index = resolveSceneIndex(project, sceneId);

    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const scenes = [...project.scenes];
    scenes[index] = { ...scenes[index], ...clean };

    const next = { ...project, scenes };
    return text(await commit(dirName, next, { scene: scenes[index] }));
  }),
);

server.tool(
  "delete_scene",
  "Remove a scene and everything in it. The last remaining scene cannot be deleted - a project must always have one.",
  { dirName: z.string(), sceneId: z.string() },
  tool(async ({ dirName, sceneId }) => {
    const { project } = await load(dirName);
    if (project.scenes.length <= 1) {
      throw new Error("Cannot delete the only scene - a project must have at least one.");
    }
    const index = resolveSceneIndex(project, sceneId);
    const scenes = project.scenes.filter((_, i) => i !== index);
    return text(await commit(dirName, { ...project, scenes }));
  }),
);

server.tool(
  "reorder_scenes",
  "Set the scene order explicitly, by ids or indices.",
  {
    dirName: z.string(),
    order: z.array(z.string()).describe("Every scene id (or index), in the desired order."),
  },
  tool(async ({ dirName, order }) => {
    const { project } = await load(dirName);
    if (order.length !== project.scenes.length) {
      throw new Error(
        `order must list all ${project.scenes.length} scenes; received ${order.length}.`,
      );
    }
    const scenes = order.map((ref) => project.scenes[resolveSceneIndex(project, ref)]);
    return text(
      await commit(dirName, { ...project, scenes }, { order: scenes.map((s) => s.name) }),
    );
  }),
);

/* ------------------------------------------------------------------ *
 * Layers
 * ------------------------------------------------------------------ */

const transformSchema = z
  .object({
    x: z.number().optional().describe("Pixels from the centre of frame."),
    y: z.number().optional(),
    scale: z.number().optional(),
    rotate: z.number().optional().describe("Degrees."),
    opacity: z.number().optional().describe("0..1"),
    blur: z.number().optional().describe("Pixels."),
  })
  .optional();

/**
 * Grid placement.
 *
 * This is how alignment is achieved. Without it a layer is centred on its
 * own content and nudged by transform.x, so two layers given the same x have
 * *different* left edges - offset by half the difference in their widths.
 * With a layout, an element's edge comes from the grid rather than from its
 * content, so two layers in column 1 line up exactly whatever is inside them.
 *
 * Prefer a preset. Reach for explicit col/row only when no preset fits.
 */
const layoutSchema = z
  .object({
    preset: z
      .string()
      .optional()
      .describe(
        `Named region. One of: ${LAYOUT_PRESET_NAMES.join(", ")}. Explicit fields below override it.`,
      ),
    col: z.number().int().optional().describe("1-based start column on the 12-column grid."),
    span: z.number().int().optional().describe("Columns spanned."),
    row: z.number().int().optional().describe("1-based start row on the 8-row grid."),
    rowSpan: z.number().int().optional().describe("Rows spanned."),
    align: z.enum(["left", "center", "right"]).optional(),
    valign: z.enum(["top", "middle", "bottom"]).optional(),
    offsetX: z.number().optional().describe("Pixel nudge after the cell is computed. Use sparingly."),
    offsetY: z.number().optional(),
  })
  .optional();

const animationSchema = z
  .object({
    preset: z.string(),
    durationInFrames: z.number().int(),
    delay: z.number().int().optional(),
    distance: z.number().optional(),
    spring: z.boolean().optional(),
  })
  .optional();

server.tool(
  "add_layer",
  "Add a layer to a scene. For type 'component', set props.component to a registered name and props.props to its properties. Times are relative to the scene.",
  {
    dirName: z.string(),
    sceneId: z.string(),
    type: z.enum(["text", "image", "video", "shape", "background", "component"]),
    name: z.string().optional(),
    start: z.number().int().optional().describe("Frames from the scene's start. Default 0."),
    duration: z.number().int().optional().describe("Default: to the end of the scene."),
    layout: layoutSchema,
    transform: transformSchema,
    props: z.record(z.any()).optional().describe("Type-specific properties."),
    enter: animationSchema,
    exit: animationSchema,
  },
  tool(async ({ dirName, sceneId, type, name, start, duration, layout, transform, props, enter, exit }) => {
    const { project } = await load(dirName);
    const index = resolveSceneIndex(project, sceneId);
    const scene = project.scenes[index];

    const { createLayer } = await import("../shared/project.js");
    const layer = createLayer({
      type,
      name: name ?? undefined,
      start: start ?? 0,
      duration: duration ?? scene.durationInFrames - (start ?? 0),
      layout,
      transform,
      props,
      animation: {
        ...(enter ? { enter: { delay: 0, ...enter } } : {}),
        ...(exit ? { exit: { delay: 0, ...exit } } : {}),
      },
    });

    const scenes = [...project.scenes];
    scenes[index] = { ...scene, layers: [...scene.layers, layer] };

    return text(
      await commit(
        dirName,
        { ...project, scenes },
        {
          layerId: layer.id,
          scene: scene.name,
          layersInScene: scenes[index].layers.map((l) => ({ id: l.id, name: l.name, type: l.type })),
        },
      ),
    );
  }),
);

server.tool(
  "update_layer",
  "Patch a layer. `props` merges into the existing props; `transform` merges into the existing transform.",
  {
    dirName: z.string(),
    layerId: z.string(),
    name: z.string().optional(),
    start: z.number().int().optional(),
    duration: z.number().int().optional(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
    layout: layoutSchema,
    transform: transformSchema,
    props: z.record(z.any()).optional(),
    enter: animationSchema,
    exit: animationSchema,
  },
  tool(async ({ dirName, layerId, layout, transform, props, enter, exit, ...rest }) => {
    const { project } = await load(dirName);
    const found = findLayer(project, layerId);
    if (!found) throw new Error(`No layer with id ${layerId}. Use inspect_project to list them.`);

    const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));

    const updated = {
      ...found.layer,
      ...clean,
      ...(layout ? { layout: { ...(found.layer.layout ?? {}), ...layout } } : {}),
      transform: { ...found.layer.transform, ...(transform ?? {}) },
      props: { ...found.layer.props, ...(props ?? {}) },
      animation: {
        ...found.layer.animation,
        ...(enter ? { enter: { delay: 0, ...enter } } : {}),
        ...(exit ? { exit: { delay: 0, ...exit } } : {}),
      },
    };

    const scenes = project.scenes.map((scene) =>
      scene.id === found.scene.id
        ? { ...scene, layers: scene.layers.map((l) => (l.id === layerId ? updated : l)) }
        : scene,
    );

    return text(await commit(dirName, { ...project, scenes }, { layer: updated }));
  }),
);

server.tool(
  "delete_layer",
  "Remove a layer from whichever scene contains it. Find layer ids with inspect_project.",
  { dirName: z.string(), layerId: z.string() },
  tool(async ({ dirName, layerId }) => {
    const { project } = await load(dirName);
    const scenes = project.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.filter((l) => l.id !== layerId),
    }));
    return text(await commit(dirName, { ...project, scenes }));
  }),
);

/**
 * Bulk authoring.
 *
 * The reason this exists: building a five-scene film one tool call at a time
 * is thirty round trips, and an agent that has already decided on the whole
 * storyboard should be able to commit it in one. It also makes the edit
 * atomic - either the whole film lands or none of it does.
 */
server.tool(
  "build_scenes",
  "Author whole scenes in one call - the efficient way to lay down a storyboard. Replaces the project's scenes unless append is true.",
  {
    dirName: z.string(),
    append: z.boolean().optional().describe("Append instead of replacing. Default false."),
    scenes: z
      .array(
        z.object({
          name: z.string(),
          durationInFrames: z.number().int(),
          camera: cameraSchema,
          transition: transitionSchema,
          layers: z.array(
            z.object({
              type: z.enum(["text", "image", "video", "shape", "background", "component"]),
              name: z.string().optional(),
              start: z.number().int().optional(),
              duration: z.number().int().optional(),
              layout: layoutSchema,
              transform: transformSchema,
              props: z.record(z.any()).optional(),
              enter: animationSchema,
              exit: animationSchema,
            }),
          ),
        }),
      )
      .describe("Scenes in order."),
  },
  tool(async ({ dirName, scenes, append = false }) => {
    const { project } = await load(dirName);
    const { createLayer } = await import("../shared/project.js");

    const built = scenes.map((spec) =>
      createScene({
        name: spec.name,
        durationInFrames: spec.durationInFrames,
        camera: spec.camera,
        transition: spec.transition,
        layers: spec.layers.map((l) =>
          createLayer({
            type: l.type,
            name: l.name,
            start: l.start ?? 0,
            duration: l.duration ?? spec.durationInFrames - (l.start ?? 0),
            layout: l.layout,
            transform: l.transform,
            props: l.props,
            animation: {
              ...(l.enter ? { enter: { delay: 0, ...l.enter } } : {}),
              ...(l.exit ? { exit: { delay: 0, ...l.exit } } : {}),
            },
          }),
        ),
      }),
    );

    const next = { ...project, scenes: append ? [...project.scenes, ...built] : built };
    const timings = sceneTimings(next);

    return text(
      await commit(dirName, next, {
        timeline: next.scenes.map((s, i) => ({
          index: i,
          name: s.name,
          from: timings[i].from,
          to: timings[i].to,
          layers: s.layers.length,
        })),
      }),
    );
  }),
);

/* ------------------------------------------------------------------ *
 * Audio
 * ------------------------------------------------------------------ */

server.tool(
  "add_audio",
  "Add an audio clip to the project timeline. Times are absolute project frames.",
  {
    dirName: z.string(),
    src: z.string().describe("Project-relative, e.g. assets/audio/score.mp3"),
    name: z.string().optional(),
    kind: z.enum(["music", "voice", "sfx"]).optional(),
    start: z.number().int().optional(),
    duration: z.number().int().optional(),
    volume: z.number().optional().describe("0..1"),
    fadeIn: z.number().int().optional(),
    fadeOut: z.number().int().optional(),
    trimStart: z.number().int().optional(),
  },
  tool(async ({ dirName, ...clip }) => {
    const { project } = await load(dirName);
    const { createId } = await import("../shared/ids.js");

    const entry = {
      id: createId("aud"),
      kind: clip.kind ?? "music",
      name: clip.name ?? path.basename(clip.src),
      src: clip.src,
      start: clip.start ?? 0,
      duration: clip.duration ?? projectDurationInFrames(project),
      trimStart: clip.trimStart ?? 0,
      volume: clip.volume ?? 1,
      fadeIn: clip.fadeIn ?? 0,
      fadeOut: clip.fadeOut ?? 0,
      muted: false,
      solo: false,
    };

    return text(
      await commit(dirName, { ...project, audio: [...project.audio, entry] }, { audioId: entry.id }),
    );
  }),
);

/* ------------------------------------------------------------------ *
 * Files and assets
 * ------------------------------------------------------------------ */

server.tool(
  "list_files",
  "List files inside a project directory. Sandboxed to the project.",
  { dirName: z.string(), path: z.string().optional().describe("Subdirectory. Default the root.") },
  tool(async ({ dirName, path: rel }) => text(await store.listProjectFiles(ROOT, dirName, rel))),
);

server.tool(
  "read_file",
  "Read a text file from inside a project.",
  { dirName: z.string(), path: z.string() },
  tool(async ({ dirName, path: rel }) => text(await store.readProjectFile(ROOT, dirName, rel))),
);

server.tool(
  "write_file",
  "Write a text file inside a project. Use for notes, storyboards and custom component sources.",
  { dirName: z.string(), path: z.string(), content: z.string() },
  tool(async ({ dirName, path: rel, content }) =>
    text(await store.writeTextFile(ROOT, dirName, rel, content)),
  ),
);

server.tool(
  "list_assets",
  "Every media file physically present in the project, whether or not it is registered in the model.",
  { dirName: z.string() },
  tool(async ({ dirName }) => text(await store.scanAssets(ROOT, dirName))),
);

server.tool(
  "import_asset",
  "Copy a file from anywhere on disk into the project's asset folder. Assets are copied, never referenced in place, so a project stays self-contained.",
  { dirName: z.string(), sourcePath: z.string().describe("Absolute path to the source file.") },
  tool(async ({ dirName, sourcePath }) => text(await store.importAsset(ROOT, dirName, sourcePath))),
);

/* ------------------------------------------------------------------ *
 * Seeing and rendering
 * ------------------------------------------------------------------ */

server.tool(
  "render_frame",
  "Render one frame and return it as an image. Use this constantly - it is how you see what you are composing. Frame numbers are absolute on the project timeline.",
  {
    dirName: z.string(),
    frame: z.number().int().describe("Absolute project frame. Clamped to the project length."),
    scale: z.number().optional().describe("0.1..1. Default 0.5, which is plenty to judge composition."),
  },
  tool(async ({ dirName, frame, scale = 0.5 }) => {
    const { project, dir } = await load(dirName);
    const out = resolveInProject(dir, `cache/frame-${frame}.png`);
    const result = await renderFrame({ project, frame, outputPath: out, scale });

    return image(
      result.path,
      `Frame ${result.frame} of ${projectDurationInFrames(project)} (${formatTimecode(
        result.frame,
        project.composition.fps,
      )}) at ${result.width}x${result.height}`,
    );
  }),
);

server.tool(
  "render_contact_sheet",
  "Render the midpoint of every scene and return them as images. The fastest way to review a whole film's composition and spot an empty or unbalanced shot.",
  {
    dirName: z.string(),
    scale: z.number().optional().describe("0.1..1. Default 0.3."),
  },
  tool(async ({ dirName, scale = 0.3 }) => {
    const { project, dir } = await load(dirName);
    const outputDir = resolveInProject(dir, "cache/contact");
    const shots = await renderContactSheet({ project, outputDir, scale });

    const content = [
      {
        type: "text",
        text: `${shots.length} scenes, ${formatTimecode(
          projectDurationInFrames(project),
          project.composition.fps,
        )} total`,
      },
    ];
    for (const shot of shots) {
      content.push({ type: "text", text: `Scene ${shot.index + 1}: ${shot.scene} (frame ${shot.frame})` });
      content.push({
        type: "image",
        data: (await fs.readFile(shot.path)).toString("base64"),
        mimeType: "image/png",
      });
    }
    return { content };
  }),
);

server.tool(
  "render_video",
  "Start rendering the project to a video file. Returns a jobId immediately - rendering takes minutes and would exceed an MCP client's request timeout. Poll render_status with the jobId until it reports done.",
  {
    dirName: z.string(),
    format: z.enum(["mp4", "webm"]).optional(),
    scale: z.number().optional().describe("1 = full size. 0.5 renders a quick draft in a quarter of the time."),
    crf: z.number().optional().describe("Quality; lower is better. Default 20, 18 is near-lossless."),
    filename: z.string().optional().describe("Output name inside renders/. Defaults to the project name."),
  },
  tool(async ({ dirName, format = "mp4", scale = 1, crf = 20, filename }) => {
    const { project, dir } = await load(dirName);

    const safe = (filename ?? project.name).replace(/[^\w .-]+/g, "").trim() || "render";
    const relative = `renders/${safe}.${format}`;
    const outputPath = resolveInProject(dir, relative);

    const frames = projectDurationInFrames(project);
    const { jobId } = startRenderJob({
      project,
      outputPath,
      format,
      scale,
      crf,
      label: project.name,
    });

    return text({
      jobId,
      status: "rendering",
      totalFrames: frames,
      projectRelative: relative,
      note: "Poll render_status with this jobId. A 1080p render runs at roughly 1-3 frames per second.",
    });
  }),
);

server.tool(
  "render_status",
  "Check a render started by render_video. Reports progress while running, and the output path and file size once done.",
  { jobId: z.string().optional().describe("Omit to list every render this session.") },
  tool(async ({ jobId }) => {
    if (!jobId) {
      return text(
        listRenderJobs().map((j) => ({
          jobId: j.id,
          label: j.label,
          status: j.status,
          progress: Number(j.progress.toFixed(3)),
        })),
      );
    }

    const job = getRenderJob(jobId);
    if (!job) {
      const known = listRenderJobs().map((j) => j.id);
      throw new Error(
        `No render job "${jobId}". Jobs this session: ${known.length ? known.join(", ") : "(none)"}`,
      );
    }

    return text({
      jobId: job.id,
      status: job.status,
      progress: Number(job.progress.toFixed(3)),
      renderedFrames: job.renderedFrames,
      totalFrames: job.totalFrames,
      ...(job.status === "done" ? { output: job.result } : {}),
      ...(job.error ? { error: job.error } : {}),
    });
  }),
);

/* ------------------------------------------------------------------ *
 * Utilities
 * ------------------------------------------------------------------ */

server.tool(
  "timeline",
  "A compact timeline view: where every scene and audio clip sits, in frames and timecode.",
  { dirName: z.string() },
  tool(async ({ dirName }) => {
    const { project } = await load(dirName);
    const timings = sceneTimings(project);
    const { fps } = project.composition;

    return text({
      durationInFrames: projectDurationInFrames(project),
      durationTimecode: formatTimecode(projectDurationInFrames(project), fps),
      fps,
      scenes: project.scenes.map((scene, i) => ({
        index: i,
        name: scene.name,
        from: timings[i].from,
        to: timings[i].to,
        timecode: `${formatTimecode(timings[i].from, fps)} - ${formatTimecode(timings[i].to, fps)}`,
        durationInFrames: scene.durationInFrames,
        transitionOut: scene.transition.type === "none" ? null : scene.transition,
        layers: scene.layers.length,
      })),
      audio: project.audio.map((clip) => ({
        name: clip.name,
        kind: clip.kind,
        from: clip.start,
        to: clip.start + clip.duration,
      })),
    });
  }),
);

/**
 * Resolve a scene reference that may be an id or a stringified index.
 *
 * Accepting both is a small kindness with a real payoff: an agent that has
 * just called `inspect_project` has indices in front of it and will use
 * them, and failing that call costs a turn to correct.
 */
function resolveSceneIndex(project, ref) {
  const byId = project.scenes.findIndex((s) => s.id === ref);
  if (byId !== -1) return byId;

  const asIndex = Number(ref);
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < project.scenes.length) {
    return asIndex;
  }

  throw new Error(
    `No scene "${ref}". Scenes: ${project.scenes
      .map((s, i) => `${i}:${s.name} (${s.id})`)
      .join(", ")}`,
  );
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

/**
 * A background render must never take the server down.
 *
 * Renders run detached from the tool call that started them, so a failure -
 * a missing browser, a full disk - surfaces as an unhandled rejection rather
 * than as a thrown error some caller is awaiting. Without these guards the
 * process exits, the agent's session dies mid-composition, and it loses the
 * project state it was holding. The job itself already records its own
 * failure for `render_status` to report.
 *
 * stderr only: stdout is the protocol stream.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[rawmotion] unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[rawmotion] uncaught exception:", error);
});

const transport = new StdioServerTransport();
await server.connect(transport);

/**
 * Exit when the client goes away.
 *
 * A stdio server has exactly one client - the process on the other end of
 * the pipe - and no reason to exist without it. This is not tidiness. Render
 * jobs are deliberately detached from the tool call that started them, so
 * they survive the call; without this they also survive the *client*, and an
 * orphaned server keeps every queued render running with nobody able to read
 * its status or stop it. Found the hard way: a killed client left five
 * concurrent 1080p renders saturating the machine, reachable only by PID.
 *
 * `stdin` ending is the signal.
 *
 * Where we lead our own process group, signalling the group takes the
 * browser and ffmpeg children a render spawns down with us. Where we do not
 * - the ordinary case, since a client spawns us as a plain child - the
 * group belongs to the *client*, and signalling it would kill processes
 * that are none of our business. So that path is taken only when the check
 * says the group is ours; otherwise exiting is enough, and the renderer's
 * own exit handlers reap what they started.
 */
function shutdown(reason) {
  console.error(`[rawmotion] ${reason}; exiting.`);
  try {
    if (typeof process.getpgrp === "function" && process.getpgrp() === process.pid) {
      process.kill(-process.pid, "SIGTERM");
    }
  } catch {
    // Best effort. Our own exit is the part that matters.
  }
  process.exit(0);
}

process.stdin.on("close", () => shutdown("client disconnected"));
process.stdin.on("end", () => shutdown("client closed stdin"));

// stderr only - stdout is the MCP transport, and anything written there
// corrupts the protocol stream.
console.error(`[rawmotion] MCP server ready. Workspace: ${ROOT}`);
