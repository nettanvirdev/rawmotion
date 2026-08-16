/**
 * The custom component runtime.
 *
 * A project's `components/*.tsx` files are compiled to CJS by the main
 * process (or the MCP server) with `react`, `remotion` and `rawmotion` left
 * external. This module is the other half of that contract: it *provides*
 * those externals and evaluates the compiled code, in whichever environment
 * the composition happens to be mounted - the editor's Player and the
 * headless render bundle both contain everything needed, which is what keeps
 * preview and export pixel-identical for custom components.
 *
 * The code travels as ordinary strings inside the composition's input props,
 * so nothing about the render pipeline changes: a project with custom
 * components is still "a JSON blob in, frames out".
 */

import React, { createContext, useContext, useMemo } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as Remotion from "remotion";
import {
  manifestDefaults,
  normalizeManifest,
} from "../shared/component-manifest.js";
import type { PropSpec } from "./registry";
import * as timing from "./timing";
import * as layout from "./layout";
import * as presets from "./presets";
import * as textKit from "./text";
import { resolveFontStack } from "./fonts";
import { useAssetUrl } from "./assets";
import { themed, useGrid, useTheme } from "./theme";
import { resolveTheme, THEMES } from "./themes.js";
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

/**
 * Everything importable as `import { ... } from "rawmotion"` inside a custom
 * component. Curated rather than `export *` so the surface an agent is told
 * about (see the MCP capability text) is exactly the surface that exists.
 */
const RAWMOTION_RUNTIME = {
  // Timing + motion vocabulary
  ...timing,
  ...presets,
  // Layout grid
  ...layout,
  // Theme
  useTheme,
  useGrid,
  themed,
  resolveTheme,
  THEMES,
  // Text kit
  ...textKit,
  resolveFontStack,
  // Assets
  useAssetUrl,
  // Built-in components, so customs can compose them
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

/** The normalised `export const manifest` of a custom component. */
export interface ComponentManifest {
  name: string;
  label: string;
  description: string;
  category: string;
  version: number;
  props: Record<string, PropSpec>;
}

/** The compiled artefact as it travels through input props. */
export interface CompiledComponent {
  name: string;
  file: string;
  code: string;
  manifest: ComponentManifest;
  error?: string | null;
}

interface EvaluatedComponent {
  name: string;
  component: React.FC<Record<string, unknown>> | null;
  manifest: ComponentManifest;
  defaults: Record<string, unknown>;
  error: string | null;
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

/**
 * Module cache keyed by compiled code. Code strings change on every edit, so
 * the key *is* the invalidation - a hot-reloaded component is new code and
 * misses the cache; an unchanged one re-mounts instantly.
 */
const moduleCache = new Map<string, EvaluatedComponent>();

function requireShim(id: string): unknown {
  if (id === "react") return React;
  if (id === "react/jsx-runtime" || id === "react/jsx-dev-runtime") return jsxRuntime;
  if (id === "remotion" || id.startsWith("remotion/")) return Remotion;
  if (id === "rawmotion") return RAWMOTION_RUNTIME;
  throw new Error(`Custom components cannot import "${id}"`);
}

export function evaluateComponent(entry: CompiledComponent): EvaluatedComponent {
  const cached = moduleCache.get(entry.code);
  if (cached) return cached;

  const manifest = normalizeManifest(entry.manifest, entry.name) as ComponentManifest;
  let evaluated: EvaluatedComponent;

  if (!entry.code || entry.error) {
    evaluated = {
      name: entry.name,
      component: null,
      manifest,
      defaults: manifestDefaults(manifest),
      error: entry.error ?? "The component failed to compile.",
    };
  } else {
    try {
      const module = { exports: {} as Record<string, unknown> };
      // eslint-disable-next-line no-new-func
      const run = new Function("require", "module", "exports", entry.code);
      run(requireShim, module, module.exports);
      const component = module.exports.default;
      evaluated = {
        name: entry.name,
        component:
          typeof component === "function"
            ? (component as React.FC<Record<string, unknown>>)
            : null,
        manifest,
        defaults: manifestDefaults(manifest),
        error:
          typeof component === "function"
            ? null
            : "The module has no default-exported component.",
      };
    } catch (error) {
      evaluated = {
        name: entry.name,
        component: null,
        manifest,
        defaults: manifestDefaults(manifest),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (entry.code) moduleCache.set(entry.code, evaluated);
  return evaluated;
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

const CustomComponentsContext = createContext<Map<string, EvaluatedComponent>>(new Map());

export const CustomComponentsProvider: React.FC<{
  components?: CompiledComponent[];
  children: React.ReactNode;
}> = ({ components, children }) => {
  const map = useMemo(() => {
    const out = new Map<string, EvaluatedComponent>();
    for (const entry of components ?? []) {
      if (!entry || typeof entry.name !== "string") continue;
      out.set(entry.name, evaluateComponent(entry));
    }
    return out;
  }, [components]);

  return (
    <CustomComponentsContext.Provider value={map}>{children}</CustomComponentsContext.Provider>
  );
};

/** Resolve a custom component by registry name. Null when unknown. */
export function useCustomComponent(name: string): EvaluatedComponent | null {
  const map = useContext(CustomComponentsContext);
  return map.get(name) ?? null;
}

export function useCustomComponents(): Map<string, EvaluatedComponent> {
  return useContext(CustomComponentsContext);
}

/* ------------------------------------------------------------------ *
 * Error containment
 * ------------------------------------------------------------------ */

/**
 * A runtime error inside one custom component must cost that component's
 * cell, not the whole preview - a user mid-edit will pass through broken
 * states constantly, and remounting the entire Player for each one would
 * make source editing unusable.
 */
export class CustomComponentBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidUpdate(prev: { children: React.ReactNode }) {
    // New props or new code means a new attempt.
    if (prev.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return <ComponentFault name={this.props.name} message={this.state.error} />;
    }
    return this.props.children;
  }
}

/** Visible in-frame diagnostics - a silent blank cell is unfindable. */
export const ComponentFault: React.FC<{ name: string; message: string }> = ({
  name,
  message,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxWidth: 720,
      padding: "28px 34px",
      borderRadius: 14,
      border: "1px dashed rgb(255 120 120 / 0.5)",
      background: "rgb(255 60 60 / 0.06)",
      color: "rgb(255 170 170 / 0.9)",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    }}
  >
    <div style={{ fontSize: 24, fontWeight: 600 }}>{name}</div>
    <div style={{ fontSize: 17, lineHeight: 1.5, whiteSpace: "pre-wrap", opacity: 0.85 }}>
      {message}
    </div>
  </div>
);
