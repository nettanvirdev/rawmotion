/**
 * Entrance and exit presets.
 *
 * A preset is a pure function from timing to a *delta* - an offset applied on
 * top of whatever transform the layer already has. Keeping them additive is
 * what lets the inspector's transform controls and an entrance animation
 * coexist: the user positions the layer, the preset animates around that
 * position, and neither overwrites the other.
 *
 * Presets never read the project model and never touch the DOM, so they are
 * trivially testable and identical in preview and final render.
 */

import { EASINGS, SPRINGS, mix, progress, springProgress } from "./timing";

/** The additive result of a preset at a given frame. */
export interface MotionDelta {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  blur: number;
}

export const NEUTRAL_DELTA: MotionDelta = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  blur: 0,
};

export interface PresetArgs {
  /** Frames since the layer began. */
  frame: number;
  fps: number;
  /** Length of the entrance/exit itself, in frames. */
  duration: number;
  /** Preset-specific travel distance in composition pixels. */
  distance: number;
  /** Use spring physics rather than the preset's easing curve. */
  useSpring: boolean;
  /** `1` for an entrance, `-1` for an exit. */
  direction: 1 | -1;
}

type PresetFn = (t: number, args: PresetArgs) => Partial<MotionDelta>;

/**
 * The preset table.
 *
 * Each entry receives `t`, already eased and running 0 -> 1 for an entrance
 * and 1 -> 0 for an exit, so a single implementation serves both directions.
 */
const PRESETS: Record<string, { label: string; group: string; fn: PresetFn; defaultDistance?: number }> = {
  fade: {
    label: "Fade",
    group: "Basic",
    fn: (t) => ({ opacity: t }),
  },

  riseFade: {
    label: "Rise",
    group: "Basic",
    defaultDistance: 48,
    fn: (t, { distance }) => ({ opacity: t, y: mix(t, distance, 0) }),
  },

  dropFade: {
    label: "Drop",
    group: "Basic",
    defaultDistance: 48,
    fn: (t, { distance }) => ({ opacity: t, y: mix(t, -distance, 0) }),
  },

  slideLeft: {
    label: "Slide from right",
    group: "Basic",
    defaultDistance: 120,
    fn: (t, { distance }) => ({ opacity: t, x: mix(t, distance, 0) }),
  },

  slideRight: {
    label: "Slide from left",
    group: "Basic",
    defaultDistance: 120,
    fn: (t, { distance }) => ({ opacity: t, x: mix(t, -distance, 0) }),
  },

  scaleIn: {
    label: "Scale in",
    group: "Emphasis",
    // Starts at 0.92, not 0. A layer growing from nothing reads as a UI
    // popover; a layer settling the last 8% reads as cinematic.
    fn: (t) => ({ opacity: t, scale: mix(t, 0.92, 1) }),
  },

  scaleOut: {
    label: "Scale out",
    group: "Emphasis",
    fn: (t) => ({ opacity: t, scale: mix(t, 1.08, 1) }),
  },

  blurIn: {
    label: "Blur in",
    group: "Emphasis",
    fn: (t) => ({ opacity: t, blur: mix(t, 18, 0), scale: mix(t, 1.04, 1) }),
  },

  /** Depth arrival: back, blurred and dim, resolving forward into focus. */
  depthIn: {
    label: "Depth",
    group: "Cinematic",
    defaultDistance: 40,
    fn: (t, { distance }) => ({
      opacity: t,
      scale: mix(t, 0.88, 1),
      blur: mix(t, 12, 0),
      y: mix(t, distance, 0),
    }),
  },

  /** A slow, almost imperceptible drift. For backgrounds and large imagery. */
  driftIn: {
    label: "Drift",
    group: "Cinematic",
    defaultDistance: 24,
    fn: (t, { distance }) => ({
      opacity: t,
      scale: mix(t, 1.06, 1),
      x: mix(t, distance, 0),
    }),
  },

  /** Slight rotation on arrival. Reserved for cards and device mockups. */
  tiltIn: {
    label: "Tilt",
    group: "Cinematic",
    defaultDistance: 32,
    fn: (t, { distance }) => ({
      opacity: t,
      y: mix(t, distance, 0),
      rotate: mix(t, -2.5, 0),
      scale: mix(t, 0.96, 1),
    }),
  },
};

/** Preset keys grouped for the inspector's animation picker. */
export function presetOptions(): { value: string; label: string; group: string }[] {
  return Object.entries(PRESETS).map(([value, { label, group }]) => ({
    value,
    label,
    group,
  }));
}

export function presetExists(name: string): boolean {
  return name in PRESETS;
}

export function presetDefaultDistance(name: string): number {
  return PRESETS[name]?.defaultDistance ?? 48;
}

/**
 * Evaluate a preset.
 *
 * An unknown preset name falls back to `fade` rather than throwing. Preset
 * names arrive from `project.json`, which an agent may have written by hand;
 * a typo should soften the animation, not blank the composition.
 */
export function evaluatePreset(name: string, args: PresetArgs): MotionDelta {
  const preset = PRESETS[name] ?? PRESETS.fade;

  const raw = args.useSpring
    ? springProgress(args.frame, args.fps, 0, SPRINGS.smooth)
    : progress(args.frame, 0, args.duration, EASINGS.outExpo);

  // An exit runs the same curve backwards: `t` falls 1 -> 0, so every preset
  // returns to its offset position instead of needing a mirrored twin.
  const t = args.direction === 1 ? raw : 1 - raw;

  return { ...NEUTRAL_DELTA, ...preset.fn(t, args) };
}

/**
 * Combine an entrance and an exit into one delta for the current frame.
 *
 * Multiplicative for opacity and scale, additive for translation - which is
 * what makes a layer that is both entering and leaving (a very short clip)
 * degrade gracefully rather than snapping between the two.
 *
 * @param frame          Frames since the layer started.
 * @param layerDuration  Total frames the layer is on screen.
 */
export function layerMotion(
  frame: number,
  layerDuration: number,
  fps: number,
  enter?: { preset: string; durationInFrames: number; delay: number; distance?: number; spring?: boolean },
  exit?: { preset: string; durationInFrames: number; delay: number; distance?: number; spring?: boolean },
): MotionDelta {
  let out = { ...NEUTRAL_DELTA };

  if (enter) {
    const d = evaluatePreset(enter.preset, {
      frame: frame - enter.delay,
      fps,
      duration: enter.durationInFrames,
      distance: enter.distance ?? presetDefaultDistance(enter.preset),
      useSpring: Boolean(enter.spring),
      direction: 1,
    });
    out = compose(out, d);
  }

  if (exit) {
    // Exits are anchored to the *end* of the layer, so `delay` counts
    // backwards from the out point. Anchoring them to the start would mean
    // every trim of a clip silently rewrites its exit timing.
    const exitStart = layerDuration - exit.durationInFrames - exit.delay;
    const d = evaluatePreset(exit.preset, {
      frame: frame - exitStart,
      fps,
      duration: exit.durationInFrames,
      distance: exit.distance ?? presetDefaultDistance(exit.preset),
      useSpring: Boolean(exit.spring),
      direction: -1,
    });
    out = compose(out, d);
  }

  return out;
}

function compose(a: MotionDelta, b: MotionDelta): MotionDelta {
  return {
    opacity: a.opacity * b.opacity,
    scale: a.scale * b.scale,
    x: a.x + b.x,
    y: a.y + b.y,
    rotate: a.rotate + b.rotate,
    blur: Math.max(a.blur, b.blur),
  };
}
