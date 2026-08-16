import { describe, expect, it } from "vitest";
import { FONTS, isKnownFont } from "../shared/fonts.js";
import { LOADABLE_FAMILIES, SYSTEM_FONT_STACK, resolveFontStack } from "./fonts";

describe("font catalogue", () => {
  it("every catalogue family has a loader", () => {
    const missing = FONTS.filter((f) => !LOADABLE_FAMILIES.includes(f.family));
    expect(missing).toEqual([]);
  });

  it("every loader is advertised in the catalogue", () => {
    const orphaned = LOADABLE_FAMILIES.filter((family) => !isKnownFont(family));
    expect(orphaned).toEqual([]);
  });

  it("empty and unknown families fall back to the system stack", () => {
    expect(resolveFontStack("")).toBe(SYSTEM_FONT_STACK);
    expect(resolveFontStack(undefined)).toBe(SYSTEM_FONT_STACK);
    expect(resolveFontStack("Not A Real Font")).toBe(SYSTEM_FONT_STACK);
  });
});
