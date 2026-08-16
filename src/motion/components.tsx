/**
 * Composable motion components.
 *
 * These are the "real" building blocks a `component` layer points at - the
 * level above shapes and text where a single tag produces a finished piece
 * of design:
 *
 *   <ProductCard title="Raw Motion" caption="Motion design, natively" />
 *
 * Everything here is deliberately expressible as props, because those props
 * are what the inspector edits and what an agent writes into `project.json`.
 * A component that needs children or a render prop cannot be driven from the
 * model, so it does not belong in the registry.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { GlassSurface } from "./backgrounds";
import { MaskedLines, WordReveal } from "./text";
import { mix, oscillate, progress, springProgress, staggerDelay } from "./timing";
import { themed, useTheme } from "./theme";

const SANS =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/* ------------------------------------------------------------------ *
 * HeroTitle
 * ------------------------------------------------------------------ */

export interface HeroTitleProps {
  text?: string;
  eyebrow?: string;
  caption?: string;
  accent?: string;
  size?: number;
  align?: "left" | "center";
}

/**
 * A title block: eyebrow, display line, caption.
 *
 * The three parts arrive on a stagger, but not an even one - the eyebrow
 * leads, the title follows closely, and the caption trails further behind.
 * Even spacing between three elements reads as a list; uneven spacing reads
 * as a sentence being spoken.
 */
export const HeroTitle: React.FC<HeroTitleProps> = ({
  text = "Introducing Raw Motion",
  eyebrow = "",
  caption = "",
  accent,
  size = 112,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  // The eyebrow leads, the title follows closely, the caption trails
  // further behind. Even spacing between three elements reads as a list;
  // uneven spacing reads as a sentence being spoken.
  const eyebrowIn = progress(frame, 0, 22, "outExpo");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        gap: size * 0.17,
        fontFamily: SANS,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            opacity: eyebrowIn,
            transform: `translateY(${(1 - eyebrowIn) * 10}px)`,
            fontSize: size * 0.15,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: tint,
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      {/* Masked line reveal rather than a fade. A fade implies the words
          were always there; rising out of a mask gives the eye a direction
          and a cause. It is also the only way a multi-line headline reads
          as one deliberate movement instead of a block appearing. */}
      <MaskedLines
        text={text}
        delay={4}
        stagger={5}
        duration={32}
        align={align}
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.04,
          color: theme.text,
        }}
        lineStyle={{
          // A faint gradient down the type gives display text the same
          // top-lit falloff as the rest of the frame. Flat white reads as UI.
          background: `linear-gradient(180deg, ${theme.text} 0%, ${theme.textDim} 130%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      />

      {caption ? (
        <WordReveal
          text={caption}
          delay={20}
          stagger={1.4}
          duration={24}
          align={align}
          maxWidth={size * 8.5}
          style={{
            fontSize: size * 0.21,
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
            color: theme.textDim,
          }}
        />
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * ProductCard
 * ------------------------------------------------------------------ */

export interface ProductCardProps {
  title?: string;
  caption?: string;
  badge?: string;
  accent?: string;
  width?: number;
  height?: number;
  /** Degrees of continuous 3D sway. 0 holds the card still. */
  sway?: number;
}

/**
 * A floating glass product card with a live 3D tilt.
 *
 * The sway is small (a couple of degrees) and slow (a ~7-second period) on
 * purpose: enough that the surface catches light differently over a shot,
 * not enough that the viewer registers it as an animation. `perspective` is
 * set on the wrapper rather than the card so the rotation reads as depth.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  title = "Raw Motion",
  caption = "AI-native motion design",
  badge = "v1.0",
  accent,
  width = 720,
  height = 440,
  sway = 2.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  const enter = springProgress(frame, fps, 0, "cinematic");
  const rotY = (oscillate(frame, 210) - 0.5) * 2 * sway;
  const rotX = (oscillate(frame, 290, 0.25) - 0.5) * 2 * (sway * 0.45);
  const float = (oscillate(frame, 260, 0.4) - 0.5) * 14;

  return (
    <div style={{ perspective: 1800 }}>
      <GlassSurface
        radius={28}
        blur={28}
        style={{
          width,
          height,
          padding: 44,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: [
            `translateY(${mix(enter, 60, 0) + float}px)`,
            `rotateX(${rotX}deg)`,
            `rotateY(${rotY}deg)`,
            `scale(${mix(enter, 0.94, 1)})`,
          ].join(" "),
          opacity: progress(frame, 0, 20, "outExpo"),
          fontFamily: SANS,
        }}
      >
        {/* Specular highlight. A real pane of glass under a key light has a
            bright edge where the light grazes it; without this the surface
            reads as flat translucent plastic. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            background: `linear-gradient(${115 + rotY * 4}deg, transparent 30%, rgb(255 255 255 / 0.09) 47%, transparent 62%)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: `linear-gradient(145deg, ${tint}, ${tint}44)`,
              boxShadow: `0 8px 24px -6px ${tint}88`,
            }}
          />
          {badge ? (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 15,
                letterSpacing: "0.06em",
                color: theme.textDim,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgb(255 255 255 / 0.05)",
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        <div>
          <div
            style={{
              fontSize: 54,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: theme.text,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 22,
              color: theme.textDim,
              letterSpacing: "-0.01em",
            }}
          >
            {caption}
          </div>
        </div>
      </GlassSurface>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * FeatureList
 * ------------------------------------------------------------------ */

export interface FeatureListProps {
  /** Newline-separated so the whole component stays editable from a text field. */
  items?: string;
  accent?: string;
  fontSize?: number;
}

/**
 * A staggered list of feature lines.
 *
 * Items are a newline-delimited string rather than an array because the
 * inspector edits props through form controls and an agent writes them as
 * JSON: a textarea serves both, an array-of-objects editor serves neither
 * well at this stage.
 */
export const FeatureList: React.FC<FeatureListProps> = ({
  items = "Code-first compositions\nLive preview\nFrame-accurate export",
  accent,
  fontSize = 34,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const lines = String(items).replace(/\\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fontSize * 0.7, fontFamily: SANS }}>
      {lines.map((line, i) => {
        const delay = staggerDelay(i, lines.length, 6, 40);
        const t = progress(frame, delay, 22, "outExpo");
        return (
          <div
            key={line}
            style={{
              display: "flex",
              alignItems: "center",
              gap: fontSize * 0.55,
              opacity: t,
              transform: `translateX(${(1 - t) * 24}px)`,
            }}
          >
            <div
              style={{
                width: fontSize * 0.22,
                height: fontSize * 0.22,
                borderRadius: "50%",
                background: tint,
                boxShadow: `0 0 ${fontSize * 0.6}px ${tint}`,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize,
                fontWeight: 400,
                letterSpacing: "-0.015em",
                color: theme.text,
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * LogoLockup
 * ------------------------------------------------------------------ */

export interface LogoLockupProps {
  wordmark?: string;
  accent?: string;
  size?: number;
}

/**
 * The end-card mark: a drawn glyph beside a wordmark.
 *
 * The glyph strokes on via `stroke-dashoffset` rather than fading in, which
 * is the one place in the system where a draw-on is worth its cost - an
 * outro holds long enough for the eye to follow the line.
 */
export const LogoLockup: React.FC<LogoLockupProps> = ({
  wordmark = "Raw Motion",
  accent,
  size = 96,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const draw = progress(frame, 0, 34, "outExpo");
  const settle = springProgress(frame, fps, 10, "cinematic");

  const perimeter = 190;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, fontFamily: SANS }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <rect
          x="6" y="12" width="52" height="40" rx="11"
          stroke={tint}
          strokeWidth="3"
          strokeDasharray={perimeter}
          strokeDashoffset={perimeter * (1 - draw)}
          opacity={0.9}
        />
        <path
          d="M26 24 L42 32 L26 40 Z"
          fill={theme.text}
          opacity={progress(frame, 16, 18, "outExpo")}
          transform={`scale(${mix(springProgress(frame, fps, 16, "crisp"), 0.7, 1)})`}
          style={{ transformOrigin: "34px 32px" }}
        />
      </svg>

      <div
        style={{
          fontSize: size * 0.5,
          fontWeight: 500,
          letterSpacing: "-0.03em",
          color: theme.text,
          opacity: progress(frame, 12, 24, "outExpo"),
          transform: `translateX(${(1 - settle) * -14}px)`,
        }}
      >
        {wordmark}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * GlassCard
 * ------------------------------------------------------------------ */

export interface GlassCardProps {
  title?: string;
  caption?: string;
  eyebrow?: string;
  accent?: string;
  width?: number;
  height?: number;
  /** Degrees of continuous 3D sway. 0 holds it still. */
  sway?: number;
  /** Corner radius. Large values are the point - see the note below. */
  radius?: number;
}

/**
 * A frosted glass card in the Apple idiom.
 *
 * Distinct from `ProductCard`, which is dark glass lit from behind. This is
 * the light treatment: a translucent white pane over a soft chromatic ground,
 * with the specific details that make the material read as glass rather than
 * as a semi-transparent rectangle.
 *
 * The four that actually matter:
 *
 * 1. **Backdrop blur with saturation boost.** `blur()` alone gives frosted
 *    plastic. Real glass concentrates the colour behind it, so the
 *    `saturate(180%)` is doing as much work as the blur.
 * 2. **A very large corner radius.** Apple's hardware and software both use
 *    continuous curvature at radii most designers think are too big. At 40px
 *    on a 720px card it stops looking like a rounded box and starts looking
 *    like an object.
 * 3. **A bright top edge and a dim bottom one.** A pane lit from above
 *    catches light on its top bevel and shades on its lower. One inset
 *    highlight and one inset shadow is the whole trick.
 * 4. **Two shadows, not one.** A tight contact shadow plus a wide soft one.
 *    A single shadow reads as a sticker; two read as an object at a height.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  title = "Raw Motion",
  caption = "Motion design, natively",
  eyebrow = "",
  accent,
  width = 720,
  height = 420,
  sway = 1.8,
  radius = 42,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  const enter = springProgress(frame, fps, 0, "cinematic");
  const rotY = (oscillate(frame, 260) - 0.5) * 2 * sway;
  const rotX = (oscillate(frame, 340, 0.25) - 0.5) * 2 * (sway * 0.4);
  const float = (oscillate(frame, 300, 0.4) - 0.5) * 10;

  return (
    <div style={{ perspective: 2200 }}>
      <div
        style={{
          position: "relative",
          width,
          height,
          padding: width * 0.075,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          borderRadius: radius,
          background:
            "linear-gradient(150deg, rgb(255 255 255 / 0.78) 0%, rgb(255 255 255 / 0.58) 100%)",
          backdropFilter: "blur(48px) saturate(180%)",
          WebkitBackdropFilter: "blur(48px) saturate(180%)",
          boxShadow: [
            // Top bevel catching the light, lower edge in shade.
            "inset 0 1.5px 0 0 rgb(255 255 255 / 0.95)",
            "inset 0 -1px 0 0 rgb(0 0 0 / 0.05)",
            "inset 0 0 0 1px rgb(255 255 255 / 0.6)",
            // Contact shadow, then the wide one that places it in space.
            "0 2px 10px -2px rgb(0 0 0 / 0.07)",
            "0 40px 90px -24px rgb(0 0 0 / 0.22)",
          ].join(", "),
          transform: [
            `translateY(${mix(enter, 48, 0) + float}px)`,
            `rotateX(${rotX}deg)`,
            `rotateY(${rotY}deg)`,
            `scale(${mix(enter, 0.96, 1)})`,
          ].join(" "),
          opacity: progress(frame, 0, 22, "outExpo"),
          fontFamily: SANS,
        }}
      >
        {/* Specular sweep. Tied to the sway so the highlight tracks the
            surface angle - a static highlight on a moving pane immediately
            reads as a texture rather than as a reflection. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            background: `linear-gradient(${112 + rotY * 6}deg, transparent 32%, rgb(255 255 255 / 0.55) 46%, transparent 58%)`,
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: width * 0.075,
            left: width * 0.075,
            width: width * 0.1,
            height: width * 0.1,
            borderRadius: width * 0.028,
            background: `linear-gradient(150deg, ${tint}, ${tint}88)`,
            boxShadow: `0 10px 26px -6px ${tint}66, inset 0 1px 0 0 rgb(255 255 255 / 0.5)`,
          }}
        />

        {eyebrow ? (
          <div
            style={{
              fontSize: width * 0.026,
              fontWeight: 590,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: tint,
              marginBottom: width * 0.018,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <div
          style={{
            fontSize: width * 0.082,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            color: theme.text,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: width * 0.016,
            fontSize: width * 0.032,
            fontWeight: 400,
            letterSpacing: "-0.012em",
            color: theme.textDim,
          }}
        >
          {caption}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * GlassBar
 * ------------------------------------------------------------------ */

export interface GlassBarProps {
  /** Pipe-separated labels: `Overview | Library | Settings`. */
  items?: string;
  /** 1-based index of the selected item. */
  active?: number;
  accent?: string;
  fontSize?: number;
  radius?: number;
}

/**
 * A floating frosted toolbar with a sliding selection pill.
 *
 * The pill is what sells it. Apple's segmented controls animate the
 * *selection* between positions rather than cross-fading two states, so the
 * eye tracks one object moving instead of two things changing - and that
 * single detail is most of why their interfaces feel physical.
 */
export const GlassBar: React.FC<GlassBarProps> = ({
  items = "Overview | Library | Settings",
  active = 1,
  accent,
  fontSize = 26,
  radius = 999,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  const labels = String(items)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const target = Math.min(labels.length, Math.max(1, Math.round(active))) - 1;
  // The pill starts at the first item and springs to the active one, so the
  // move is visible rather than already finished on frame zero.
  const slide = springProgress(frame, fps, 18, "smooth");
  const position = mix(slide, 0, target);

  const padX = fontSize * 1.15;
  const itemWidth = fontSize * 6.2;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        padding: fontSize * 0.34,
        borderRadius: radius,
        background: "linear-gradient(150deg, rgb(255 255 255 / 0.72) 0%, rgb(255 255 255 / 0.52) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: [
          "inset 0 1.5px 0 0 rgb(255 255 255 / 0.95)",
          "inset 0 0 0 1px rgb(255 255 255 / 0.55)",
          "0 2px 8px -2px rgb(0 0 0 / 0.06)",
          "0 26px 60px -20px rgb(0 0 0 / 0.2)",
        ].join(", "),
        fontFamily: SANS,
        opacity: progress(frame, 0, 20, "outExpo"),
        transform: `translateY(${mix(progress(frame, 0, 26, "outExpo"), 16, 0)}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: fontSize * 0.34,
          left: fontSize * 0.34 + position * itemWidth,
          width: itemWidth,
          height: fontSize * 2.1,
          borderRadius: radius,
          background: "rgb(255 255 255 / 0.9)",
          boxShadow: "0 2px 8px -2px rgb(0 0 0 / 0.12), inset 0 0 0 1px rgb(255 255 255 / 0.9)",
        }}
      />

      {labels.map((label, i) => (
        <div
          key={label}
          style={{
            position: "relative",
            width: itemWidth,
            height: fontSize * 2.1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: `0 ${padX}px`,
            fontSize,
            fontWeight: 500,
            letterSpacing: "-0.012em",
            color: i === target ? tint : theme.textDim,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
};
