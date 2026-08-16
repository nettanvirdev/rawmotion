import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be taught this design system's custom scales.
 *
 * Its default config only knows Tailwind's stock names, so it guesses at
 * anything else. That guess is silently destructive: `text-14` looks like a
 * COLOR to it (`text-<color>`), so in a class list like
 * `"text-action-fg … text-14"` it treats the two as conflicting and keeps
 * only the last one - dropping the real text color, or dropping the font
 * size, depending on which came last.
 *
 * The result is invisible white-on-white labels and chrome that renders at
 * the inherited 16px instead of 13px. Declaring the font-size scale here
 * fixes both directions at once.
 *
 * Rule: every custom `--text-*` key in globals.css must be listed below.
 */
const FONT_SIZES = ["10", "11", "12", "13", "14", "15", "16", "18", "20"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
