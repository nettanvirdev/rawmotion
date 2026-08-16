/**
 * The motion language.
 *
 * Every animated value in Raw Motion resolves through this module. That is
 * the point: an app whose easing curves are scattered as inline
 * `cubic-bezier(...)` literals has no motion identity, only motion. Naming
 * the curves and the spring configurations here is what makes a composition
 * built by Claude and one built by hand feel like the same product.
 *
 * Two systems coexist deliberately:
 *
 *  - **Deterministic easing** for anything that must land on an exact frame -
 *    a title that has to be settled before a cut, a wipe timed to a beat.
 *  - **Springs** for anything physical - a card arriving, a camera settling.
 *    Springs do not have a knowable end frame, which is a feature for feel
 *    and a hazard for timing, so they are opt-in.
 *
 * House style: nothing bounces past its target by more than a hair. The
 * `damping` values below are high on purpose. Overshoot reads as "template".
 */

import { Easing, interpolate, spring } from "remotion";

/* ------------------------------------------------------------------ *
 * Easing curves
 * ------------------------------------------------------------------ */

/**
 * The complete easing vocabulary. Anything not in this table does not belong
 * in a Raw Motion composition.
 *
 * `outExpo` is the workhouse: a fast start that decelerates hard reads as
 * confident. `inOutQuint` is for movements that both begin and end on screen,
 * such as a camera push. `linear` exists only for continuous loops - grain,
 * drifting particles - where any easing would create a visible pulse.
 */
export const EASINGS = {
  linear: Easing.linear,
  out: Easing.out(Easing.ease),
  outQuad: Easing.out(Easing.quad),
  outCubic: Easing.bezier(0.33, 1, 0.68, 1),
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outBack: Easing.bezier(0.34, 1.24, 0.64, 1),
  inOut: Easing.inOut(Easing.ease),
  inOutQuint: Easing.bezier(0.83, 0, 0.17, 1),
  inQuad: Easing.in(Easing.quad),
} as const;

export type EasingName = keyof typeof EASINGS;

export function easingByName(name: string | undefined): (t: number) => number {
  return EASINGS[(name as EasingName) ?? "outExpo"] ?? EASINGS.outExpo;
}

/* ------------------------------------------------------------------ *
 * Spring configurations
 * ------------------------------------------------------------------ */

/**
 * Named spring configs, tuned so none of them overshoot visibly except
 * `lively`, which is reserved for small accents.
 */
export const SPRINGS = {
  /** Heavy, cinematic. For large objects and camera moves. */
  cinematic: { damping: 200, mass: 1.4, stiffness: 90 },
  /** The default. Arrives quickly, settles without a wobble. */
  smooth: { damping: 200, mass: 1, stiffness: 120 },
  /** Snappy UI-scale motion. */
  crisp: { damping: 26, mass: 0.6, stiffness: 220 },
  /** The only config with perceptible overshoot. Use sparingly. */
  lively: { damping: 14, mass: 0.7, stiffness: 180 },
} as const;

export type SpringName = keyof typeof SPRINGS;

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

/**
 * Normalised 0..1 progress through a window of frames.
 *
 * Clamped at both ends, which is what makes it safe to call for a frame
 * outside the window: before the window it is 0, after it is 1. Almost every
 * animation helper below is built on this.
 */
export function progress(
  frame: number,
  from: number,
  durationInFrames: number,
  easing: EasingName | ((t: number) => number) = "outExpo",
): number {
  if (durationInFrames <= 0) return frame >= from ? 1 : 0;
  const fn = typeof easing === "function" ? easing : easingByName(easing);
  return interpolate(frame, [from, from + durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: fn,
  });
}

/**
 * Spring progress, as a 0..1 value.
 *
 * @param frame Current frame.
 * @param fps   Composition frame rate - springs are time-based, not frame-based.
 * @param delay Frames to wait before the spring starts.
 * @param config A named config or an explicit one.
 */
export function springProgress(
  frame: number,
  fps: number,
  delay = 0,
  config: SpringName | { damping: number; mass: number; stiffness: number } = "smooth",
): number {
  const resolved = typeof config === "string" ? SPRINGS[config] : config;
  return spring({ frame: frame - delay, fps, config: resolved });
}

/**
 * Progress that rises over `inFrames`, holds, then falls over `outFrames`.
 *
 * This is the shape almost every layer wants - appear, exist, leave - and
 * writing it as two separate interpolations at each call site is where
 * off-by-one frame gaps come from.
 *
 * @returns 0..1
 */
export function inOutProgress(
  frame: number,
  totalDuration: number,
  inFrames: number,
  outFrames: number,
  easing: EasingName = "outExpo",
): number {
  const rise = progress(frame, 0, inFrames, easing);
  if (outFrames <= 0) return rise;
  const fall = interpolate(
    frame,
    [totalDuration - outFrames, totalDuration],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easingByName("inQuad"),
    },
  );
  return Math.min(rise, fall);
}

/* ------------------------------------------------------------------ *
 * Stagger
 * ------------------------------------------------------------------ */

/**
 * Delay for item `index` in a staggered group.
 *
 * `total` matters because of `overlap`: a fixed per-item delay makes a
 * 40-character headline take 40x longer than a 1-character one, which is why
 * kinetic type so often feels sluggish. Compressing the step as the group
 * grows keeps the whole reveal within a predictable window.
 *
 * @param index    Zero-based position in the group.
 * @param total    Group size.
 * @param step     Frames between consecutive items at small group sizes.
 * @param maxSpan  Frames the entire stagger may occupy. The step shrinks to fit.
 */
export function staggerDelay(
  index: number,
  total: number,
  step = 2,
  maxSpan = 24,
): number {
  if (total <= 1) return 0;
  const naturalSpan = step * (total - 1);
  const scale = naturalSpan > maxSpan ? maxSpan / naturalSpan : 1;
  return index * step * scale;
}

/* ------------------------------------------------------------------ *
 * Value helpers
 * ------------------------------------------------------------------ */

/** Map 0..1 progress onto a range. */
export function mix(t: number, from: number, to: number): number {
  return from + (to - from) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A continuous 0..1..0 oscillation, for ambient motion that must loop
 * seamlessly - drifting light, breathing glow.
 *
 * @param frame
 * @param periodInFrames Length of one full cycle.
 * @param phase 0..1 offset, so several elements can share a period without
 *   moving in lockstep.
 */
export function oscillate(frame: number, periodInFrames: number, phase = 0): number {
  const t = ((frame / Math.max(1, periodInFrames)) + phase) * Math.PI * 2;
  return (Math.sin(t) + 1) / 2;
}

/**
 * Deterministic pseudo-random number in 0..1 from an integer seed.
 *
 * Remotion exposes `random()`, but a composition must be reproducible frame
 * for frame across preview and render, and this makes the seeding explicit
 * at every call site - a particle field seeded by index rather than by call
 * order cannot drift when a component re-renders.
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * CSS filter string for a blur, or `undefined` when there is none.
 *
 * Returning `undefined` rather than `"blur(0px)"` matters for performance:
 * any non-empty filter promotes the element to its own compositing layer,
 * and a composition with thirty such layers will not preview at frame rate.
 */
export function blurFilter(px: number): string | undefined {
  return px > 0.01 ? `blur(${px.toFixed(2)}px)` : undefined;
}
