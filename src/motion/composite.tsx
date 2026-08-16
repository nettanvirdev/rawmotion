/**
 * The composite layer: a component the AI designs, not picks.
 *
 * Instead of naming a registered component, a composite layer carries a
 * declarative *node tree* - rows, columns, boxes, text, SVG, images - that
 * this interpreter renders. The tree is plain JSON in `project.json`, which
 * is the whole point: an agent can invent a pricing card, a chart, an app
 * mockup or an illustration that never existed in the library, and the
 * editor still understands it as an ordinary layer - selectable, timed,
 * animated, morphable.
 *
 * Design-language consistency comes from tokens: colours may be named
 * (`accent`, `panel`, `surface`, `text`, `textDim`, `accentSoft`) and
 * resolve through the project theme, so an invented component restyles
 * itself when the theme changes, exactly like the built-ins. Raw CSS colours
 * remain legal for deliberate departures.
 *
 * Every node can animate in (`enter`), and containers stagger their children
 * automatically, so a designed component arrives as choreography rather than
 * as a static picture.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Layer } from "../shared/project.js";
import { useAssetUrl } from "./assets";
import { resolveFontStack } from "./fonts";
import { useTheme } from "./theme";
import { blurFilter, mix, progress } from "./timing";

/* ------------------------------------------------------------------ *
 * Node model
 * ------------------------------------------------------------------ */

export interface CompositeNode {
  type?: string;
  children?: CompositeNode[];

  /* container */
  gap?: number;
  pad?: number | string;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  /** Frames between consecutive children's entrances. */
  stagger?: number;

  /* sizing */
  width?: number | string;
  height?: number | string;
  grow?: number;

  /* surface */
  fill?: string;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  /** Frosted-glass surface: translucent fill plus backdrop blur. */
  glass?: boolean;
  /** Soft ambient glow beneath the node, in the accent colour. */
  glow?: boolean;

  /* text */
  text?: string;
  size?: number;
  weight?: number;
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  fontFamily?: string;
  mono?: boolean;

  /* svg */
  /** Raw SVG markup, rendered verbatim. Colour tokens are not resolved. */
  svg?: string;
  /** A single path, with optional draw-on animation. */
  path?: {
    d: string;
    viewBox?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    linecap?: "butt" | "round" | "square";
  };

  /* image */
  src?: string;
  fit?: "cover" | "contain";

  /* motion */
  enter?: {
    preset?: "fade" | "rise" | "pop" | "scale" | "blur" | "draw" | "none";
    delay?: number;
    duration?: number;
  };
}

interface CompositeProps {
  nodes: CompositeNode[];
  /** Default stagger between root nodes' entrances. */
  stagger: number;
}

/* ------------------------------------------------------------------ *
 * Layer entry
 * ------------------------------------------------------------------ */

export const CompositeLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const p = layer.props as unknown as CompositeProps;
  const nodes = Array.isArray(p.nodes) ? p.nodes : [];

  if (!nodes.length) {
    return (
      <div
        style={{
          padding: "24px 32px",
          borderRadius: 12,
          border: "1px dashed rgb(128 128 128 / 0.4)",
          color: "rgb(128 128 128 / 0.8)",
          fontSize: 20,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Empty composite - add nodes
      </div>
    );
  }

  const stagger = typeof p.stagger === "number" ? p.stagger : 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      {nodes.map((node, i) => (
        <NodeView key={i} node={node} delay={i * stagger} stagger={stagger} />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Interpreter
 * ------------------------------------------------------------------ */

const NodeView: React.FC<{ node: CompositeNode; delay: number; stagger: number }> = ({
  node,
  delay,
  stagger,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const resolve = useAssetUrl();
  void fps;

  if (!node || typeof node !== "object") return null;

  const type = node.type ?? (node.text !== undefined ? "text" : "column");

  const enter = node.enter ?? {};
  const preset = enter.preset ?? "fade";
  const dur = Math.max(1, enter.duration ?? 18);
  const start = delay + (enter.delay ?? 0);
  const t = preset === "none" ? 1 : progress(frame, start, dur, "outExpo");

  const motion: React.CSSProperties =
    preset === "none" || t >= 1
      ? {}
      : preset === "rise"
        ? { opacity: t, transform: `translateY(${(1 - t) * 26}px)` }
        : preset === "pop"
          ? { opacity: Math.min(1, t * 1.6), transform: `scale(${mix(t, 0.72, 1) + Math.sin(t * Math.PI) * 0.05})` }
          : preset === "scale"
            ? { opacity: t, transform: `scale(${mix(t, 0.92, 1)})` }
            : preset === "blur"
              ? { opacity: t, filter: blurFilter((1 - t) * 14), transform: `scale(${mix(t, 1.03, 1)})` }
              : { opacity: t };

  const surface = surfaceStyle(node, theme);
  const childStagger = node.stagger ?? stagger;

  const box: React.CSSProperties = {
    ...surface,
    ...sizing(node),
    ...motion,
  };

  switch (type) {
    case "row":
    case "column": {
      const children = Array.isArray(node.children) ? node.children : [];
      return (
        <div
          style={{
            display: "flex",
            flexDirection: type === "row" ? "row" : "column",
            gap: node.gap ?? 16,
            padding: node.pad ?? 0,
            alignItems: flexAlign(node.align ?? "center"),
            justifyContent: flexJustify(node.justify ?? "center"),
            ...box,
          }}
        >
          {children.map((child, i) => (
            <NodeView key={i} node={child} delay={start + (i + 1) * childStagger} stagger={childStagger} />
          ))}
        </div>
      );
    }

    case "box": {
      const children = Array.isArray(node.children) ? node.children : [];
      return (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: node.gap ?? 16,
            padding: node.pad ?? 0,
            alignItems: flexAlign(node.align ?? "center"),
            justifyContent: flexJustify(node.justify ?? "center"),
            ...box,
          }}
        >
          {children.map((child, i) => (
            <NodeView key={i} node={child} delay={start + (i + 1) * childStagger} stagger={childStagger} />
          ))}
        </div>
      );
    }

    case "circle": {
      const d = typeof node.width === "number" ? node.width : 120;
      return <div style={{ ...box, width: d, height: d, borderRadius: "50%" }} />;
    }

    case "spacer":
      return <div style={{ width: node.width ?? 1, height: node.height ?? 24, flexGrow: node.grow ?? 0 }} />;

    case "text":
      return (
        <div
          style={{
            fontSize: node.size ?? 32,
            fontWeight: node.weight ?? 500,
            letterSpacing: `${node.letterSpacing ?? -0.01}em`,
            lineHeight: node.lineHeight ?? 1.2,
            color: token(node.color, theme) ?? theme.text,
            fontFamily: node.mono
              ? 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace'
              : resolveFontStack(node.fontFamily),
            whiteSpace: "pre-wrap",
            margin: 0,
            ...box,
          }}
        >
          {node.text ?? ""}
        </div>
      );

    case "svg":
      if (typeof node.svg !== "string" || !node.svg.trim().startsWith("<svg")) return null;
      return (
        <div
          style={{ display: "flex", ...box }}
          // Project files are the user's own documents; the renderer draws
          // what they wrote, exactly as it does for text.
          dangerouslySetInnerHTML={{ __html: node.svg }}
        />
      );

    case "path": {
      const p = node.path;
      if (!p || typeof p.d !== "string") return null;
      const draw = preset === "draw";
      const drawT = draw ? progress(frame, start, Math.max(1, enter.duration ?? 30), "inOut") : 1;
      return (
        <svg
          viewBox={p.viewBox ?? "0 0 100 100"}
          style={{ width: node.width ?? 120, height: node.height ?? 120, ...(draw ? {} : box) }}
          fill="none"
        >
          <path
            d={p.d}
            fill={p.fill ? (token(p.fill, theme) ?? p.fill) : "none"}
            stroke={p.stroke ? (token(p.stroke, theme) ?? p.stroke) : "none"}
            strokeWidth={p.strokeWidth ?? 3}
            strokeLinecap={p.linecap ?? "round"}
            strokeLinejoin="round"
            {...(draw
              ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawT, opacity: drawT > 0 ? 1 : 0 }
              : {})}
          />
        </svg>
      );
    }

    case "image": {
      const url = node.src ? resolve(node.src) : null;
      if (!url) return null;
      return (
        <img
          src={url}
          style={{
            width: node.width ?? "100%",
            height: node.height ?? "auto",
            objectFit: node.fit ?? "cover",
            borderRadius: node.radius ?? 0,
            display: "block",
            ...motion,
          }}
        />
      );
    }

    default:
      return null;
  }
};

/* ------------------------------------------------------------------ *
 * Style resolution
 * ------------------------------------------------------------------ */

type Theme = ReturnType<typeof useTheme>;

/** Resolve a colour token through the theme; unknown strings pass through. */
function token(value: string | undefined, theme: Theme): string | undefined {
  if (!value) return undefined;
  switch (value) {
    case "accent":
      return theme.accent;
    case "accentSoft":
      return (theme as { accentSoft?: string }).accentSoft ?? `${theme.accent}26`;
    case "text":
      return theme.text;
    case "textDim":
      return theme.textDim;
    case "panel":
      return theme.panel;
    case "surface":
      return theme.surface;
    case "none":
      return "transparent";
    default:
      return value;
  }
}

function surfaceStyle(node: CompositeNode, theme: Theme): React.CSSProperties {
  const out: React.CSSProperties = {};
  const fill = token(node.fill, theme);
  if (fill) out.background = fill;
  if (node.radius !== undefined) out.borderRadius = node.radius;
  if (node.opacity !== undefined) out.opacity = node.opacity;
  if (node.stroke) {
    out.boxShadow = `inset 0 0 0 ${node.strokeWidth ?? 1}px ${token(node.stroke, theme)}`;
  }
  if (node.glass) {
    out.background = fill ?? theme.panel;
    out.backdropFilter = "blur(28px) saturate(150%)";
    out.WebkitBackdropFilter = "blur(28px) saturate(150%)";
  }
  if (node.glow) {
    out.boxShadow = `${out.boxShadow ? `${out.boxShadow}, ` : ""}0 30px 90px -20px ${theme.accent}55`;
  }
  return out;
}

function sizing(node: CompositeNode): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (node.width !== undefined) out.width = node.width;
  if (node.height !== undefined) out.height = node.height;
  if (node.grow !== undefined) out.flexGrow = node.grow;
  return out;
}

function flexAlign(v: string): React.CSSProperties["alignItems"] {
  return v === "start" ? "flex-start" : v === "end" ? "flex-end" : v === "stretch" ? "stretch" : "center";
}

function flexJustify(v: string): React.CSSProperties["justifyContent"] {
  if (v === "start") return "flex-start";
  if (v === "end") return "flex-end";
  if (v === "between") return "space-between";
  if (v === "around") return "space-around";
  return "center";
}
