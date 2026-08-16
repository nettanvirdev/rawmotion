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
import { mix, oscillate, progress, springProgress, staggerDelay } from "./timing";

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
  accent = "#8b9bff",
  size = 112,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = (delay: number) => {
    const t = springProgress(frame, fps, delay, "cinematic");
    return {
      opacity: progress(frame, delay, 18, "outExpo"),
      transform: `translateY(${(1 - t) * 26}px)`,
    };
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        gap: 20,
        fontFamily: SANS,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            ...rise(0),
            fontSize: size * 0.15,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          ...rise(4),
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.02,
          color: "#ffffff",
          // A faint gradient down the type gives display text the same
          // top-lit falloff as the rest of the frame. Flat white reads as UI.
          background: "linear-gradient(180deg, #ffffff 0%, #c9cbd6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {text}
      </div>

      {caption ? (
        <div
          style={{
            ...rise(14),
            fontSize: size * 0.2,
            fontWeight: 400,
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
            color: "rgb(255 255 255 / 0.55)",
            maxWidth: size * 8,
          }}
        >
          {caption}
        </div>
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
  accent = "#8b9bff",
  width = 720,
  height = 440,
  sway = 2.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
              background: `linear-gradient(145deg, ${accent}, ${accent}44)`,
              boxShadow: `0 8px 24px -6px ${accent}88`,
            }}
          />
          {badge ? (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 15,
                letterSpacing: "0.06em",
                color: "rgb(255 255 255 / 0.45)",
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
              color: "#ffffff",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 22,
              color: "rgb(255 255 255 / 0.5)",
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
  accent = "#8b9bff",
  fontSize = 34,
}) => {
  const frame = useCurrentFrame();
  const lines = items.split("\n").filter((l) => l.trim().length > 0);

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
                background: accent,
                boxShadow: `0 0 ${fontSize * 0.6}px ${accent}`,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize,
                fontWeight: 400,
                letterSpacing: "-0.015em",
                color: "rgb(255 255 255 / 0.82)",
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
  accent = "#8b9bff",
  size = 96,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = progress(frame, 0, 34, "outExpo");
  const settle = springProgress(frame, fps, 10, "cinematic");

  const perimeter = 190;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, fontFamily: SANS }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <rect
          x="6" y="12" width="52" height="40" rx="11"
          stroke={accent}
          strokeWidth="3"
          strokeDasharray={perimeter}
          strokeDashoffset={perimeter * (1 - draw)}
          opacity={0.9}
        />
        <path
          d="M26 24 L42 32 L26 40 Z"
          fill="#ffffff"
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
          color: "#ffffff",
          opacity: progress(frame, 12, 24, "outExpo"),
          transform: `translateX(${(1 - settle) * -14}px)`,
        }}
      >
        {wordmark}
      </div>
    </div>
  );
};
