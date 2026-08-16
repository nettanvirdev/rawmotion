import { describe, expect, it } from "vitest";
import {
  createLayer,
  createProject,
  createScene,
  findLayer,
  formatTimecode,
  normalizeProject,
  projectDurationInFrames,
  sceneAtFrame,
  sceneTimings,
  serializeProject,
  transitionOverlap,
} from "./project.js";

/**
 * The project model is the contract every other subsystem depends on, so
 * these tests concentrate on the two things that would break silently and
 * expensively: timeline arithmetic, and normalisation of hand-edited files.
 */

describe("timeline arithmetic", () => {
  const build = (scenes) => createProject({ name: "T", scenes });

  it("lays scenes end to end when there are no transitions", () => {
    const project = build([
      createScene({ durationInFrames: 30 }),
      createScene({ durationInFrames: 45 }),
    ]);

    expect(sceneTimings(project).map((t) => [t.from, t.to])).toEqual([
      [0, 30],
      [30, 75],
    ]);
    expect(projectDurationInFrames(project)).toBe(75);
  });

  it("treats a transition as an overlap, shortening the project", () => {
    const project = build([
      createScene({ durationInFrames: 30, transition: { type: "fade", durationInFrames: 10 } }),
      createScene({ durationInFrames: 30 }),
    ]);

    // Without the overlap this would be 60. The 10 shared frames are the
    // whole point of a cross dissolve.
    expect(projectDurationInFrames(project)).toBe(50);
    expect(sceneTimings(project)[1].from).toBe(20);
  });

  it("ignores a transition on the final scene", () => {
    const project = build([
      createScene({ durationInFrames: 30, transition: { type: "fade", durationInFrames: 10 } }),
    ]);
    expect(projectDurationInFrames(project)).toBe(30);
  });

  it("clamps an overlap longer than either neighbour", () => {
    // A 90-frame transition between two 20-frame scenes would otherwise
    // place the second scene before the first begins.
    const a = createScene({ durationInFrames: 20, transition: { type: "fade", durationInFrames: 90 } });
    const b = createScene({ durationInFrames: 20 });
    expect(transitionOverlap(a, b)).toBe(20);

    const project = build([a, b]);
    expect(sceneTimings(project)[1].from).toBe(0);
    expect(projectDurationInFrames(project)).toBe(20);
  });

  it("has no upper bound on duration", () => {
    // 30 minutes at 30fps. The point of the assertion is that nothing in
    // the model caps or wraps a long project.
    const scenes = Array.from({ length: 60 }, () => createScene({ durationInFrames: 900 }));
    expect(projectDurationInFrames(build(scenes))).toBe(54_000);
  });

  it("never reports a duration below one frame", () => {
    // Remotion refuses to mount a zero-frame composition.
    const empty = normalizeProject({ scenes: [] });
    expect(projectDurationInFrames(empty)).toBeGreaterThanOrEqual(1);
  });

  it("resolves the incoming scene during a transition", () => {
    const project = build([
      createScene({ name: "A", durationInFrames: 30, transition: { type: "fade", durationInFrames: 10 } }),
      createScene({ name: "B", durationInFrames: 30 }),
    ]);

    expect(sceneAtFrame(project, 5)?.scene.name).toBe("A");
    // Frame 20 is where B starts and A is still playing underneath.
    expect(sceneAtFrame(project, 20)?.scene.name).toBe("B");
    expect(sceneAtFrame(project, 25)?.scene.name).toBe("B");
  });
});

describe("normalizeProject", () => {
  it("rejects a non-object root", () => {
    expect(() => normalizeProject(null)).toThrow();
    expect(() => normalizeProject([])).toThrow();
    expect(() => normalizeProject("nope")).toThrow();
  });

  it("repairs a project with no scenes", () => {
    // A hand-edited file that deleted every scene must still open.
    expect(normalizeProject({ name: "x" }).scenes).toHaveLength(1);
  });

  it("fills in missing layer fields rather than dropping the layer", () => {
    const project = normalizeProject({
      scenes: [{ durationInFrames: 60, layers: [{ type: "text", props: { text: "hi" } }] }],
    });

    const layer = project.scenes[0].layers[0];
    expect(layer.props.text).toBe("hi");
    // Defaults merged in beneath the supplied props.
    expect(layer.props.fontSize).toBeTypeOf("number");
    expect(layer.transform.opacity).toBe(1);
    expect(layer.id).toMatch(/^lyr_/);
  });

  it("falls back to a known type for an unrecognised layer type", () => {
    const project = normalizeProject({
      scenes: [{ layers: [{ type: "hologram" }] }],
    });
    expect(project.scenes[0].layers[0].type).toBe("text");
  });

  it("clamps out-of-range values", () => {
    const project = normalizeProject({
      composition: { width: -5, height: 1e9, fps: 0 },
      scenes: [{ durationInFrames: -100, layers: [{ type: "text", transform: { opacity: 4 } }] }],
    });

    expect(project.composition.width).toBe(16);
    expect(project.composition.height).toBe(7680);
    expect(project.composition.fps).toBe(1);
    expect(project.scenes[0].durationInFrames).toBeGreaterThanOrEqual(1);
    expect(project.scenes[0].layers[0].transform.opacity).toBe(1);
  });

  it("drops an animation with no preset", () => {
    const project = normalizeProject({
      scenes: [{ layers: [{ type: "text", animation: { enter: { durationInFrames: 10 } } }] }],
    });
    expect(project.scenes[0].layers[0].animation.enter).toBeUndefined();
  });

  it("is idempotent", () => {
    // Normalising a normalised project must not keep changing it, or every
    // save would produce a diff.
    const once = normalizeProject(createProject({ name: "T", now: "2020-01-01T00:00:00.000Z" }));
    const twice = normalizeProject(once);
    expect(serializeProject(twice)).toBe(serializeProject(once));
  });
});

describe("serialization", () => {
  it("round-trips through JSON without loss", () => {
    const project = createProject({
      name: "Round trip",
      scenes: [
        createScene({
          name: "S",
          durationInFrames: 90,
          layers: [
            createLayer({
              type: "component",
              props: { component: "HeroTitle", props: { text: "Hello" } },
              animation: { enter: { preset: "depthIn", durationInFrames: 20, delay: 3 } },
            }),
          ],
        }),
      ],
    });

    const restored = normalizeProject(JSON.parse(serializeProject(project)));
    expect(restored.scenes[0].layers[0].props.props).toEqual({ text: "Hello" });
    expect(restored.scenes[0].layers[0].animation.enter?.delay).toBe(3);
    expect(projectDurationInFrames(restored)).toBe(projectDurationInFrames(project));
  });

  it("emits stable key order so saves produce minimal diffs", () => {
    const project = createProject({ name: "T", now: "2020-01-01T00:00:00.000Z" });
    const reordered = {
      meta: project.meta,
      scenes: project.scenes,
      name: project.name,
      id: project.id,
      composition: project.composition,
      audio: project.audio,
      assets: project.assets,
      version: project.version,
      $schema: project.$schema,
    };
    expect(serializeProject(reordered)).toBe(serializeProject(project));
  });

  it("ends with a newline", () => {
    expect(serializeProject(createProject({ name: "T" })).endsWith("}\n")).toBe(true);
  });
});

describe("lookups", () => {
  it("finds a layer and its containing scene", () => {
    const layer = createLayer({ type: "shape", name: "Target" });
    const project = createProject({
      name: "T",
      scenes: [createScene({ name: "A" }), createScene({ name: "B", layers: [layer] })],
    });

    const found = findLayer(project, project.scenes[1].layers[0].id);
    expect(found?.scene.name).toBe("B");
    expect(found?.sceneIndex).toBe(1);
  });

  it("returns null for an unknown layer", () => {
    expect(findLayer(createProject({ name: "T" }), "lyr_nope")).toBeNull();
  });
});

describe("formatTimecode", () => {
  it("formats as MM:SS:FF", () => {
    expect(formatTimecode(0, 30)).toBe("00:00:00");
    expect(formatTimecode(45, 30)).toBe("00:01:15");
    expect(formatTimecode(3600, 30)).toBe("02:00:00");
  });

  it("survives a zero or negative fps without dividing by zero", () => {
    expect(formatTimecode(10, 0)).toMatch(/^\d\d:\d\d:\d\d$/);
  });
});
