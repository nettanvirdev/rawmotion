/**
 * Layout preset names for the MCP schema.
 *
 * Duplicated as a plain list because `layout.ts` is TypeScript and the server
 * runs in Node. `layout.test.ts` asserts the two agree, so the list cannot
 * drift into promising an agent a region that does not exist.
 */
export const LAYOUT_PRESET_NAMES = [
  "center",
  "centerUpper",
  "centerLower",
  "splitLeft",
  "splitRight",
  "splitLeftWide",
  "splitRightNarrow",
  "topBand",
  "middleBand",
  "bottomBand",
  "topLeft",
  "bottomLeft",
  "bottomRight",
  "caption",
];
