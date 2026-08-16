/**
 * Per-character text morphing.
 *
 * The signature move of the reference language: "Turn" does not cut to
 * "Audio" - the characters both words share stay on screen and *travel* to
 * their new positions, while removed characters defocus away and new ones
 * resolve out of blur, left to right. The word appears to physically become
 * the next word.
 *
 * Character positions come from canvas `measureText`, not the DOM, so the
 * same numbers drive preview and render. Kerning pairs are lost (each glyph
 * advances by its own width), which at display sizes is invisible next to
 * the motion itself.
 *
 * Timing follows the reference grammar: blur leads opacity by a few frames
 * on exits, incoming characters resolve on a left-to-right stagger of ~1.5
 * frames per character, and everything rides one deceleration curve.
 */

import React, { useMemo } from "react";
import type { Layer } from "../shared/project.js";
import { diffChars } from "./morph";
import { resolveFontStack } from "./fonts";
import { useTheme } from "./theme";
import { blurFilter, clamp, mix, progress } from "./timing";

interface TextStyle {
  text: string;
  fontSize: number;
  fontWeight: number;
  /** Em units, as authored. */
  letterSpacing: number;
  color: string;
  fontFamily: string;
}

function styleOf(layer: Layer, themeText: string): TextStyle {
  const p = layer.props as {
    text?: string;
    fontSize?: number;
    fontWeight?: number;
    letterSpacing?: number;
    color?: string;
    fontFamily?: string;
  };
  return {
    text: typeof p.text === "string" ? p.text : "",
    fontSize: p.fontSize ?? 96,
    fontWeight: p.fontWeight ?? 500,
    letterSpacing: p.letterSpacing ?? -0.02,
    // Same rule as TextLayer: the sentinel white defers to the theme.
    color: p.color && p.color !== "#ffffff" ? p.color : themeText,
    fontFamily: resolveFontStack(p.fontFamily),
  };
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

interface Measured {
  /** Left edge of each character, before centring. */
  xs: number[];
  widths: number[];
  total: number;
}

let ctx: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, Measured>();

function measureLine(style: TextStyle): Measured {
  const key = `${style.fontSize}|${style.fontWeight}|${style.letterSpacing}|${style.fontFamily}|${style.text}`;
  const cached = measureCache.get(key);
  if (cached) return cached;

  if (!ctx) {
    ctx = document.createElement("canvas").getContext("2d");
  }

  const xs: number[] = [];
  const widths: number[] = [];
  let x = 0;
  const tracking = style.letterSpacing * style.fontSize;

  if (ctx) {
    ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    for (const ch of Array.from(style.text)) {
      const w = ctx.measureText(ch).width;
      xs.push(x);
      widths.push(w);
      x += w + tracking;
    }
  } else {
    // No canvas (should not happen in Electron/Chromium) - approximate.
    for (const ch of Array.from(style.text)) {
      const w = style.fontSize * 0.55;
      void ch;
      xs.push(x);
      widths.push(w);
      x += w + tracking;
    }
  }

  const total = Math.max(0, x - tracking);
  const out = { xs, widths, total };
  measureCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export const MorphText: React.FC<{
  from: Layer;
  to: Layer;
  /** Overlay-local frame, 0..overlap. */
  frame: number;
  overlap: number;
  /** Eased geometry progress shared with the container glide. */
  t: number;
}> = ({ from, to, frame, overlap, t }) => {
  const theme = useTheme();

  const a = styleOf(from, theme.text);
  const b = styleOf(to, theme.text);

  const ma = measureLine(a);
  const mb = measureLine(b);

  const ops = useMemo(() => diffChars(a.text, b.text), [a.text, b.text]);

  const fontSize = mix(t, a.fontSize, b.fontSize);
  const lineHeight = fontSize * 1.15;

  // Exits clear the stage in the first 40% of the overlap; entrances own the
  // last 60%, staggered left to right. Blur leads opacity on the way out.
  const exitSpan = Math.max(6, overlap * 0.4);
  const enterStart = overlap * 0.3;

  let addedRank = 0;
  let removedRank = 0;

  return (
    <div style={{ position: "relative", height: lineHeight, width: 0 }}>
      {ops.map((op, i) => {
        const kept = op.fromIndex >= 0 && op.toIndex >= 0;

        if (kept) {
          const xa = ma.xs[op.fromIndex] - ma.total / 2;
          const xb = mb.xs[op.toIndex] - mb.total / 2;
          const x = mix(t, xa, xb);
          const sameInk =
            a.color === b.color && a.fontWeight === b.fontWeight && a.fontFamily === b.fontFamily;

          if (sameInk) {
            return (
              <Char key={i} x={x} fontSize={fontSize} style={b} opacity={1} blur={0} ch={op.ch} />
            );
          }
          // Style changes crossfade in the middle of the glide, both spans
          // riding the same position so the glyph never doubles visibly.
          const swap = progress(frame, overlap * 0.35, Math.max(4, overlap * 0.3), "inOut");
          return (
            <React.Fragment key={i}>
              {swap < 1 ? (
                <Char x={x} fontSize={fontSize} style={a} opacity={1 - swap} blur={0} ch={op.ch} />
              ) : null}
              {swap > 0 ? (
                <Char x={x} fontSize={fontSize} style={b} opacity={swap} blur={0} ch={op.ch} />
              ) : null}
            </React.Fragment>
          );
        }

        if (op.toIndex < 0) {
          // Removed: defocus away in place. Blur leads, opacity follows.
          const rank = removedRank;
          removedRank += 1;
          const delay = rank * 1.2;
          const tb = progress(frame, delay, exitSpan, "outQuad");
          const to_ = progress(frame, delay + 3, exitSpan, "outQuad");
          if (to_ >= 1) return null;
          const x = ma.xs[op.fromIndex] - ma.total / 2;
          return (
            <Char
              key={i}
              x={x}
              fontSize={mix(t, a.fontSize, b.fontSize)}
              style={a}
              opacity={1 - to_}
              blur={tb * 12}
              rise={tb * fontSize * 0.06}
              ch={op.ch}
            />
          );
        }

        // Added: resolve out of blur, left to right.
        const rank = addedRank;
        addedRank += 1;
        const delay = enterStart + rank * 1.5;
        const tin = progress(frame, delay, Math.max(6, overlap * 0.45), "outExpo");
        if (tin <= 0) return null;
        const x = mb.xs[op.toIndex] - mb.total / 2;
        return (
          <Char
            key={i}
            x={x}
            fontSize={fontSize}
            style={b}
            opacity={tin}
            blur={(1 - tin) * 12}
            rise={-(1 - tin) * fontSize * 0.04}
            ch={op.ch}
          />
        );
      })}
    </div>
  );
};

const Char: React.FC<{
  x: number;
  fontSize: number;
  style: TextStyle;
  opacity: number;
  blur: number;
  rise?: number;
  ch?: string;
}> = ({ x, fontSize, style, opacity, blur, rise = 0, ch }) => (
  <span
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(${x}px, calc(-50% + ${rise}px))`,
      fontSize,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      letterSpacing: `${style.letterSpacing}em`,
      color: style.color,
      opacity: clamp(opacity, 0, 1),
      filter: blurFilter(blur),
      whiteSpace: "pre",
      willChange: "transform, opacity, filter",
    }}
  >
    {ch ?? ""}
  </span>
);
