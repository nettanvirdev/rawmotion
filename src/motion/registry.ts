/**
 * The component registry.
 *
 * A `component` layer in `project.json` stores a name; this table turns that
 * name into a React component. The *descriptions* of those components -
 * their labels and prop schemas - live in `specs.js` as plain data, because
 * three consumers need them and one of those (the MCP server) runs in Node
 * and cannot import TSX.
 *
 * The prop schema is what makes the arrangement bidirectional: the inspector
 * generates its controls from it, so a new component is editable in the UI
 * without any inspector code, and an agent reads the same schema to discover
 * what it is allowed to set.
 *
 * The registry is a static allow-list rather than a dynamic import of
 * whatever is in the project's `components/` directory. That is a security
 * boundary, not an oversight: evaluating source from a project file would
 * make opening a downloaded project equivalent to running it. See
 * `docs/architecture.md`.
 */

import type React from "react";
import {
  FeatureList,
  GlassBar,
  GlassCard,
  HeroTitle,
  LogoLockup,
  ProductCard,
} from "./components";
import {
  BrowserFrame,
  Callout,
  Caption,
  Chapter,
  CodeBlock,
  DiagramFlow,
  FileTree,
  StatGrid,
  Terminal,
} from "./explainer";
import { COMPONENT_SPECS } from "./specs.js";

export { BACKGROUND_KINDS, COMPONENT_SPECS, PRESET_NAMES } from "./specs.js";

/** How the inspector should render a prop. */
export type PropSpec =
  | { kind: "text"; label: string; default: string; multiline?: boolean }
  | { kind: "number"; label: string; default: number; min?: number; max?: number; step?: number }
  | { kind: "color"; label: string; default: string }
  | { kind: "select"; label: string; default: string; options: { value: string; label: string }[] }
  /** A project-asset path; the inspector renders a picker with import. */
  | { kind: "image"; label: string; default: string }
  /** A boolean switch. Custom-component manifests produce these. */
  | { kind: "toggle"; label: string; default: boolean };

export interface RegistryEntry {
  name: string;
  label: string;
  description: string;
  component: React.FC<any>;
  props: Record<string, PropSpec>;
}

/**
 * Name -> implementation.
 *
 * Deliberately just the mapping. Every key here must exist in
 * `COMPONENT_SPECS` and vice versa; `registry.test.ts` enforces both
 * directions, which is what lets the two files be edited independently
 * without one silently falling behind.
 */
const COMPONENTS: Record<string, React.FC<any>> = {
  HeroTitle,
  ProductCard,
  FeatureList,
  LogoLockup,
  GlassCard,
  GlassBar,
  Chapter,
  CodeBlock,
  Terminal,
  FileTree,
  DiagramFlow,
  Callout,
  BrowserFrame,
  StatGrid,
  Caption,
};

const SPECS = COMPONENT_SPECS as unknown as Record<
  string,
  { label: string; description: string; props: Record<string, PropSpec> }
>;

/** Default prop values, derived from the schema so the two cannot diverge. */
function defaultsOf(props: Record<string, PropSpec>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).map(([key, spec]) => [key, spec.default]));
}

/** Every registered component, in declaration order. */
export const COMPONENT_REGISTRY: RegistryEntry[] = Object.keys(SPECS)
  .filter((name) => COMPONENTS[name])
  .map((name) => ({ name, ...SPECS[name], component: COMPONENTS[name] }));

export function lookupComponent(
  name: string,
): (RegistryEntry & { defaults: Record<string, unknown> }) | null {
  const spec = SPECS[name];
  const component = COMPONENTS[name];
  if (!spec || !component) return null;
  return { name, ...spec, component, defaults: defaultsOf(spec.props) };
}

export function componentDefaults(name: string): Record<string, unknown> {
  const spec = SPECS[name];
  return spec ? defaultsOf(spec.props) : {};
}

/** Implementation names, for the drift test. */
export const COMPONENT_NAMES = Object.keys(COMPONENTS);
