import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves conflicting Tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});

/**
 * Regression guard. Without the font-size scale registered in extendTailwindMerge,
 * tailwind-merge reads `text-14` as a text COLOR and treats it as conflicting
 * with the real color - silently dropping one of them. That shipped as
 * white-on-white buttons and 16px sidebar chrome that should have been 13px.
 */
describe("cn - custom font-size scale", () => {
  const SIZES = ["10", "11", "12", "13", "14", "15", "16", "18", "20"];

  it.each(SIZES)("keeps text-%s alongside a color, in either order", (size) => {
    expect(cn(`text-ink-muted text-${size}`)).toBe(
      `text-ink-muted text-${size}`,
    );
    expect(cn(`text-${size} text-ink-muted`)).toBe(
      `text-${size} text-ink-muted`,
    );
  });

  it("still collapses two competing font sizes", () => {
    expect(cn("text-13 text-15")).toBe("text-15");
  });

  it("still collapses two competing text colors", () => {
    expect(cn("text-ink-muted text-action-fg")).toBe("text-action-fg");
  });

  it("preserves the solid button's inverting foreground", () => {
    expect(
      cn("bg-action text-action-fg", "rounded-full px-4 text-14"),
    ).toContain("text-action-fg");
  });
});
