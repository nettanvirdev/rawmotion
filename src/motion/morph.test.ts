import { describe, expect, it } from "vitest";
import { createLayer, createScene } from "../shared/project.js";
import { diffChars, getPath, numericDiffPaths, planMorph, setPath } from "./morph";

const scene = (layers: Parameters<typeof createLayer>[0][]) =>
  createScene({ layers: layers as never });

describe("planMorph", () => {
  it("pairs by explicit morphId across types", () => {
    const a = scene([
      { type: "shape", name: "Blob", morphId: "hero" },
      { type: "text", name: "Title" },
    ]);
    const b = scene([{ type: "component", name: "Card", morphId: "hero" }]);

    const plan = planMorph(a, b);
    expect(plan.pairs).toHaveLength(1);
    expect(plan.pairs[0].kind).toBe("container");
    expect(plan.fromIds.size).toBe(1);
    expect(plan.toIds.size).toBe(1);
  });

  it("auto-pairs by unique type+name", () => {
    const a = scene([{ type: "text", name: "Headline", props: { text: "Turn" } }]);
    const b = scene([{ type: "text", name: "Headline", props: { text: "Audio" } }]);

    const plan = planMorph(a, b);
    expect(plan.pairs).toHaveLength(1);
    expect(plan.pairs[0].kind).toBe("text");
  });

  it("refuses ambiguous name matches", () => {
    const a = scene([
      { type: "text", name: "Item" },
      { type: "text", name: "Item" },
    ]);
    const b = scene([{ type: "text", name: "Item" }]);
    expect(planMorph(a, b).pairs).toHaveLength(0);
  });

  it("never pairs backgrounds or hidden layers", () => {
    const a = scene([
      { type: "background", name: "BG" },
      { type: "text", name: "T", hidden: true },
    ]);
    const b = scene([
      { type: "background", name: "BG" },
      { type: "text", name: "T" },
    ]);
    expect(planMorph(a, b).pairs).toHaveLength(0);
  });

  it("classifies identical content as move", () => {
    const a = scene([{ type: "component", name: "Card", props: { component: "GlassCard", props: { title: "Hi" } } }]);
    const b = scene([{ type: "component", name: "Card", props: { component: "GlassCard", props: { title: "Hi" } } }]);
    expect(planMorph(a, b).pairs[0].kind).toBe("move");
  });

  it("classifies numeric-only differences as props with paths", () => {
    const a = scene([{ type: "component", name: "Bar", props: { component: "GlassBar", props: { active: 1 } } }]);
    const b = scene([{ type: "component", name: "Bar", props: { component: "GlassBar", props: { active: 3 } } }]);
    const pair = planMorph(a, b).pairs[0];
    expect(pair.kind).toBe("props");
    expect(pair.lerpPaths).toEqual(["props.active"]);
  });

  it("multi-line text falls back to container", () => {
    const a = scene([{ type: "text", name: "T", props: { text: "one\ntwo" } }]);
    const b = scene([{ type: "text", name: "T", props: { text: "three" } }]);
    expect(planMorph(a, b).pairs[0].kind).toBe("container");
  });
});

describe("numericDiffPaths", () => {
  it("returns empty for deep-equal props", () => {
    expect(numericDiffPaths({ a: 1, b: { c: "x" } }, { a: 1, b: { c: "x" } })).toEqual([]);
  });

  it("collects nested numeric paths", () => {
    expect(numericDiffPaths({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 5 } })).toEqual(["b.c"]);
  });

  it("bails on non-numeric differences", () => {
    expect(numericDiffPaths({ a: "x" }, { a: "y" })).toBeNull();
  });
});

describe("path helpers", () => {
  it("round-trips nested paths without mutating", () => {
    const obj = { a: { b: 1 }, c: 2 };
    const next = setPath(obj, "a.b", 9);
    expect(getPath(next, "a.b")).toBe(9);
    expect(obj.a.b).toBe(1);
  });
});

describe("diffChars", () => {
  it("keeps shared characters with both indices", () => {
    const ops = diffChars("Turn", "Audio");
    const kept = ops.filter((o) => o.fromIndex >= 0 && o.toIndex >= 0);
    // "u" survives from T-u-rn into A-u-dio.
    expect(kept.map((o) => o.ch)).toContain("u");
  });

  it("pure insert and pure delete", () => {
    expect(diffChars("", "ab")).toEqual([
      { ch: "a", fromIndex: -1, toIndex: 0 },
      { ch: "b", fromIndex: -1, toIndex: 1 },
    ]);
    expect(diffChars("ab", "")).toEqual([
      { ch: "a", fromIndex: 0, toIndex: -1 },
      { ch: "b", fromIndex: 1, toIndex: -1 },
    ]);
  });

  it("identical strings keep everything", () => {
    const ops = diffChars("same", "same");
    expect(ops.every((o) => o.fromIndex >= 0 && o.toIndex >= 0)).toBe(true);
  });
});
