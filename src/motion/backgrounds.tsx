/**
 * Procedural backgrounds.
 *
 * These exist so that "make it look cinematic" does not mean "generate an
 * image". They are pure CSS and SVG, which makes them resolution
 * independent, instant to preview, free to re-time, and diffable in source -
 * none of which is true of a generated PNG.
 *
 * Three rules hold across the file:
 *
 *  1. **Everything is a function of `frame`.** No `Date.now`, no `Math.random`
 *     at render time. A composition must produce byte-identical frames in the
 *     preview and in the final render, and on a re-render six months later.
 *  2. **Layer count is bounded.** Each component composites a handful of
 *     elements, not hundreds. `ParticleField` caps its count for this reason.
 *  3. **Colour comes in through props.** Nothing hard-codes a palette, so a
 *     project can restyle its backgrounds without forking the components.
 */

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, oscillate, seededRandom } from "./timing";

/* ------------------------------------------------------------------ *
 * CinematicGradient
 * ------------------------------------------------------------------ */

export interface CinematicGradientProps {
  /** Base hue, 0-360. */
  hue?: number;
  /** Degrees of hue separation between the two poles of the gradient. */
  spread?: number;
  /** 0..2. Scales saturation and lightness together. */
  intensity?: number;
  /** Cycles per 600 frames. 0 freezes the gradient. */
  speed?: number;
}

/**
 * A slow two-pole gradient wash.
 *
 * The angle drifts rather than the colours, which is the difference between
 * "cinematic" and "screensaver": hue rotation draws attention to itself,
 * whereas a moving light direction reads as a camera or a source moving off
 * screen.
 */
export const CinematicGradient: React.FC<CinematicGradientProps> = ({
  hue = 250,
  spread = 48,
  intensity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const drift = oscillate(frame * speed, 600);
  const angle = mix(drift, 120, 160);

  const sat = 38 * intensity;
  const light = 12 * intensity;

  return (
    <AbsoluteFill
      style={{
        background: [
          `linear-gradient(${angle}deg,`,
          `hsl(${hue - spread / 2} ${sat}% ${light}%) 0%,`,
          `hsl(${hue} ${sat * 0.7}% ${light * 0.6}%) 46%,`,
          `hsl(${hue + spread / 2} ${sat * 0.5}% ${light * 0.38}%) 100%)`,
        ].join(" "),
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Atmosphere
 * ------------------------------------------------------------------ */

export interface AtmosphereProps {
  hue?: number;
  /** Number of drifting light pools. Kept low - each one is a large blur. */
  count?: number;
  intensity?: number;
  speed?: number;
}

/**
 * Drifting pools of coloured light.
 *
 * Implemented as heavily blurred radial gradients rather than SVG filters:
 * a `filter: blur()` on a 900px element is a single GPU pass, whereas an
 * equivalent `feGaussianBlur` is rasterised on the CPU by Chromium and costs
 * roughly an order of magnitude more per frame.
 */
export const Atmosphere: React.FC<AtmosphereProps> = ({
  hue = 250,
  count = 3,
  intensity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const pools = useMemo(
    () =>
      Array.from({ length: Math.min(6, Math.max(1, count)) }, (_, i) => ({
        seed: i,
        size: mix(seededRandom(i * 3 + 1), 0.5, 0.95),
        hue: hue + mix(seededRandom(i * 7 + 2), -40, 40),
        period: mix(seededRandom(i * 11 + 3), 420, 900),
        phase: seededRandom(i * 13 + 5),
        baseX: mix(seededRandom(i * 17 + 7), 0.1, 0.9),
        baseY: mix(seededRandom(i * 19 + 11), 0.1, 0.9),
      })),
    [count, hue],
  );

  return (
    <AbsoluteFill>
      {pools.map((pool) => {
        const dx = (oscillate(frame * speed, pool.period, pool.phase) - 0.5) * 0.22;
        const dy = (oscillate(frame * speed, pool.period * 1.37, pool.phase) - 0.5) * 0.18;
        const size = Math.max(width, height) * pool.size;
        const alpha = 0.3 * intensity * mix(oscillate(frame * speed, pool.period * 0.8, pool.phase), 0.65, 1);

        return (
          <div
            key={pool.seed}
            style={{
              position: "absolute",
              left: `${(pool.baseX + dx) * 100}%`,
              top: `${(pool.baseY + dy) * 100}%`,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: `radial-gradient(circle, hsl(${pool.hue} 70% 58% / ${alpha}) 0%, transparent 68%)`,
              filter: `blur(${size * 0.08}px)`,
              // `screen` keeps overlapping pools reading as light rather than
              // as stacked translucent discs.
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * ParticleField
 * ------------------------------------------------------------------ */

export interface ParticleFieldProps {
  count?: number;
  hue?: number;
  /** Vertical drift in composition heights per 1000 frames. Negative rises. */
  drift?: number;
  intensity?: number;
  /** Largest particle diameter in pixels. */
  size?: number;
}

const MAX_PARTICLES = 220;

/**
 * Slowly rising motes of light with depth-based parallax.
 *
 * Particles are laid out once from their seed and only their offset is
 * recomputed per frame, so the cost per frame is a transform per element
 * rather than a full layout. The `depth` term drives size, opacity and
 * speed together - varying them independently is what makes particle fields
 * look artificial.
 */
export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 60,
  hue = 250,
  drift = -0.35,
  intensity = 1,
  size = 5,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = useMemo(() => {
    const n = Math.min(MAX_PARTICLES, Math.max(0, Math.round(count)));
    return Array.from({ length: n }, (_, i) => {
      const depth = seededRandom(i * 5 + 1); // 0 = far, 1 = near
      return {
        i,
        depth,
        x: seededRandom(i * 9 + 2),
        y: seededRandom(i * 13 + 3),
        size: mix(depth, size * 0.25, size),
        alpha: mix(depth, 0.12, 0.55) * intensity,
        speed: mix(depth, 0.35, 1.2),
        swayPeriod: mix(seededRandom(i * 21 + 5), 180, 520),
        swayPhase: seededRandom(i * 23 + 7),
        hue: hue + mix(seededRandom(i * 29 + 11), -25, 25),
      };
    });
  }, [count, hue, intensity, size]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {particles.map((p) => {
        // Wrap with modulo so the field never empties out, however long the
        // composition runs - important now that duration is unbounded.
        const travelled = p.y + (frame * drift * p.speed) / 1000;
        const y = ((travelled % 1) + 1) % 1;
        const sway = (oscillate(frame, p.swayPeriod, p.swayPhase) - 0.5) * 0.03;

        return (
          <div
            key={p.i}
            style={{
              position: "absolute",
              left: (p.x + sway) * width,
              top: y * height,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: `hsl(${p.hue} 80% 82% / ${p.alpha})`,
              boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue} 90% 70% / ${p.alpha * 0.7})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * LightField
 * ------------------------------------------------------------------ */

export interface LightFieldProps {
  hue?: number;
  count?: number;
  intensity?: number;
  /** Streak angle in degrees. */
  angle?: number;
}

/**
 * Volumetric light streaks - the shafts that fall across a dark set.
 *
 * Each streak is a rotated gradient bar with a soft blur. They sweep on a
 * long period so the movement is felt rather than watched.
 */
export const LightField: React.FC<LightFieldProps> = ({
  hue = 250,
  count = 3,
  intensity = 1,
  angle = -18,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const diagonal = Math.hypot(width, height);

  const streaks = useMemo(
    () =>
      Array.from({ length: Math.min(8, Math.max(1, count)) }, (_, i) => ({
        i,
        x: mix(seededRandom(i * 31 + 3), 0.05, 0.95),
        width: mix(seededRandom(i * 37 + 5), 0.04, 0.14),
        alpha: mix(seededRandom(i * 41 + 7), 0.05, 0.16),
        period: mix(seededRandom(i * 43 + 11), 500, 1100),
        phase: seededRandom(i * 47 + 13),
      })),
    [count],
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {streaks.map((s) => {
        const sweep = (oscillate(frame, s.period, s.phase) - 0.5) * 0.18;
        const alpha = s.alpha * intensity * mix(oscillate(frame, s.period * 1.6, s.phase), 0.5, 1);

        return (
          <div
            key={s.i}
            style={{
              position: "absolute",
              left: `${(s.x + sweep) * 100}%`,
              top: "50%",
              width: s.width * width,
              height: diagonal * 1.6,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              background: `linear-gradient(to bottom, transparent 0%, hsl(${hue} 60% 78% / ${alpha}) 45%, transparent 100%)`,
              filter: `blur(${s.width * width * 0.4}px)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * NoiseOverlay
 * ------------------------------------------------------------------ */

export interface NoiseOverlayProps {
  /** 0..1. Above ~0.08 the grain stops being texture and becomes an effect. */
  opacity?: number;
  /** Re-seed the turbulence every N frames for animated grain. 0 = static. */
  animateEvery?: number;
  scale?: number;
}

/**
 * Film grain.
 *
 * This is the single highest-value component in the file. Flat CSS gradients
 * read as "web page"; the same gradients under a few percent of grain read
 * as "footage", because real cameras have sensor noise and audiences have
 * decades of conditioning to expect it.
 *
 * `feTurbulence` is rasterised once per distinct seed, so static grain is
 * effectively free while animated grain costs a raster per step - hence the
 * `animateEvery` throttle rather than a new seed every frame.
 */
export const NoiseOverlay: React.FC<NoiseOverlayProps> = ({
  opacity = 0.045,
  animateEvery = 0,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const seed = animateEvery > 0 ? Math.floor(frame / animateEvery) : 0;

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`rm-grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.8 / scale}
            numOctaves={3}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#rm-grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * Glow / Vignette / GlassSurface
 * ------------------------------------------------------------------ */

export interface GlowProps {
  hue?: number;
  x?: number;
  y?: number;
  /** Fraction of the larger composition dimension. */
  size?: number;
  intensity?: number;
}

/** A single soft light source. The building block behind most key lighting. */
export const Glow: React.FC<GlowProps> = ({
  hue = 250,
  x = 0.5,
  y = 0.4,
  size = 0.8,
  intensity = 1,
}) => {
  const { width, height } = useVideoConfig();
  const px = Math.max(width, height) * size;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: px,
        height: px,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle, hsl(${hue} 80% 62% / ${0.28 * intensity}) 0%, transparent 65%)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
};

export interface VignetteProps {
  intensity?: number;
}

/**
 * Corner darkening.
 *
 * Always the last thing composited. A vignette pulls the eye to the centre
 * of frame and is the cheapest way to make a flat background read as a lit
 * one, but applied under other layers it just makes them look dirty.
 */
export const Vignette: React.FC<VignetteProps> = ({ intensity = 1 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / ${0.55 * intensity}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  radius?: number;
  /** 0..1 tint strength of the surface itself. */
  tint?: number;
  blur?: number;
  style?: React.CSSProperties;
}

/**
 * A translucent panel.
 *
 * Restrained on purpose: a 1px inner highlight along the top edge and a soft
 * drop shadow, which is what real frosted glass does under a light source.
 * The heavy-saturation, thick-border treatment that "glassmorphism" usually
 * means is explicitly not what this is.
 */
export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  radius = 24,
  tint = 1,
  blur = 24,
  style,
}) => (
  <div
    style={{
      position: "relative",
      borderRadius: radius,
      background: `linear-gradient(160deg, rgb(255 255 255 / ${0.1 * tint}) 0%, rgb(255 255 255 / ${0.035 * tint}) 100%)`,
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`,
      boxShadow: [
        `inset 0 1px 0 0 rgb(255 255 255 / ${0.22 * tint})`,
        `inset 0 0 0 1px rgb(255 255 255 / ${0.07 * tint})`,
        "0 40px 80px -20px rgb(0 0 0 / 0.55)",
      ].join(", "),
      ...style,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ *
 * DepthBackground
 * ------------------------------------------------------------------ */

export interface DepthBackgroundProps {
  hue?: number;
  intensity?: number;
  speed?: number;
  particles?: number;
  grain?: number;
  vignette?: number;
}

/**
 * The composed background: gradient, atmosphere, light shafts, particles,
 * vignette, grain - in that order.
 *
 * The order is the whole point and is why this exists rather than leaving
 * callers to stack the pieces. Grain must sit above everything or it looks
 * like a texture *behind* glass; the vignette must sit above the light and
 * below the grain, or it darkens the noise instead of the image.
 */
export const DepthBackground: React.FC<DepthBackgroundProps> = ({
  hue = 250,
  intensity = 1,
  speed = 1,
  particles = 55,
  grain = 0.05,
  vignette = 1,
}) => (
  <AbsoluteFill>
    <CinematicGradient hue={hue} intensity={intensity} speed={speed} />
    <Atmosphere hue={hue} intensity={intensity * 0.9} speed={speed} />
    <LightField hue={hue} intensity={intensity * 0.8} />
    <ParticleField hue={hue} count={particles} intensity={intensity} />
    <Vignette intensity={vignette} />
    <NoiseOverlay opacity={grain} />
  </AbsoluteFill>
);

/**
 * Background components addressable from `project.json` by name.
 *
 * A `background` layer stores `props.kind`, which indexes this table. Keeping
 * it as an explicit allow-list rather than a dynamic lookup means a project
 * file can never name a component that does not exist, and the inspector can
 * enumerate the options.
 */
export const BACKGROUND_REGISTRY = {
  cinematicGradient: { label: "Cinematic gradient", component: CinematicGradient },
  atmosphere: { label: "Atmosphere", component: Atmosphere },
  particleField: { label: "Particle field", component: ParticleField },
  lightField: { label: "Light field", component: LightField },
  noise: { label: "Grain", component: NoiseOverlay },
  glow: { label: "Glow", component: Glow },
  vignette: { label: "Vignette", component: Vignette },
  depth: { label: "Depth (composed)", component: DepthBackground },
} as const;

export type BackgroundKind = keyof typeof BACKGROUND_REGISTRY;
