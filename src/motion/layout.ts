/**
 * The layout grid.
 *
 * This exists because of a specific, visible defect: every layer used to be
 * an `AbsoluteFill` centred on its own content, then nudged by `transform.x`.
 * Two elements given the same `x` therefore had *different left edges* -
 * offset by half the difference in their widths. Nothing could ever sit on a
 * shared line, because no shared line existed.
 *
 * A grid fixes it at the root. A layer names a cell and an alignment; its
 * edge is then a property of the grid, not of its content. Two layers in
 * column 1 have byte-identical left edges whether one is a 40-character
 * headline and the other a three-word label.
 *
 * The numbers are the standard editorial grid every design tool ships:
 * 12 columns across, 8 rows down, inside a safe margin. Twelve divides by
 * 2, 3, 4 and 6, which is why it survived from print.
 *
 * Pure arithmetic - no React, no DOM - so it is testable and identical in
 * preview and in the final render.
 */

/** Grid definition. Stored on the project so a composition can retune it. */
export interface GridSpec {
  columns: number;
  rows: number;
  /** Horizontal safe margin as a fraction of composition width. */
  marginX: number;
  /** Vertical safe margin as a fraction of composition height. */
  marginY: number;
  /** Gutter between columns and rows, in composition pixels. */
  gutter: number;
}

export const DEFAULT_GRID: GridSpec = {
  columns: 12,
  rows: 8,
  // 6.25% each side leaves 87.5% of frame - 1680px at 1920 - which is the
  // classic title-safe area and keeps content clear of platform chrome.
  marginX: 0.0625,
  marginY: 0.075,
  gutter: 24,
};

/** Where a layer sits on the grid. */
export interface LayoutSpec {
  /** 1-based start column. */
  col?: number;
  /** Columns spanned. */
  span?: number;
  /** 1-based start row. */
  row?: number;
  /** Rows spanned. */
  rowSpan?: number;
  /** Horizontal alignment of the content inside its cell. */
  align?: "left" | "center" | "right";
  /** Vertical alignment of the content inside its cell. */
  valign?: "top" | "middle" | "bottom";
  /** Pixel nudge applied after the cell is computed. Use sparingly. */
  offsetX?: number;
  offsetY?: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The safe area - the region content is allowed to occupy.
 */
export function safeArea(width: number, height: number, grid: GridSpec): Rect {
  const marginX = width * grid.marginX;
  const marginY = height * grid.marginY;
  return {
    left: marginX,
    top: marginY,
    width: width - marginX * 2,
    height: height - marginY * 2,
  };
}

/**
 * Resolve a layout spec to a pixel rectangle.
 *
 * Out-of-range values are clamped rather than rejected: these come from
 * `project.json`, which an agent writes, and a column of 14 on a 12-column
 * grid should put the element at the right-hand edge rather than fail the
 * render.
 */
export function resolveLayout(
  layout: LayoutSpec,
  width: number,
  height: number,
  grid: GridSpec = DEFAULT_GRID,
): Rect {
  const area = safeArea(width, height, grid);

  const columns = Math.max(1, Math.round(grid.columns));
  const rows = Math.max(1, Math.round(grid.rows));

  const colWidth = (area.width - grid.gutter * (columns - 1)) / columns;
  const rowHeight = (area.height - grid.gutter * (rows - 1)) / rows;

  const col = clampInt(layout.col ?? 1, 1, columns);
  const span = clampInt(layout.span ?? columns, 1, columns - col + 1);
  const row = clampInt(layout.row ?? 1, 1, rows);
  const rowSpan = clampInt(layout.rowSpan ?? rows, 1, rows - row + 1);

  return {
    left: area.left + (col - 1) * (colWidth + grid.gutter) + (layout.offsetX ?? 0),
    top: area.top + (row - 1) * (rowHeight + grid.gutter) + (layout.offsetY ?? 0),
    width: span * colWidth + (span - 1) * grid.gutter,
    height: rowSpan * rowHeight + (rowSpan - 1) * grid.gutter,
  };
}

/** Flexbox alignment for a layout spec's horizontal alignment. */
export function justifyFor(align: LayoutSpec["align"]): "flex-start" | "center" | "flex-end" {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/** Flexbox alignment for a layout spec's vertical alignment. */
export function alignFor(valign: LayoutSpec["valign"]): "flex-start" | "center" | "flex-end" {
  if (valign === "top") return "flex-start";
  if (valign === "bottom") return "flex-end";
  return "center";
}

/**
 * Whether a layout spec asks for anything at all.
 *
 * A layer with no layout falls back to the old centre-and-offset behaviour,
 * so projects authored before the grid existed still render exactly as they
 * did. Absence has to be distinguishable from `{}` for that to hold.
 */
export function hasLayout(layout: LayoutSpec | undefined | null): layout is LayoutSpec {
  if (!layout) return false;
  return (
    layout.col !== undefined ||
    layout.span !== undefined ||
    layout.row !== undefined ||
    layout.rowSpan !== undefined ||
    layout.align !== undefined ||
    layout.valign !== undefined ||
    layout.offsetX !== undefined ||
    layout.offsetY !== undefined
  );
}

/**
 * Named regions, for the common cases.
 *
 * Most scenes want one of a handful of arrangements, and naming them means
 * an agent picks a composition rather than doing arithmetic - which is both
 * faster and much harder to get subtly wrong. `describe_capabilities`
 * reports these, so they are the first thing a model reaches for.
 */
export const LAYOUT_PRESETS: Record<string, LayoutSpec> = {
  /* Full-frame */
  center: { col: 1, span: 12, row: 1, rowSpan: 8, align: "center", valign: "middle" },
  centerUpper: { col: 2, span: 10, row: 2, rowSpan: 3, align: "center", valign: "middle" },
  centerLower: { col: 2, span: 10, row: 5, rowSpan: 3, align: "center", valign: "middle" },

  /* Split: title left, content right. The workhorse for explainers.
   *
   * Both span rows 2-7 so their contents centre on the same line - halfway
   * down the safe area. An earlier version stopped at row 5, which centred
   * everything at 38% of frame and left the bottom half conspicuously empty;
   * the frame read as top-heavy even though each element was individually
   * well placed. Optical centre matters more than any single element's box. */
  splitLeft: { col: 1, span: 5, row: 2, rowSpan: 6, align: "left", valign: "middle" },
  splitRight: { col: 7, span: 6, row: 2, rowSpan: 6, align: "center", valign: "middle" },

  /* Split the other way */
  splitLeftWide: { col: 1, span: 6, row: 2, rowSpan: 6, align: "center", valign: "middle" },
  splitRightNarrow: { col: 8, span: 5, row: 2, rowSpan: 6, align: "left", valign: "middle" },

  /* Stacked thirds */
  topBand: { col: 1, span: 12, row: 1, rowSpan: 2, align: "center", valign: "middle" },
  middleBand: { col: 1, span: 12, row: 3, rowSpan: 4, align: "center", valign: "middle" },
  bottomBand: { col: 1, span: 12, row: 7, rowSpan: 2, align: "center", valign: "middle" },

  /* Corners and edges, for captions, marks and footnotes */
  topLeft: { col: 1, span: 5, row: 1, rowSpan: 1, align: "left", valign: "top" },
  bottomLeft: { col: 1, span: 5, row: 7, rowSpan: 2, align: "left", valign: "bottom" },
  bottomRight: { col: 8, span: 5, row: 7, rowSpan: 2, align: "right", valign: "bottom" },
  caption: { col: 3, span: 8, row: 7, rowSpan: 2, align: "center", valign: "bottom" },
};

/**
 * Resolve a preset name or an explicit spec into a spec.
 *
 * An explicit spec may also carry `preset`, in which case the explicit
 * fields override the preset's - so "splitLeft but one row higher" is
 * `{ preset: "splitLeft", row: 1 }` rather than a full restatement.
 */
export function resolveLayoutSpec(
  input: (LayoutSpec & { preset?: string }) | string | undefined,
): LayoutSpec | undefined {
  if (!input) return undefined;
  if (typeof input === "string") return LAYOUT_PRESETS[input];

  const { preset, ...rest } = input;
  if (!preset) return rest;

  const base = LAYOUT_PRESETS[preset];
  if (!base) return rest;

  // Only keys actually present override the preset, so a spec of
  // `{ preset: "splitLeft" }` is exactly the preset.
  const overrides = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );
  return { ...base, ...overrides };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
