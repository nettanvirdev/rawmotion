import { describe, expect, it } from "vitest";
import { oscillate, progress, seededRandom, staggerDelay, blurFilter, mix } from "./timing";
import { evaluatePreset, layerMotion, presetExists } from "./presets";

/**
 * The motion primitives are pure and are evaluated once per layer per frame,
 * so a subtle error here is invisible in review and obvious in the output.
 * These cover the properties the composition actually relies on.
 */

describe("progress", () => {
  it("clamps outside its window", () => {
    expect(progress(-10, 0, 20)).toBe(0);
    expect(progress(100, 0, 20)).toBe(1);
  });

  it("starts at 0 and ends at 1", () => {
    expect(progress(0, 0, 20)).toBeCloseTo(0, 5);
    expect(progress(20, 0, 20)).toBeCloseTo(1, 5);
  });

  it("is monotonic across its window", () => {
    let previous = -1;
    for (let f = 0; f <= 20; f += 1) {
      const value = progress(f, 0, 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("treats a zero-length window as an instant step", () => {
    // Guards against a divide-by-zero producing NaN, which would blank a
    // layer rather than snapping it on.
    expect(progress(-1, 0, 0)).toBe(0);
    expect(progress(0, 0, 0)).toBe(1);
    expect(progress(5, 0, 0)).toBe(1);
  });
});

describe("staggerDelay", () => {
  it("gives the first item no delay", () => {
    expect(staggerDelay(0, 10)).toBe(0);
  });

  it("returns 0 for a group of one", () => {
    expect(staggerDelay(0, 1)).toBe(0);
  });

  it("keeps the whole stagger inside maxSpan", () => {
    // The reason the function exists: a 60-character headline must not take
    // 60 x step frames to reveal.
    const total = 60;
    const last = staggerDelay(total - 1, total, 2, 24);
    expect(last).toBeLessThanOrEqual(24 + 1e-9);
  });

  it("does not compress a group that already fits", () => {
    expect(staggerDelay(3, 5, 2, 100)).toBe(6);
  });

  it("increases monotonically with index", () => {
    const delays = Array.from({ length: 12 }, (_, i) => staggerDelay(i, 12));
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

describe("determinism", () => {
  it("seededRandom is stable and in range", () => {
    // A composition must render byte-identically in preview and in export.
    for (let seed = 0; seed < 50; seed += 1) {
      const a = seededRandom(seed);
      expect(a).toBe(seededRandom(seed));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it("seededRandom differs across nearby seeds", () => {
    const values = new Set(Array.from({ length: 40 }, (_, i) => seededRandom(i)));
    expect(values.size).toBeGreaterThan(35);
  });

  it("oscillate stays within 0..1 and repeats on its period", () => {
    for (let f = 0; f < 200; f += 7) {
      const value = oscillate(f, 60);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(oscillate(0, 60)).toBeCloseTo(oscillate(60, 60), 6);
  });
});

describe("blurFilter", () => {
  it("returns undefined for no blur, so no compositing layer is created", () => {
    expect(blurFilter(0)).toBeUndefined();
    expect(blurFilter(0.001)).toBeUndefined();
  });

  it("returns a css filter when there is blur", () => {
    expect(blurFilter(4)).toBe("blur(4.00px)");
  });
});

describe("presets", () => {
  const args = {
    fps: 30,
    duration: 20,
    distance: 50,
    useSpring: false,
    direction: 1 as const,
  };

  it("an entrance resolves to the neutral state once complete", () => {
    const delta = evaluatePreset("riseFade", { ...args, frame: 20 });
    expect(delta.opacity).toBeCloseTo(1, 4);
    expect(delta.y).toBeCloseTo(0, 4);
    expect(delta.scale).toBeCloseTo(1, 4);
  });

  it("an entrance starts offset", () => {
    const delta = evaluatePreset("riseFade", { ...args, frame: 0 });
    expect(delta.opacity).toBeCloseTo(0, 4);
    expect(delta.y).toBeCloseTo(50, 4);
  });

  it("an exit runs the curve backwards", () => {
    const start = evaluatePreset("riseFade", { ...args, frame: 0, direction: -1 });
    const end = evaluatePreset("riseFade", { ...args, frame: 20, direction: -1 });
    expect(start.opacity).toBeCloseTo(1, 4);
    expect(end.opacity).toBeCloseTo(0, 4);
  });

  it("falls back to fade for an unknown preset instead of throwing", () => {
    // Preset names come from project.json and may be hand-written.
    expect(presetExists("nonsense")).toBe(false);
    const delta = evaluatePreset("nonsense", { ...args, frame: 10 });
    expect(Number.isFinite(delta.opacity)).toBe(true);
  });

  it("never produces NaN for any preset at any point in its window", () => {
    for (const preset of ["fade", "riseFade", "scaleIn", "blurIn", "depthIn", "driftIn", "tiltIn"]) {
      for (const frame of [-5, 0, 7, 20, 40]) {
        const delta = evaluatePreset(preset, { ...args, frame });
        for (const [key, value] of Object.entries(delta)) {
          expect(Number.isFinite(value), `${preset}.${key} at ${frame}`).toBe(true);
        }
      }
    }
  });
});

describe("layerMotion", () => {
  it("is neutral with no animations", () => {
    expect(layerMotion(10, 90, 30)).toEqual({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      blur: 0,
    });
  });

  it("anchors the exit to the end of the layer", () => {
    const duration = 90;
    const exit = { preset: "fade", durationInFrames: 20, delay: 0 };

    // Mid-layer the exit has not begun.
    expect(layerMotion(40, duration, 30, undefined, exit).opacity).toBeCloseTo(1, 4);
    // It completes exactly at the out point.
    expect(layerMotion(duration, duration, 30, undefined, exit).opacity).toBeCloseTo(0, 4);
  });

  it("composes an entrance and an exit multiplicatively", () => {
    const enter = { preset: "fade", durationInFrames: 20, delay: 0 };
    const exit = { preset: "fade", durationInFrames: 20, delay: 0 };

    // A very short layer where the two windows overlap must still produce a
    // sane opacity rather than exceeding 1 or going negative.
    for (let frame = 0; frame <= 25; frame += 1) {
      const { opacity } = layerMotion(frame, 25, 30, enter, exit);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });

  it("respects an entrance delay", () => {
    const enter = { preset: "fade", durationInFrames: 10, delay: 15 };
    expect(layerMotion(5, 90, 30, enter).opacity).toBeCloseTo(0, 4);
    expect(layerMotion(25, 90, 30, enter).opacity).toBeCloseTo(1, 4);
  });
});

describe("mix", () => {
  it("interpolates between endpoints", () => {
    expect(mix(0, 10, 20)).toBe(10);
    expect(mix(1, 10, 20)).toBe(20);
    expect(mix(0.5, 10, 20)).toBe(15);
  });
});
