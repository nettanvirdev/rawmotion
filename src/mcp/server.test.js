import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The MCP server, exercised through a real client over a real stdio
 * transport - not by importing its handlers.
 *
 * The transport is most of what can break: a stray `console.log` in any
 * module the server imports corrupts the protocol stream, and that failure
 * is invisible to any test that calls the handlers directly. Spawning the
 * process is the only way to catch it.
 *
 * The last test here is the important one. It asserts the product's central
 * claim end to end: an agent edits a project over MCP, and a watcher in a
 * *different process* - which is what the desktop app is - sees the change.
 */

const SERVER = fileURLToPath(new URL("./server.js", import.meta.url));

let workspace;
let client;

beforeAll(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "rawmotion-mcp-"));

  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      env: { ...process.env, RAWMOTION_WORKSPACE: workspace },
    }),
  );
}, 30_000);

afterAll(async () => {
  await client?.close();
  await fs.rm(workspace, { recursive: true, force: true });
});

/** Call a tool and parse its JSON payload, failing loudly on a tool error. */
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
}

describe("transport", () => {
  it("exposes the documented tool surface", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    for (const required of [
      "list_projects",
      "describe_capabilities",
      "create_project",
      "inspect_project",
      "build_scenes",
      "add_layer",
      "update_layer",
      "render_frame",
      "render_video",
      "timeline",
    ]) {
      expect(names, required).toContain(required);
    }
  });

  it("gives every tool a description an agent can act on", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.description, t.name).toBeTruthy();
      expect(t.description.length, t.name).toBeGreaterThan(30);
    }
  });
});

describe("capabilities", () => {
  it("reports a vocabulary that matches the engine", async () => {
    const caps = await call("describe_capabilities");

    expect(Object.keys(caps.components).length).toBeGreaterThan(8);
    expect(caps.backgroundKinds).toContain("depth");
    expect(caps.animationPresets.map((p) => p.value)).toContain("depthIn");
    expect(caps.layerTypes).toContain("component");

    // Every component must carry a prop schema, or an agent has no way to
    // know what it may set.
    for (const [name, spec] of Object.entries(caps.components)) {
      expect(Object.keys(spec.props).length, name).toBeGreaterThan(0);
    }
  });
});

describe("authoring", () => {
  let dirName;

  it("creates a project", async () => {
    const created = await call("create_project", {
      name: "Suite",
      width: 1280,
      height: 720,
      fps: 30,
    });
    dirName = created.dirName;

    expect(dirName).toBe("Suite.rawmotion");
    await expect(
      fs.access(path.join(workspace, dirName, "project.json")),
    ).resolves.toBeUndefined();
  });

  it("builds a storyboard in one call and reports the resulting timeline", async () => {
    const built = await call("build_scenes", {
      dirName,
      scenes: [
        {
          name: "One",
          durationInFrames: 60,
          transition: { type: "fade", durationInFrames: 12 },
          layers: [{ type: "background", props: { kind: "depth" } }],
        },
        {
          name: "Two",
          durationInFrames: 60,
          layers: [{ type: "text", props: { text: "hello" } }],
        },
      ],
    });

    // 60 + 60 - 12 of overlap. The tool returns the consequence of the edit
    // so the agent does not need a second call to learn it.
    expect(built.durationInFrames).toBe(108);
    expect(built.scenes).toBe(2);
    expect(built.timeline[1].from).toBe(48);
  });

  it("defaults a layer's duration to the rest of its scene", async () => {
    const project = await call("inspect_project", { dirName });
    const added = await call("add_layer", {
      dirName,
      sceneId: project.scenes[0].id,
      type: "text",
      start: 10,
      props: { text: "late" },
    });

    const after = await call("inspect_project", { dirName });
    const layer = after.scenes[0].layers.find((l) => l.id === added.layerId);
    expect(layer.start).toBe(10);
    expect(layer.start + layer.duration).toBe(60);
  });

  it("merges patches into props rather than replacing them", async () => {
    const project = await call("inspect_project", { dirName });
    const layer = project.scenes[1].layers[0];

    await call("update_layer", { dirName, layerId: layer.id, props: { fontSize: 80 } });

    const after = await call("inspect_project", { dirName });
    const updated = after.scenes[1].layers[0];
    expect(updated.props.fontSize).toBe(80);
    // The text set earlier must survive a patch that did not mention it.
    expect(updated.props.text).toBe("hello");
  });

  it("accepts a scene index where an id is expected", async () => {
    await call("update_scene", { dirName, sceneId: "0", name: "Renamed" });
    const after = await call("inspect_project", { dirName });
    expect(after.scenes[0].name).toBe("Renamed");
  });

  it("refuses to delete the only scene", async () => {
    const solo = await call("create_project", { name: "Solo" });
    const result = await client.callTool({
      name: "delete_scene",
      arguments: { dirName: solo.dirName, sceneId: "0" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("errors", () => {
  it("lists the available projects when one cannot be opened", async () => {
    const result = await client.callTool({
      name: "inspect_project",
      arguments: { dirName: "Missing.rawmotion" },
    });

    expect(result.isError).toBe(true);
    // The caller is a model that will retry immediately, so the error has to
    // carry the information needed to retry correctly.
    expect(result.content[0].text).toContain("Projects in this workspace");
  });

  it("lists the scenes when a scene reference does not resolve", async () => {
    const created = await call("create_project", { name: "Errors" });
    const result = await client.callTool({
      name: "update_scene",
      arguments: { dirName: created.dirName, sceneId: "nope", name: "x" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No scene "nope"/);
  });

  it("refuses to read outside the project sandbox", async () => {
    const created = await call("create_project", { name: "Sandbox" });
    const result = await client.callTool({
      name: "read_file",
      arguments: { dirName: created.dirName, path: "../../../etc/passwd" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/escape/i);
  });
});

describe("the live loop", () => {
  it("an MCP edit is seen by a watcher in another process", async () => {
    // This is the product's central claim: an agent edits the project and
    // the running desktop app updates. The app is a separate process, so
    // this test runs the watcher here and the edit over there.
    const { watchProject, stopWatching } = await import("../main/project-watcher.js");

    const created = await call("create_project", { name: "Live" });
    const dir = path.join(workspace, created.dirName);

    const seen = new Promise((resolve) => {
      watchProject(dir, (payload) => {
        if (payload.project) resolve(payload.project);
      });
      setTimeout(() => resolve(null), 5000);
    });

    await call("set_composition", { dirName: created.dirName, name: "Edited by an agent" });

    const project = await seen;
    stopWatching();

    expect(project).not.toBeNull();
    expect(project.name).toBe("Edited by an agent");
  }, 20_000);
});
