import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRID,
  LAYOUT_PRESETS,
  hasLayout,
  resolveLayout,
  resolveLayoutSpec,
  safeArea,
} from "./layout";

/**
 * The grid.
 *
 * These tests encode the property the whole system exists for: **two layers
 * in the same column have identical edges, regardless of their content.**
 * Before the grid, every layer was centred on its own box and nudged by `x`,
 * so two elements given the same `x` had left edges that differed by half
 * the difference in their widths. Nothing could sit on a shared line.
 *
 * That defect was invisible to every test and obvious in every frame, which
 * is exactly the kind of thing to pin down once it is fixed.
 */

const W = 1920;
const H = 1080;

describe("safe area", () => {
  it("insets by the configured margins", () => {
    const area = safeArea(W, H, DEFAULT_GRID);
    expect(area.left).toBe(120); // 6.25% of 1920
    expect(area.width).toBe(1680);
    expect(area.top).toBeCloseTo(81, 5); // 7.5% of 1080
    expect(area.height).toBeCloseTo(918, 5);
  });

  it("is symmetric", () => {
    const area = safeArea(W, H, DEFAULT_GRID);
    expect(area.left).toBeCloseTo(W - (area.left + area.width), 5);
    expect(area.top).toBeCloseTo(H - (area.top + area.height), 5);
  });
});

describe("alignment - the property the grid exists for", () => {
  it("gives two layers in the same column identical left edges", () => {
    const a = resolveLayout({ col: 1, span: 5 }, W, H);
    const b = resolveLayout({ col: 1, span: 3 }, W, H);
    const c = resolveLayout({ col: 1, span: 12 }, W, H);

    expect(a.left).toBe(b.left);
    expect(b.left).toBe(c.left);
  });

  it("gives two layers in the same row identical top edges", () => {
    const a = resolveLayout({ row: 3, rowSpan: 1 }, W, H);
    const b = resolveLayout({ row: 3, rowSpan: 4 }, W, H);
    expect(a.top).toBe(b.top);
  });

  it("aligns right edges for spans that end on the same column", () => {
    // col 1 span 6 and col 4 span 3 both end at column 6.
    const a = resolveLayout({ col: 1, span: 6 }, W, H);
    const b = resolveLayout({ col: 4, span: 3 }, W, H);
    expect(a.left + a.width).toBeCloseTo(b.left + b.width, 6);
  });

  it("makes a full-span row exactly fill the safe area", () => {
    const full = resolveLayout({ col: 1, span: 12 }, W, H);
    const area = safeArea(W, H, DEFAULT_GRID);
    expect(full.left).toBeCloseTo(area.left, 6);
    expect(full.width).toBeCloseTo(area.width, 6);
  });

  it("keeps columns evenly spaced", () => {
    const widths = Array.from({ length: 12 }, (_, i) =>
      resolveLayout({ col: i + 1, span: 1 }, W, H),
    );
    const gaps = widths.slice(1).map((r, i) => r.left - (widths[i].left + widths[i].width));
    for (const gap of gaps) expect(gap).toBeCloseTo(DEFAULT_GRID.gutter, 6);
  });

  it("holds at any aspect ratio", () => {
    // The same guarantee has to survive a vertical re-target.
    for (const [w, h] of [[1080, 1920], [1080, 1080], [3840, 2160]]) {
      const a = resolveLayout({ col: 2, span: 4 }, w, h);
      const b = resolveLayout({ col: 2, span: 9 }, w, h);
      expect(a.left, `${w}x${h}`).toBe(b.left);
    }
  });
});

describe("clamping", () => {
  it("clamps a column beyond the grid to the last column", () => {
    // These values come from project.json, which an agent writes. A column of
    // 14 on a 12-column grid should land at the edge, not fail the render.
    const r = resolveLayout({ col: 14, span: 3 }, W, H);
    const last = resolveLayout({ col: 12, span: 1 }, W, H);
    expect(r.left).toBeCloseTo(last.left, 6);
  });

  it("clamps a span that would overflow the grid", () => {
    const r = resolveLayout({ col: 10, span: 12 }, W, H);
    const area = safeArea(W, H, DEFAULT_GRID);
    expect(r.left + r.width).toBeLessThanOrEqual(area.left + area.width + 0.001);
  });

  it("survives nonsense values", () => {
    for (const layout of [
      { col: 0 },
      { col: -5, span: -2 },
      { col: NaN, row: Infinity },
      {},
    ]) {
      const r = resolveLayout(layout as never, W, H);
      expect(Number.isFinite(r.left), JSON.stringify(layout)).toBe(true);
      expect(Number.isFinite(r.width), JSON.stringify(layout)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
    }
  });
});

describe("offsets", () => {
  it("nudges after the cell is computed", () => {
    const base = resolveLayout({ col: 2, span: 4 }, W, H);
    const nudged = resolveLayout({ col: 2, span: 4, offsetX: 30, offsetY: -12 }, W, H);

    expect(nudged.left).toBe(base.left + 30);
    expect(nudged.top).toBe(base.top - 12);
    // A nudge must not resize the cell, or it would break alignment with
    // everything else in the column.
    expect(nudged.width).toBe(base.width);
  });
});

describe("presets", () => {
  it("resolves by name", () => {
    expect(resolveLayoutSpec("splitLeft")).toEqual(LAYOUT_PRESETS.splitLeft);
  });

  it("lets explicit fields override a preset", () => {
    const spec = resolveLayoutSpec({ preset: "splitLeft", row: 1 });
    expect(spec?.col).toBe(LAYOUT_PRESETS.splitLeft.col);
    expect(spec?.row).toBe(1);
  });

  it("returns the preset unchanged when nothing is overridden", () => {
    expect(resolveLayoutSpec({ preset: "caption" })).toEqual(LAYOUT_PRESETS.caption);
  });

  it("ignores an unknown preset rather than throwing", () => {
    // Preset names come from project.json.
    expect(resolveLayoutSpec({ preset: "nope", col: 3 })).toEqual({ col: 3 });
    expect(resolveLayoutSpec("nope")).toBeUndefined();
  });

  it("splitLeft and bottomLeft share a left edge", () => {
    // The exact case from the user's report: a chapter title and the callout
    // beneath it must line up. They are different widths and different
    // components, so only a grid can guarantee this.
    const title = resolveLayout(LAYOUT_PRESETS.splitLeft, W, H);
    const note = resolveLayout(LAYOUT_PRESETS.bottomLeft, W, H);
    expect(title.left).toBe(note.left);
  });

  it("splitLeft and splitRight do not overlap", () => {
    const left = resolveLayout(LAYOUT_PRESETS.splitLeft, W, H);
    const right = resolveLayout(LAYOUT_PRESETS.splitRight, W, H);
    expect(left.left + left.width).toBeLessThanOrEqual(right.left + 0.001);
  });

  it("every preset stays inside the safe area", () => {
    const area = safeArea(W, H, DEFAULT_GRID);
    for (const [name, preset] of Object.entries(LAYOUT_PRESETS)) {
      const r = resolveLayout(preset, W, H);
      expect(r.left, name).toBeGreaterThanOrEqual(area.left - 0.001);
      expect(r.top, name).toBeGreaterThanOrEqual(area.top - 0.001);
      expect(r.left + r.width, name).toBeLessThanOrEqual(area.left + area.width + 0.001);
      expect(r.top + r.height, name).toBeLessThanOrEqual(area.top + area.height + 0.001);
    }
  });
});

describe("hasLayout", () => {
  it("distinguishes absent from empty", () => {
    // Absence means "use the old centre-and-offset behaviour", so projects
    // authored before the grid existed still render identically.
    expect(hasLayout(undefined)).toBe(false);
    expect(hasLayout(null)).toBe(false);
    expect(hasLayout({})).toBe(false);
  });

  it("detects any positioning field", () => {
    expect(hasLayout({ col: 1 })).toBe(true);
    expect(hasLayout({ align: "left" })).toBe(true);
    expect(hasLayout({ offsetY: 10 })).toBe(true);
  });
});

describe("MCP vocabulary", () => {
  it("the names advertised to agents match the implemented presets", async () => {
    // The server runs in Node and cannot import this TypeScript module, so
    // the preset names are listed separately for its schema. If that list
    // drifts, an agent is offered a region that does not exist and its layer
    // silently falls back to centred - which is the exact defect the grid was
    // built to remove.
    const { LAYOUT_PRESET_NAMES } = await import("../mcp/layout-data.js");
    expect([...LAYOUT_PRESET_NAMES].sort()).toEqual(Object.keys(LAYOUT_PRESETS).sort());
  });
});
