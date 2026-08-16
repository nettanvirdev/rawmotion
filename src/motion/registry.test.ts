import { describe, expect, it } from "vitest";
import {
  COMPONENT_NAMES,
  COMPONENT_REGISTRY,
  COMPONENT_SPECS,
  componentDefaults,
  lookupComponent,
} from "./registry";
import { BACKGROUND_KINDS, PRESET_NAMES } from "./specs.js";
import { BACKGROUND_REGISTRY } from "./backgrounds";
import { presetExists, presetOptions } from "./presets";

/**
 * Drift guards.
 *
 * The vocabulary is described in plain JS (`specs.js`) and implemented in
 * TSX, because the MCP server runs in Node and cannot import TSX. That split
 * is deliberate, but it means an agent could be told a component exists that
 * has no implementation - it would author a project referencing it and get a
 * "Unknown component" box in the middle of the frame.
 *
 * These tests make that impossible to ship.
 */

const specNames = Object.keys(COMPONENT_SPECS as Record<string, unknown>);

describe("component registry", () => {
  it("every described component has an implementation", () => {
    for (const name of specNames) {
      expect(COMPONENT_NAMES, `${name} is described but not implemented`).toContain(name);
    }
  });

  it("every implemented component is described", () => {
    for (const name of COMPONENT_NAMES) {
      expect(specNames, `${name} is implemented but not described`).toContain(name);
    }
  });

  it("exposes every component through the registry list", () => {
    expect(COMPONENT_REGISTRY).toHaveLength(specNames.length);
  });

  it("resolves every component by name", () => {
    for (const name of specNames) {
      const entry = lookupComponent(name);
      expect(entry, name).not.toBeNull();
      expect(typeof entry!.component, name).toBe("function");
    }
  });

  it("returns null for an unknown component rather than throwing", () => {
    // Component names arrive from project.json and may be hand-written.
    expect(lookupComponent("NoSuchComponent")).toBeNull();
    expect(componentDefaults("NoSuchComponent")).toEqual({});
  });

  it("derives defaults from the schema for every component", () => {
    for (const name of specNames) {
      const entry = lookupComponent(name)!;
      const defaults = componentDefaults(name);
      expect(Object.keys(defaults).sort()).toEqual(Object.keys(entry.props).sort());
    }
  });
});

describe("prop schemas", () => {
  it("every prop has a label and a default of the right type", () => {
    for (const [name, spec] of Object.entries(
      COMPONENT_SPECS as Record<string, { props: Record<string, any> }>,
    )) {
      for (const [key, prop] of Object.entries(spec.props)) {
        const where = `${name}.${key}`;
        expect(prop.label, where).toBeTruthy();

        if (prop.kind === "number") expect(typeof prop.default, where).toBe("number");
        else expect(typeof prop.default, where).toBe("string");

        if (prop.kind === "select") {
          expect(Array.isArray(prop.options), where).toBe(true);
          // A default outside the options list renders an empty select.
          expect(
            prop.options.map((o: { value: string }) => o.value),
            where,
          ).toContain(prop.default);
        }
        if (prop.kind === "color") {
          expect(prop.default, where).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    }
  });

  it("numeric props have sane bounds", () => {
    for (const [name, spec] of Object.entries(
      COMPONENT_SPECS as Record<string, { props: Record<string, any> }>,
    )) {
      for (const [key, prop] of Object.entries(spec.props)) {
        if (prop.kind !== "number") continue;
        const where = `${name}.${key}`;
        if (prop.min !== undefined && prop.max !== undefined) {
          expect(prop.min, where).toBeLessThan(prop.max);
          expect(prop.default, where).toBeGreaterThanOrEqual(prop.min);
          expect(prop.default, where).toBeLessThanOrEqual(prop.max);
        }
      }
    }
  });
});

describe("background vocabulary", () => {
  it("matches the implemented background registry", () => {
    const described = BACKGROUND_KINDS.map((b: { value: string }) => b.value).sort();
    const implemented = Object.keys(BACKGROUND_REGISTRY).sort();
    expect(described).toEqual(implemented);
  });
});

describe("animation preset vocabulary", () => {
  it("matches the implemented preset table", () => {
    const described = PRESET_NAMES.map((p: { value: string }) => p.value).sort();
    const implemented = presetOptions().map((p) => p.value).sort();
    expect(described).toEqual(implemented);
  });

  it("every described preset actually resolves", () => {
    for (const preset of PRESET_NAMES as { value: string }[]) {
      expect(presetExists(preset.value), preset.value).toBe(true);
    }
  });
});
