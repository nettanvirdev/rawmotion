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



/**
 * Compensate for how much a hue brightens under `screen` blending.
 *
 * OKLCH makes two poles perceptually equal in lightness, but the poles are
 * composited with `screen`, which operates per-channel in sRGB. Amber has
 * high red *and* green, so four overlapping amber poles pile up far more
 * luminance than four violet ones at the identical OKLCH lightness - which
 * is why an amber theme came out as a milky wash while violet looked right.
 *
 * This scales alpha down for the hues that screen brightest. The curve peaks
 * its reduction around OKLCH hue 95 (yellow-green, the brightest region) and
 * leaves blue-violet near 275 untouched.
 */
function screenCompensation(hue: number): number {
  const radians = ((hue - 95) * Math.PI) / 180;
  // 0.55 at the yellow-green peak, 1.0 at blue-violet.
  return 1 - 0.45 * ((1 + Math.cos(radians)) / 2);
}

/* ------------------------------------------------------------------ *
 * MeshGradient
 * ------------------------------------------------------------------ */

export interface MeshGradientProps {
  hue?: number;
  /** Degrees of hue variation between the blobs. */
  hueSpread?: number;
  intensity?: number;
  speed?: number;
  /** Number of colour poles. Four reads as a mesh; more turns to mud. */
  points?: number;
  light?: boolean;
  /**
   * Wider, gentler poles that bleed into each other rather than reading as
   * discrete lights. This is the difference between "coloured lighting" and
   * the soft chromatic wash Apple puts behind hardware.
   */
  soft?: number;
}

/**
 * A mesh gradient - several soft colour poles bleeding into one another.
 *
 * This is the backdrop the current technical-SaaS look is built on. It
 * replaces the particle field as the default because particles read as a
 * screensaver, whereas a mesh reads as a lit surface: the eye interprets the
 * soft falloff as light in a space rather than as objects in front of a
 * camera.
 *
 * Rendered as large blurred radial gradients rather than an SVG mesh:
 * `filter: blur()` on a handful of divs is one GPU pass, while an equivalent
 * SVG displacement mesh is rasterised on the CPU per frame.
 */
export const MeshGradient: React.FC<MeshGradientProps> = ({
  hue = 252,
  hueSpread = 40,
  intensity = 1,
  speed = 1,
  points = 4,
  light = false,
  soft = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const poles = useMemo(
    () =>
      Array.from({ length: Math.min(6, Math.max(2, points)) }, (_, i) => ({
        i,
        hue: hue + mix(seededRandom(i * 7 + 1), -hueSpread / 2, hueSpread / 2),
        x: mix(seededRandom(i * 11 + 3), 0.05, 0.95),
        // Biased to the upper half. Light comes from above in every lit
        // scene; poles scattered evenly across the frame read as a coloured
        // wash rather than as a lit space, and wash is exactly the failure
        // mode that makes a gradient background look cheap.
        y: mix(seededRandom(i * 13 + 5), -0.15, 0.72),
        // Fraction of the diagonal. On a dark ground the poles are meant to
        // be larger than the frame - they are ambient light. On a light one
        // they have to be *smaller*, or every pole overlaps every other and
        // a deliberately wide hue spread averages into a single flat tint.
        size: light
          ? mix(seededRandom(i * 17 + 7), 0.42, 0.72)
          : mix(seededRandom(i * 17 + 7), 0.7, 1.25) * (1 + soft * 0.5),
        period: mix(seededRandom(i * 19 + 11), 520, 1000),
        phase: seededRandom(i * 23 + 13),
      })),
    [hue, hueSpread, points, light, soft],
  );

  const diagonal = Math.hypot(width, height);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {poles.map((pole) => {
        // Poles drift slowly and independently. A mesh whose poles move in
        // lockstep reads as one sliding image rather than as flowing light.
        const dx = (oscillate(frame * speed, pole.period, pole.phase) - 0.5) * 0.16;
        const dy = (oscillate(frame * speed, pole.period * 1.31, pole.phase) - 0.5) * 0.14;
        const size = diagonal * pole.size;

        // Deliberately low. An earlier pass used more than double this and
        // the result was a saturated wash that fought the content and banded
        // badly at video bitrates - flat saturated areas are exactly where
        // h264 blocking shows. The reference look (Linear, Vercel, Stripe) is
        // much darker than it appears: mostly near-black, colour implied.
        //
        // A light theme multiplies onto an already-light field, so the same
        // alpha that reads as "a hint of colour" on black reads as a heavy
        // wash on white, and needs roughly half the strength.
        const alpha =
          (light ? 0.3 : 0.17) * intensity * screenCompensation(pole.hue);
        const lightness = light ? 0.74 : 0.56;
        // Light grounds need *more* chroma, not less. On a dark field the eye
        // reads a faint tint as coloured light; on near-white the same tint
        // reads as dirt, and the frosted panels above have nothing worth
        // refracting. The soft variant spreads rather than desaturates.
        const chroma = light ? 0.13 : 0.13 * (soft ? 0.85 : 1);

        return (
          <div
            key={pole.i}
            style={{
              position: "absolute",
              left: `${(pole.x + dx) * 100}%`,
              top: `${(pole.y + dy) * 100}%`,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: `radial-gradient(circle, oklch(${lightness} ${chroma} ${pole.hue} / ${alpha}) 0%, transparent 62%)`,
              filter: `blur(${size * (soft ? 0.13 : 0.1)}px)`,
              // Dark grounds screen - overlapping poles read as light adding
              // up. Light grounds composite normally: `multiply` makes every
              // overlap converge toward a muddy average, so a deliberately
              // wide hue spread collapsed into one uniform lavender instead
              // of holding distinct pink and blue regions.
              mixBlendMode: light ? "normal" : "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * DotGrid
 * ------------------------------------------------------------------ */

export interface DotGridProps {
  /** 0..1 overall strength. */
  intensity?: number;
  /** Pixel spacing between dots at 1080p. */
  spacing?: number;
  dotSize?: number;
  color?: string;
  /** Fade the grid out toward the edges so it does not tile visibly. */
  mask?: boolean;
}

/**
 * A dot matrix.
 *
 * The single most recognisable cue in modern developer-product design, and
 * the cheapest way to make a frame read as "technical" rather than
 * "decorative". Implemented as a repeating radial-gradient background, so it
 * costs one paint regardless of how many dots are on screen - a DOM node per
 * dot would be tens of thousands of elements at this spacing.
 *
 * The radial mask matters more than it looks: an unmasked grid running to
 * the frame edge reads as a texture applied to the video, while one that
 * fades out reads as a surface receding into the dark.
 */
export const DotGrid: React.FC<DotGridProps> = ({
  intensity = 0.5,
  spacing = 32,
  dotSize = 1.6,
  color = "255 255 255",
  mask = true,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(circle at center, rgb(${color} / ${(0.5 * intensity).toFixed(3)}) ${dotSize}px, transparent ${dotSize}px)`,
      backgroundSize: `${spacing}px ${spacing}px`,
      maskImage: mask
        ? "radial-gradient(ellipse 75% 65% at 50% 45%, black 0%, transparent 100%)"
        : undefined,
      WebkitMaskImage: mask
        ? "radial-gradient(ellipse 75% 65% at 50% 45%, black 0%, transparent 100%)"
        : undefined,
    }}
  />
);

/* ------------------------------------------------------------------ *
 * GridLines
 * ------------------------------------------------------------------ */

export interface GridLinesProps {
  intensity?: number;
  spacing?: number;
  color?: string;
  mask?: boolean;
}

/** A ruled grid. Structural where `DotGrid` is textural. */
export const GridLines: React.FC<GridLinesProps> = ({
  intensity = 0.4,
  spacing = 96,
  color = "255 255 255",
  mask = true,
}) => {
  const line = `rgb(${color} / ${(0.16 * intensity).toFixed(3)})`;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
        maskImage: mask
          ? "radial-gradient(ellipse 80% 70% at 50% 40%, black 0%, transparent 100%)"
          : undefined,
        WebkitMaskImage: mask
          ? "radial-gradient(ellipse 80% 70% at 50% 40%, black 0%, transparent 100%)"
          : undefined,
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Spotlight
 * ------------------------------------------------------------------ */

export interface SpotlightProps {
  hue?: number;
  intensity?: number;
  /** Horizontal position, 0..1. */
  x?: number;
  /** How far down the frame the light reaches, 0..1. */
  reach?: number;
  light?: boolean;
}

/**
 * A wide light source above the frame.
 *
 * Gives the composition a direction for its light, which is what makes
 * everything below it look lit rather than merely coloured. Anchored off the
 * top edge so the source itself is never visible - a visible hotspot reads
 * as a lens flare, which is a different and much cheaper effect.
 */
export const Spotlight: React.FC<SpotlightProps> = ({
  hue = 252,
  intensity = 1,
  x = 0.5,
  reach = 0.85,
  light = false,
}) => {
  const frame = useCurrentFrame();
  const breathe = mix(oscillate(frame, 420), 0.88, 1);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse ${reach * 90}% ${reach * 70}% at ${x * 100}% -10%, oklch(${light ? 0.78 : 0.64} ${light ? 0.06 : 0.11} ${hue} / ${(0.14 * intensity * breathe * screenCompensation(hue)).toFixed(3)}) 0%, transparent 70%)`,
        mixBlendMode: light ? "multiply" : "screen",
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 * AuroraBands
 * ------------------------------------------------------------------ */

export interface AuroraBandsProps {
  hue?: number;
  hueSpread?: number;
  intensity?: number;
  speed?: number;
  bands?: number;
}

/**
 * Flowing ribbons of light.
 *
 * More movement than a mesh and less than a particle field. Each band is a
 * wide blurred conic slice on its own slow period, and they are deliberately
 * given prime-ish periods so the composite never visibly repeats within the
 * length of a film.
 */
export const AuroraBands: React.FC<AuroraBandsProps> = ({
  hue = 168,
  hueSpread = 64,
  intensity = 1,
  speed = 1,
  bands = 3,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const diagonal = Math.hypot(width, height);

  const ribbons = useMemo(
    () =>
      Array.from({ length: Math.min(5, Math.max(1, bands)) }, (_, i) => ({
        i,
        hue: hue + mix(seededRandom(i * 29 + 3), -hueSpread / 2, hueSpread / 2),
        y: mix(seededRandom(i * 31 + 5), 0.2, 0.8),
        thickness: mix(seededRandom(i * 37 + 7), 0.16, 0.34),
        period: [530, 670, 790, 910, 1030][i],
        phase: seededRandom(i * 41 + 11),
        tilt: mix(seededRandom(i * 43 + 13), -22, 22),
      })),
    [hue, hueSpread, bands],
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {ribbons.map((r) => {
        const drift = (oscillate(frame * speed, r.period, r.phase) - 0.5) * 0.3;
        const swell = mix(oscillate(frame * speed, r.period * 1.7, r.phase), 0.6, 1);

        return (
          <div
            key={r.i}
            style={{
              position: "absolute",
              left: "50%",
              top: `${(r.y + drift) * 100}%`,
              width: diagonal * 1.5,
              height: height * r.thickness,
              transform: `translate(-50%, -50%) rotate(${r.tilt}deg)`,
              background: `linear-gradient(to bottom, transparent 0%, oklch(0.66 0.14 ${r.hue} / ${(0.24 * intensity * swell * screenCompensation(r.hue)).toFixed(3)}) 50%, transparent 100%)`,
              filter: `blur(${height * r.thickness * 0.42}px)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * Beams
 * ------------------------------------------------------------------ */

export interface BeamsProps {
  hue?: number;
  intensity?: number;
  count?: number;
  angle?: number;
}

/** Hard-edged light shafts. Louder than `LightField`, for high-energy work. */
export const Beams: React.FC<BeamsProps> = ({
  hue = 288,
  intensity = 1,
  count = 4,
  angle = -22,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const diagonal = Math.hypot(width, height);

  const shafts = useMemo(
    () =>
      Array.from({ length: Math.min(8, Math.max(1, count)) }, (_, i) => ({
        i,
        x: (i + 0.5) / Math.min(8, Math.max(1, count)),
        width: mix(seededRandom(i * 53 + 3), 0.02, 0.07),
        alpha: mix(seededRandom(i * 59 + 5), 0.12, 0.3),
        period: mix(seededRandom(i * 61 + 7), 380, 820),
        phase: seededRandom(i * 67 + 11),
        hue: hue + mix(seededRandom(i * 71 + 13), -24, 24),
      })),
    [count, hue],
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {shafts.map((s) => {
        const sweep = (oscillate(frame, s.period, s.phase) - 0.5) * 0.1;
        const pulse = mix(oscillate(frame, s.period * 1.4, s.phase), 0.45, 1);

        return (
          <div
            key={s.i}
            style={{
              position: "absolute",
              left: `${(s.x + sweep) * 100}%`,
              top: "50%",
              width: s.width * width,
              height: diagonal * 1.8,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              background: `linear-gradient(to bottom, transparent 0%, oklch(0.72 0.16 ${s.hue} / ${(s.alpha * intensity * pulse * screenCompensation(s.hue)).toFixed(3)}) 50%, transparent 100%)`,
              filter: `blur(${s.width * width * 0.5}px)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * Studio
 * ------------------------------------------------------------------ */

export interface StudioProps {
  hue?: number;
  /** Softer, wider colour poles. The Apple-style light treatment. */
  soft?: number;
  hueSpread?: number;
  intensity?: number;
  speed?: number;
  /** 0 disables. Each of these is a layer in the stack. */
  dots?: number;
  grid?: number;
  spotlight?: number;
  aurora?: number;
  beams?: number;
  grain?: number;
  vignette?: number;
  light?: boolean;
}

/**
 * The composed studio backdrop. This is the one to reach for.
 *
 * Stack order is the entire point, and is why this exists rather than
 * leaving callers to layer the pieces themselves:
 *
 *   1. mesh gradient    the lit field
 *   2. aurora / beams   optional movement
 *   3. dot grid / grid  the technical surface, masked so it recedes
 *   4. spotlight        direction for the light
 *   5. vignette         pulls the eye to centre
 *   6. grain            over everything
 *
 * Grain has to be last or it looks like texture *behind* glass. The vignette
 * has to sit above the light and below the grain, or it darkens the noise
 * instead of the image. Getting this order wrong is the difference between
 * "lit space" and "gradient with stuff on it".
 */
export const Studio: React.FC<StudioProps> = ({
  hue = 252,
  hueSpread = 40,
  intensity = 1,
  speed = 1,
  dots = 0.5,
  grid = 0,
  spotlight = 0.9,
  aurora = 0,
  beams = 0,
  grain = 0.045,
  vignette = 1,
  light = false,
  soft = 0,
}) => (
  <AbsoluteFill>
    {/* A dark base beneath the mesh. Without it the mesh IS the background
        and its brightest pole sets the exposure of the whole frame; with it
        the mesh reads as light falling on a dark surface. */}
    {!light ? (
      <AbsoluteFill
        style={{
          // OKLCH, not HSL. HSL "lightness" is not perceptual: hue 28 at
          // L=7% reads far brighter than hue 252 at the same value, so an
          // amber theme came out as a milky brown wash while the identical
          // numbers in violet looked correct. In OKLCH, L is perceived
          // lightness, so one set of values holds across every hue.
          background: `linear-gradient(175deg, oklch(0.15 0.035 ${hue}) 0%, oklch(0.115 0.028 ${hue}) 55%, oklch(0.095 0.022 ${hue}) 100%)`,
        }}
      />
    ) : null}

    {/* Light ground. Without it a light theme renders on whatever the page
        happens to be, and the mesh has no surface to fall on. */}
    {light ? (
      <AbsoluteFill
        style={{
          background: `linear-gradient(170deg, oklch(0.985 0.002 ${hue}) 0%, oklch(0.966 0.003 ${hue}) 60%, oklch(0.951 0.004 ${hue}) 100%)`,
        }}
      />
    ) : null}

    <MeshGradient
      hue={hue}
      hueSpread={hueSpread}
      intensity={intensity}
      speed={speed}
      light={light}
      soft={soft}
    />

    {aurora > 0 ? (
      <AuroraBands hue={hue} hueSpread={hueSpread} intensity={aurora * intensity} speed={speed} />
    ) : null}
    {beams > 0 ? <Beams hue={hue} intensity={beams * intensity} /> : null}

    {grid > 0 ? (
      <GridLines intensity={grid} color={light ? "0 0 0" : "255 255 255"} />
    ) : null}
    {dots > 0 ? (
      <DotGrid intensity={dots} color={light ? "0 0 0" : "255 255 255"} />
    ) : null}

    {spotlight > 0 ? (
      <Spotlight hue={hue} intensity={spotlight} light={light} />
    ) : null}

    {/* The vignette does real work here: it re-darkens the lower corners the
        mesh lifts, which is what keeps the frame reading as lit rather than
        as tinted. */}
    {vignette > 0 && !light ? <Vignette intensity={vignette * 1.15} /> : null}
    {grain > 0 ? <NoiseOverlay opacity={grain} /> : null}
  </AbsoluteFill>
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
  studio: { label: "Studio (composed: mesh, dots, spotlight, vignette, grain)", component: Studio },
  mesh: { label: "Mesh gradient", component: MeshGradient },
  dotGrid: { label: "Dot grid", component: DotGrid },
  gridLines: { label: "Ruled grid", component: GridLines },
  spotlight: { label: "Spotlight", component: Spotlight },
  auroraBands: { label: "Aurora bands", component: AuroraBands },
  beams: { label: "Light beams", component: Beams },
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
