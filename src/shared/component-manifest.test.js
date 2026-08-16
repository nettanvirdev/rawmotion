import { describe, expect, it } from "vitest";
import {
  componentTemplate,
  humanise,
  manifestDefaults,
  normalizeManifest,
  safeName,
} from "./component-manifest.js";

describe("normalizeManifest", () => {
  it("fills every field from nothing", () => {
    const m = normalizeManifest(null, "GlassCard");
    expect(m).toEqual({
      name: "GlassCard",
      label: "Glass card",
      description: "",
      category: "Custom",
      version: 1,
      props: {},
    });
  });

  it("keeps declared fields and normalises props", () => {
    const m = normalizeManifest(
      {
        name: "PricingCard",
        label: "Pricing card",
        description: "A card.",
        category: "Cards",
        version: 3,
        props: {
          title: { type: "text", label: "Title", default: "Pro" },
          price: { type: "string", default: "$29" },
          accent: { type: "color", default: "#8b5cf6" },
          radius: { type: "number", default: 32, min: 0, max: 160, step: 1 },
          featured: { type: "boolean", default: true },
          tone: { type: "enum", options: ["soft", "loud"], default: "loud" },
          art: { type: "asset" },
          blurb: { type: "multiline", default: "hi" },
        },
      },
      "fallback",
    );

    expect(m.name).toBe("PricingCard");
    expect(m.version).toBe(3);
    expect(m.props.title).toEqual({ kind: "text", label: "Title", default: "Pro" });
    expect(m.props.price).toEqual({ kind: "text", label: "Price", default: "$29" });
    expect(m.props.accent.kind).toBe("color");
    expect(m.props.radius).toEqual({
      kind: "number",
      label: "Radius",
      default: 32,
      min: 0,
      max: 160,
      step: 1,
    });
    expect(m.props.featured).toEqual({ kind: "toggle", label: "Featured", default: true });
    expect(m.props.tone).toEqual({
      kind: "select",
      label: "Tone",
      default: "loud",
      options: [
        { value: "soft", label: "Soft" },
        { value: "loud", label: "Loud" },
      ],
    });
    expect(m.props.art).toEqual({ kind: "image", label: "Art", default: "" });
    expect(m.props.blurb).toEqual({ kind: "text", label: "Blurb", default: "hi", multiline: true });
  });

  it("degrades unknown prop types to text and drops garbage", () => {
    const m = normalizeManifest(
      { props: { weird: { type: "wibble", default: "x" }, junk: 42 } },
      "X",
    );
    expect(m.props.weird.kind).toBe("text");
    expect(m.props.junk).toBeUndefined();
  });

  it("rejects a select default not among the options", () => {
    const m = normalizeManifest(
      { props: { t: { type: "select", options: ["a", "b"], default: "z" } } },
      "X",
    );
    expect(m.props.t.default).toBe("a");
  });
});

describe("manifestDefaults", () => {
  it("derives defaults from the schema", () => {
    const m = normalizeManifest(
      {
        props: {
          a: { type: "number", default: 4 },
          b: { type: "toggle", default: true },
        },
      },
      "X",
    );
    expect(manifestDefaults(m)).toEqual({ a: 4, b: true });
  });
});

describe("names", () => {
  it("safeName strips extensions and invalid characters, uppercases", () => {
    expect(safeName("glass-card.tsx")).toBe("Glasscard");
    expect(safeName("myComp.jsx")).toBe("MyComp");
    expect(safeName("")).toBe("Component");
  });

  it("humanise splits camel case", () => {
    expect(humanise("GlassPricingCard")).toBe("Glass pricing card");
  });
});

describe("componentTemplate", () => {
  it("produces a module that names the component after the file", () => {
    const src = componentTemplate("StatBadge");
    expect(src).toContain('name: "StatBadge"');
    expect(src).toContain("export default StatBadge");
    expect(src).toContain('from "rawmotion"');
  });
});
