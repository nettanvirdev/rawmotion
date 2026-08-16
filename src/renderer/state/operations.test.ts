import { describe, expect, it } from "vitest";
import { createLayer, createProject, createScene } from "@shared/project.js";
import * as ops from "./operations";

/**
 * Project operations back both the UI and, eventually, the MCP tools, so
 * they are the layer where a bug corrupts a user's document rather than just
 * misdrawing something. The two properties that matter most are immutability
 * (undo keeps old snapshots alive and must not see them mutated) and the
 * clamping rules that keep the model self-consistent.
 */

function project() {
  return createProject({
    name: "T",
    scenes: [
      createScene({
        name: "One",
        durationInFrames: 100,
        layers: [
          createLayer({ type: "text", name: "A", start: 0, duration: 50 }),
          createLayer({ type: "shape", name: "B", start: 10, duration: 30 }),
        ],
      }),
      createScene({ name: "Two", durationInFrames: 60 }),
    ],
  });
}

describe("immutability", () => {
  it("never mutates the input project", () => {
    const before = project();
    const snapshot = JSON.stringify(before);
    const layerId = before.scenes[0].layers[0].id;

    ops.updateLayer(before, layerId, { name: "changed" });
    ops.updateLayerTransform(before, layerId, { x: 99 });
    ops.updateLayerProps(before, layerId, { text: "changed" });
    ops.setLayerTiming(before, layerId, { start: 5 });
    ops.addScene(before);
    ops.duplicateScene(before, before.scenes[0].id);
    ops.removeLayer(before, layerId);
    ops.moveScene(before, before.scenes[0].id, 1);
    ops.addAudio(before, { name: "x" });

    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("returns the same reference when nothing changes", () => {
    // projectStore.apply relies on this to avoid pushing no-op undo entries.
    const single = createProject({ name: "T" });
    expect(ops.removeScene(single, single.scenes[0].id)).toBe(single);
  });
});

describe("scenes", () => {
  it("refuses to delete the last scene", () => {
    const single = createProject({ name: "T" });
    expect(ops.removeScene(single, single.scenes[0].id).scenes).toHaveLength(1);
  });

  it("deletes a scene when others remain", () => {
    const p = project();
    expect(ops.removeScene(p, p.scenes[0].id).scenes.map((s) => s.name)).toEqual(["Two"]);
  });

  it("duplicates a scene with fresh ids throughout", () => {
    const p = project();
    const next = ops.duplicateScene(p, p.scenes[0].id);

    expect(next.scenes).toHaveLength(3);
    const [original, copy] = next.scenes;
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).not.toBe(original.name);

    // Nested layer ids must be fresh too, or selection and React keys
    // collide between the original and the copy.
    const originalIds = new Set(original.layers.map((l) => l.id));
    for (const layer of copy.layers) {
      expect(originalIds.has(layer.id)).toBe(false);
    }
    expect(copy.layers).toHaveLength(original.layers.length);
  });

  it("inserts a duplicate directly after its source", () => {
    const p = project();
    const next = ops.duplicateScene(p, p.scenes[0].id);
    expect(next.scenes[1].name).toBe("One copy");
  });

  it("reorders scenes", () => {
    const p = project();
    expect(ops.moveScene(p, p.scenes[0].id, 1).scenes.map((s) => s.name)).toEqual([
      "Two",
      "One",
    ]);
  });

  it("clamps an out-of-range move target", () => {
    const p = project();
    expect(ops.moveScene(p, p.scenes[0].id, 99).scenes.map((s) => s.name)).toEqual([
      "Two",
      "One",
    ]);
  });
});

describe("layer timing", () => {
  it("keeps a layer inside its scene when moved past the end", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    const layer = ops.setLayerTiming(p, id, { start: 500 }).scenes[0].layers[0];

    expect(layer.start).toBeLessThan(100);
    expect(layer.start + layer.duration).toBeLessThanOrEqual(100);
  });

  it("clamps a negative start to zero", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    expect(ops.setLayerTiming(p, id, { start: -40 }).scenes[0].layers[0].start).toBe(0);
  });

  it("never allows a duration below one frame", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    expect(ops.setLayerTiming(p, id, { duration: 0 }).scenes[0].layers[0].duration).toBe(1);
    expect(ops.setLayerTiming(p, id, { duration: -9 }).scenes[0].layers[0].duration).toBe(1);
  });

  it("truncates a duration that would overflow the scene", () => {
    const p = project();
    const id = p.scenes[0].layers[1].id; // starts at 10
    const layer = ops.setLayerTiming(p, id, { duration: 1000 }).scenes[0].layers[1];
    expect(layer.start + layer.duration).toBe(100);
  });
});

describe("layers", () => {
  it("adds a layer with a unique name within its scene", () => {
    const p = project();
    const { project: next } = ops.addLayer(p, p.scenes[0].id, { type: "text", name: "A" });
    const names = next.scenes[0].layers.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("defaults a new layer to the length of its scene", () => {
    const p = project();
    const { project: next } = ops.addLayer(p, p.scenes[1].id, { type: "shape" });
    expect(next.scenes[1].layers[0].duration).toBe(60);
  });

  it("ignores an unknown scene", () => {
    const p = project();
    expect(ops.addLayer(p, "scn_nope", { type: "text" }).project).toBe(p);
  });

  it("duplicates a layer without sharing nested objects", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    const { project: next, layerId } = ops.duplicateLayer(p, id);

    const copy = next.scenes[0].layers.find((l) => l.id === layerId)!;
    const original = next.scenes[0].layers.find((l) => l.id === id)!;

    expect(copy.transform).not.toBe(original.transform);
    expect(copy.props).not.toBe(original.props);
    expect(copy.transform).toEqual(original.transform);
  });

  it("reorders layers, which is z-order", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    expect(ops.moveLayer(p, id, 1).scenes[0].layers.map((l) => l.name)).toEqual(["B", "A"]);
  });
});

describe("animation", () => {
  it("creates an animation from a partial patch", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    const layer = ops.updateLayerAnimation(p, id, "enter", { preset: "blurIn" })
      .scenes[0].layers[0];

    expect(layer.animation.enter?.preset).toBe("blurIn");
    expect(layer.animation.enter?.durationInFrames).toBeGreaterThan(0);
  });

  it("removes an animation when patched with null", () => {
    const p = project();
    const id = p.scenes[0].layers[0].id;
    const withEnter = ops.updateLayerAnimation(p, id, "enter", { preset: "fade" });
    const without = ops.updateLayerAnimation(withEnter, id, "enter", null);

    expect(without.scenes[0].layers[0].animation.enter).toBeUndefined();
  });
});

describe("audio", () => {
  it("adds and removes clips", () => {
    const p = project();
    const { project: withAudio, audioId } = ops.addAudio(p, { name: "Score", src: "a.mp3" });
    expect(withAudio.audio).toHaveLength(1);
    expect(ops.removeAudio(withAudio, audioId).audio).toHaveLength(0);
  });
});

describe("registerAssets", () => {
  it("skips paths already registered", () => {
    const p = project();
    const rows = [{ kind: "image", name: "a.png", src: "assets/images/a.png" }];

    const once = ops.registerAssets(p, rows);
    expect(once.assets).toHaveLength(1);

    // Re-importing the same file must be idempotent.
    const twice = ops.registerAssets(once, rows);
    expect(twice).toBe(once);
  });
});
