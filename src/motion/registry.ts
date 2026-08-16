/**
 * The component registry.
 *
 * A `component` layer in `project.json` stores a name; this table turns that
 * name into a React component plus a description of its props. The prop
 * schema is what makes the arrangement bidirectional:
 *
 *   - the inspector generates its controls from it, so a new component is
 *     editable in the UI without writing any inspector code;
 *   - an agent can read it to discover what it is allowed to set.
 *
 * The registry is a static allow-list rather than a dynamic import of
 * whatever is in the project's `components/` directory. That is a security
 * boundary, not an oversight: dynamically evaluating source from a project
 * file would make opening a downloaded project equivalent to running it.
 * Loading user-authored components is a real goal, and the note in
 * `docs/architecture.md` describes the compilation step it needs first.
 */

import type React from "react";
import {
  FeatureList,
  HeroTitle,
  LogoLockup,
  ProductCard,
} from "./components";

/** How the inspector should render a prop. */
export type PropSpec =
  | { kind: "text"; label: string; default: string; multiline?: boolean }
  | { kind: "number"; label: string; default: number; min?: number; max?: number; step?: number }
  | { kind: "color"; label: string; default: string }
  | { kind: "select"; label: string; default: string; options: { value: string; label: string }[] };

export interface RegistryEntry {
  name: string;
  label: string;
  description: string;
  component: React.FC<any>;
  props: Record<string, PropSpec>;
}

/** Default prop values, derived from the schema so the two cannot diverge. */
function defaultsOf(props: Record<string, PropSpec>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, spec]) => [key, spec.default]),
  );
}

const REGISTRY_SOURCE: Record<string, Omit<RegistryEntry, "name">> = {
  HeroTitle: {
    label: "Hero title",
    description: "Eyebrow, display line and caption on a staggered reveal.",
    component: HeroTitle,
    props: {
      eyebrow: { kind: "text", label: "Eyebrow", default: "" },
      text: { kind: "text", label: "Title", default: "Introducing Raw Motion" },
      caption: { kind: "text", label: "Caption", default: "", multiline: true },
      accent: { kind: "color", label: "Accent", default: "#8b9bff" },
      size: { kind: "number", label: "Size", default: 112, min: 24, max: 400, step: 2 },
      align: {
        kind: "select",
        label: "Align",
        default: "center",
        options: [
          { value: "center", label: "Center" },
          { value: "left", label: "Left" },
        ],
      },
    },
  },

  ProductCard: {
    label: "Product card",
    description: "Floating glass card with a slow 3D sway and specular edge.",
    component: ProductCard,
    props: {
      title: { kind: "text", label: "Title", default: "Raw Motion" },
      caption: { kind: "text", label: "Caption", default: "AI-native motion design" },
      badge: { kind: "text", label: "Badge", default: "v1.0" },
      accent: { kind: "color", label: "Accent", default: "#8b9bff" },
      width: { kind: "number", label: "Width", default: 720, min: 120, max: 3840, step: 10 },
      height: { kind: "number", label: "Height", default: 440, min: 120, max: 2160, step: 10 },
      sway: { kind: "number", label: "Sway", default: 2.5, min: 0, max: 12, step: 0.5 },
    },
  },

  FeatureList: {
    label: "Feature list",
    description: "Staggered bullet lines. One feature per line.",
    component: FeatureList,
    props: {
      items: {
        kind: "text",
        label: "Items",
        default: "Code-first compositions\nLive preview\nFrame-accurate export",
        multiline: true,
      },
      accent: { kind: "color", label: "Accent", default: "#8b9bff" },
      fontSize: { kind: "number", label: "Size", default: 34, min: 12, max: 160, step: 1 },
    },
  },

  LogoLockup: {
    label: "Logo lockup",
    description: "Drawn mark beside a wordmark. Built for outros.",
    component: LogoLockup,
    props: {
      wordmark: { kind: "text", label: "Wordmark", default: "Raw Motion" },
      accent: { kind: "color", label: "Accent", default: "#8b9bff" },
      size: { kind: "number", label: "Size", default: 96, min: 24, max: 400, step: 4 },
    },
  },
};

/** Every registered component, with its name folded in. */
export const COMPONENT_REGISTRY: RegistryEntry[] = Object.entries(
  REGISTRY_SOURCE,
).map(([name, entry]) => ({ name, ...entry }));

export function lookupComponent(
  name: string,
): (RegistryEntry & { defaults: Record<string, unknown> }) | null {
  const entry = REGISTRY_SOURCE[name];
  if (!entry) return null;
  return { name, ...entry, defaults: defaultsOf(entry.props) };
}

export function componentDefaults(name: string): Record<string, unknown> {
  const entry = REGISTRY_SOURCE[name];
  return entry ? defaultsOf(entry.props) : {};
}
