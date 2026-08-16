/**
 * Typography in motion.
 *
 * The house rule for text, and the thing that most separates designed
 * motion from generated motion: **type rises out of a mask, it does not
 * fade in from nowhere.**
 *
 * A fade implies the words were always there and the camera just noticed
 * them. A masked reveal implies they arrived - there is an edge they came
 * from, so the eye reads a direction and a cause. It costs one wrapper with
 * `overflow: hidden` per line and it is the difference between "AI made
 * this" and "someone made this".
 *
 * Everything here reveals by line, never by character, unless explicitly
 * asked. Per-character animation is a specific effect for short display
 * type; used on a sentence it destroys reading rhythm and, at 60 characters,
 * takes longer to finish than the shot.
 */

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { EASINGS, mix, progress, springProgress, staggerDelay } from "./timing";

export const DISPLAY_FONT =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
export const MONO_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace';

/* ------------------------------------------------------------------ *
 * MaskedLines
 * ------------------------------------------------------------------ */

export interface MaskedLinesProps {
  text: string;
  /** Frames before the first line begins. */
  delay?: number;
  /** Frames between consecutive lines. */
  stagger?: number;
  /** Length of one line's travel. */
  duration?: number;
  /** Reveal downward instead of upward. */
  fromBelow?: boolean;
  style?: React.CSSProperties;
  lineStyle?: React.CSSProperties;
  align?: "left" | "center" | "right";
}

/**
 * Reveal text line by line from behind a mask.
 *
 * Each line gets a clipping wrapper the height of one line box, and the line
 * itself translates up into it. `lineHeight` is applied to the wrapper as a
 * pixel height rather than left to the inline box, because a mask sized by
 * line-height alone clips descenders - the tails of "g" and "y" get shaved,
 * which is the kind of detail nobody can name but everyone notices.
 */
export const MaskedLines: React.FC<MaskedLinesProps> = ({
  text,
  delay = 0,
  stagger = 4,
  duration = 26,
  fromBelow = false,
  style,
  lineStyle,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = useMemo(() => text.split("\n"), [text]);

  const fontSize = Number(style?.fontSize ?? 64);
  const lineHeight = Number(style?.lineHeight ?? 1.1);
  // Extra room below the baseline so descenders survive the clip.
  const boxHeight = fontSize * lineHeight;
  const overshoot = fontSize * 0.28;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        fontFamily: DISPLAY_FONT,
        ...style,
      }}
    >
      {lines.map((line, i) => {
        const start = delay + staggerDelay(i, lines.length, stagger, stagger * 5);
        const t = progress(frame, start, duration, EASINGS.outExpo);
        // The spring adds a fractional settle the pure curve lacks; the two
        // are averaged so the line still lands exactly on `duration`.
        const s = springProgress(frame, fps, start, "cinematic");
        const eased = t * 0.65 + s * 0.35;

        return (
          <div
            key={`${line}-${i}`}
            style={{
              height: boxHeight + overshoot,
              overflow: "hidden",
              // Pull the following line back up by the descender allowance,
              // so the extra mask room does not become extra leading.
              marginBottom: -overshoot,
              display: "flex",
              alignItems: "flex-start",
              justifyContent:
                align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
              width: "100%",
            }}
          >
            <span
              style={{
                display: "block",
                lineHeight,
                transform: `translateY(${mix(eased, fromBelow ? -boxHeight : boxHeight, 0)}px)`,
                // A touch of opacity ramp stops the very top of a tall
                // glyph popping at the mask edge on the first frame.
                opacity: progress(frame, start, 6, EASINGS.linear),
                whiteSpace: "pre",
                ...lineStyle,
              }}
            >
              {line || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * WordReveal
 * ------------------------------------------------------------------ */

export interface WordRevealProps {
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  style?: React.CSSProperties;
  align?: "left" | "center" | "right";
  maxWidth?: number;
}

/**
 * Reveal word by word, each rising with a slight blur.
 *
 * For body copy and captions, where line masking would be too emphatic. The
 * blur is what makes it read as focus pulling in rather than as opacity
 * ramping - 6px is enough to register and small enough not to smear.
 */
export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  delay = 0,
  stagger = 1.6,
  duration = 22,
  style,
  align = "left",
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const words = useMemo(() => text.split(/(\s+)/).filter(Boolean), [text]);
  const fontSize = Number(style?.fontSize ?? 28);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        fontFamily: DISPLAY_FONT,
        maxWidth,
        ...style,
      }}
    >
      {words.map((word, i) => {
        if (/^\s+$/.test(word)) {
          return (
            <span key={`s-${i}`} style={{ whiteSpace: "pre" }}>
              {word}
            </span>
          );
        }
        const start = delay + staggerDelay(i, words.length, stagger, 34);
        const t = progress(frame, start, duration, EASINGS.outExpo);

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              opacity: t,
              transform: `translateY(${mix(t, fontSize * 0.42, 0)}px)`,
              filter: t < 0.98 ? `blur(${mix(t, 6, 0).toFixed(2)}px)` : undefined,
              whiteSpace: "pre",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Counter
 * ------------------------------------------------------------------ */

export interface CounterProps {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Insert thousands separators. */
  grouped?: boolean;
  style?: React.CSSProperties;
}

/**
 * A number counting up.
 *
 * Tabular figures are non-negotiable: with proportional digits the number
 * jitters horizontally on every frame as glyph widths change, which looks
 * like a rendering fault rather than a count.
 */
export const Counter: React.FC<CounterProps> = ({
  to,
  from = 0,
  delay = 0,
  duration = 45,
  decimals = 0,
  prefix = "",
  suffix = "",
  grouped = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const t = progress(frame, delay, duration, EASINGS.outExpo);
  const value = mix(t, from, to);

  const formatted = grouped
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toFixed(decimals);

  return (
    <span
      style={{
        fontFamily: DISPLAY_FONT,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * TypeOn
 * ------------------------------------------------------------------ */

export interface TypeOnProps {
  text: string;
  delay?: number;
  /** Characters per second. */
  speed?: number;
  cursor?: boolean;
  style?: React.CSSProperties;
}

/**
 * Character-by-character typing, for terminals and command lines.
 *
 * The one place per-character animation is right, because it is depicting
 * something that genuinely happens one character at a time. The cursor
 * blinks on a 2Hz square wave and stops once typing finishes - a cursor that
 * keeps blinking after the line is complete implies the shot is still
 * waiting for input.
 */
export const TypeOn: React.FC<TypeOnProps> = ({
  text,
  delay = 0,
  speed = 26,
  cursor = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = Math.max(0, frame - delay);
  const shown = Math.min(text.length, Math.floor((elapsed / fps) * speed));
  const done = shown >= text.length;
  const started = frame >= delay;

  const blink = Math.floor((frame / fps) * 2) % 2 === 0;

  return (
    <span style={{ fontFamily: MONO_FONT, whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, shown)}
      {cursor && started && (!done || blink) ? (
        <span
          style={{
            display: "inline-block",
            width: "0.55em",
            height: "1.05em",
            background: "currentColor",
            opacity: done ? (blink ? 0.9 : 0) : 0.9,
            transform: "translateY(0.18em)",
            marginLeft: "0.06em",
          }}
        />
      ) : null}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * Underline
 * ------------------------------------------------------------------ */

/**
 * A rule that draws itself from one side.
 *
 * Used under section titles. Scales from the origin rather than animating
 * `width`, because a width animation triggers layout on every frame while a
 * transform stays on the compositor.
 */
export const DrawLine: React.FC<{
  delay?: number;
  duration?: number;
  color?: string;
  height?: number;
  width?: number | string;
  from?: "left" | "center";
}> = ({ delay = 0, duration = 30, color = "#8b9bff", height = 2, width = "100%", from = "left" }) => {
  const frame = useCurrentFrame();
  const t = progress(frame, delay, duration, EASINGS.outExpo);

  return (
    <div
      style={{
        width,
        height,
        background: color,
        transform: `scaleX(${t})`,
        transformOrigin: from === "center" ? "center" : "left center",
      }}
    />
  );
};
