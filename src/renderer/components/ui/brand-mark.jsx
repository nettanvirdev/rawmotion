import { cn } from "@/lib/utils";

/**
 * The Raw Motion mark, as a flat single-color glyph.
 *
 * This is the in-app version of public/assets/logo.svg - same geometry (video
 * frame + play triangle), but solid `currentColor` rather than the plate and
 * frosted glass, so it inherits text color and reads at 14–16px. Keep the two
 * in sync if the mark changes.
 */
export function BrandMark({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      fill="none"
      aria-hidden
    >
      <rect
        x="2"
        y="4.5"
        width="20"
        height="15"
        rx="4"
        fill="currentColor"
        opacity="0.28"
      />
      <path
        d="M10 8.8 L15.8 12 L10 15.2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
