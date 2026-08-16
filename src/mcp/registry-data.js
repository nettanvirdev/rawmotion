/**
 * Vocabulary re-exported for the MCP server.
 *
 * A thin indirection over `src/motion/specs.js`, kept so the server has one
 * import for "everything an agent may address by name" and so this file can
 * grow server-only framing (usage notes, examples) without pushing it into
 * the shared spec data the UI also reads.
 */

export { BACKGROUND_KINDS, COMPONENT_SPECS, PRESET_NAMES } from "../motion/specs.js";

/** Keyed by background kind, matching a `background` layer's `props.kind`. */
export const BACKGROUND_REGISTRY = Object.fromEntries(
  (await import("../motion/specs.js")).BACKGROUND_KINDS.map((b) => [b.value, b]),
);
