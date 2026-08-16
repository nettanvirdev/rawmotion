/**
 * Layer renderers.
 *
 * One component per `Layer.type` in the project model, plus the wrapper that
 * turns a layer's timing, transform and animation into a positioned element.
 *
 * The split matters: `LayerView` owns everything generic - when the layer is
 * on screen, where it sits, how it enters and leaves - and the per-type
 * components own only their content. A new layer type therefore costs one
 * small component and a registry entry, not a fork of the timing logic.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Layer } from "../shared/project.js";
import { BACKGROUND_REGISTRY, type BackgroundKind } from "./backgrounds";
import { layerMotion } from "./presets";
import { blurFilter, progress, staggerDelay } from "./timing";
import { useAssetUrl } from "./assets";
import { lookupComponent } from "./registry";

/* ------------------------------------------------------------------ *
 * Wrapper
 * ------------------------------------------------------------------ */

/**
 * Place a layer in time and space.
 *
 * Uses Remotion's `<Sequence>` for the time window rather than an opacity
 * gate, which is what keeps a 30-minute project tractable: a layer outside
 * its window is not mounted at all, so an off-screen video decodes nothing
 * and a particle field costs nothing.
 */
export const LayerView: React.FC<{ layer: Layer }> = ({ layer }) => {
  if (layer.hidden) return null;

  return (
    <Sequence
      from={layer.start}
      durationInFrames={layer.duration}
      name={layer.name}
      layout="none"
    >
      <LayerBody layer={layer} />
    </Sequence>
  );
};

const LayerBody: React.FC<{ layer: Layer }> = ({ layer }) => {
  // Inside a Sequence, `useCurrentFrame` is already relative to the layer's
  // start - the animation code never has to subtract an offset.
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { transform } = layer;

  const delta = layerMotion(
    frame,
    layer.duration,
    fps,
    layer.animation.enter,
    layer.animation.exit,
  );

  const opacity = transform.opacity * delta.opacity;
  const blur = transform.blur + delta.blur;

  return (
    <AbsoluteFill
      style={{
        opacity,
        filter: blurFilter(blur),
        transform: [
          `translate(${transform.x + delta.x}px, ${transform.y + delta.y}px)`,
          `rotate(${transform.rotate + delta.rotate}deg)`,
          `scale(${transform.scale * delta.scale})`,
        ].join(" "),
        // Centre is the natural anchor for motion design: a layer's position
        // is an offset from the middle of frame, so a composition re-targeted
        // from 16:9 to 9:16 keeps its composition instead of drifting to a
        // corner.
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LayerContent layer={layer} />
    </AbsoluteFill>
  );
};

const LayerContent: React.FC<{ layer: Layer }> = ({ layer }) => {
  switch (layer.type) {
    case "text":
      return <TextLayer layer={layer} />;
    case "image":
      return <ImageLayer layer={layer} />;
    case "video":
      return <VideoLayer layer={layer} />;
    case "shape":
      return <ShapeLayer layer={layer} />;
    case "background":
      return <BackgroundLayer layer={layer} />;
    case "component":
      return <ComponentLayer layer={layer} />;
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

interface TextProps {
  text: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  align: "left" | "center" | "right";
  maxWidth: number;
  split: "none" | "chars" | "words" | "lines";
}

/**
 * Typography, with optional per-unit staggered reveal.
 *
 * Splitting is what turns a title into kinetic type. It is off by default
 * because a staggered reveal on body copy is unreadable, and because
 * splitting breaks text selection and shaping - ligatures and kerning pairs
 * are lost once each glyph is its own box, which is visible at display sizes
 * in most typefaces.
 */
const TextLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const p = layer.props as unknown as TextProps;
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const base: React.CSSProperties = {
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    letterSpacing: `${p.letterSpacing}em`,
    lineHeight: p.lineHeight,
    color: p.color,
    textAlign: p.align,
    maxWidth: width * p.maxWidth,
    margin: 0,
    whiteSpace: "pre-wrap",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
  };

  if (p.split === "none") {
    return <div style={base}>{p.text}</div>;
  }

  const units = splitText(p.text, p.split);

  return (
    <div style={{ ...base, display: "flex", flexWrap: "wrap", gap: 0, justifyContent: justify(p.align) }}>
      {units.map((unit, i) => {
        const delay = staggerDelay(i, units.length, 2.5, 30);
        const t = progress(frame, delay, 20, "outExpo");
        return (
          <span
            key={`${unit}-${i}`}
            style={{
              display: "inline-block",
              opacity: t,
              transform: `translateY(${(1 - t) * p.fontSize * 0.35}px)`,
              // Preserve inter-word spacing that flexbox would otherwise eat.
              whiteSpace: "pre",
            }}
          >
            {unit}
          </span>
        );
      })}
    </div>
  );
};

function splitText(text: string, mode: "chars" | "words" | "lines"): string[] {
  if (mode === "chars") return Array.from(text);
  if (mode === "lines") return text.split("\n");
  // Keep the trailing space attached to each word so the flex row spaces
  // correctly without a gap that also separates characters.
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

function justify(align: "left" | "center" | "right") {
  return align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
}

/* ------------------------------------------------------------------ *
 * Media
 * ------------------------------------------------------------------ */

const ImageLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const resolve = useAssetUrl();
  const p = layer.props as { src: string; fit: "cover" | "contain"; radius: number };
  const url = resolve(p.src);
  if (!url) return <MissingAsset label={p.src || "No image selected"} />;

  return (
    <Img
      src={url}
      style={{
        width: "100%",
        height: "100%",
        objectFit: p.fit,
        borderRadius: p.radius,
      }}
    />
  );
};

const VideoLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const resolve = useAssetUrl();
  const p = layer.props as {
    src: string;
    fit: "cover" | "contain";
    volume: number;
    trimStart: number;
    radius: number;
  };
  const url = resolve(p.src);
  if (!url) return <MissingAsset label={p.src || "No video selected"} />;

  return (
    // OffthreadVideo rather than <Video>: during a final render it extracts
    // frames with ffmpeg instead of relying on the browser's playback clock,
    // which is the only way to get frame-accurate output.
    <OffthreadVideo
      src={url}
      startFrom={p.trimStart}
      volume={p.volume}
      style={{
        width: "100%",
        height: "100%",
        objectFit: p.fit,
        borderRadius: p.radius,
      }}
    />
  );
};

/**
 * Shown in place of media that cannot be resolved.
 *
 * Deliberately visible rather than an empty box. A missing asset is a real
 * problem the user has to fix, and a silently blank frame in a 40-scene
 * project is very hard to find.
 */
const MissingAsset: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 32px",
      borderRadius: 12,
      border: "1px dashed rgb(255 255 255 / 0.25)",
      background: "rgb(255 255 255 / 0.03)",
      color: "rgb(255 255 255 / 0.5)",
      fontSize: 22,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    }}
  >
    {label}
  </div>
);

/* ------------------------------------------------------------------ *
 * Shape
 * ------------------------------------------------------------------ */

const ShapeLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const p = layer.props as {
    shape: "rect" | "ellipse" | "line";
    width: number;
    height: number;
    radius: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
  };

  const common: React.CSSProperties = {
    width: p.width,
    height: p.shape === "line" ? Math.max(1, p.strokeWidth) : p.height,
    background: p.shape === "line" ? withAlpha(p.stroke, p.strokeOpacity) : withAlpha(p.fill, p.fillOpacity),
  };

  if (p.shape === "line") return <div style={common} />;

  return (
    <div
      style={{
        ...common,
        borderRadius: p.shape === "ellipse" ? "50%" : p.radius,
        boxShadow:
          p.strokeWidth > 0
            ? `inset 0 0 0 ${p.strokeWidth}px ${withAlpha(p.stroke, p.strokeOpacity)}`
            : undefined,
      }}
    />
  );
};

/**
 * Apply an alpha to a hex colour.
 *
 * Uses an 8-digit hex rather than `color-mix` or `rgb(... / a)` string
 * building because it round-trips any input the colour picker produces and
 * degrades to the original value for named or already-alpha colours.
 */
function withAlpha(color: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${a}`;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = /^#(.)(.)(.)$/i.exec(color)!;
    return `#${r}${r}${g}${g}${b}${b}${a}`;
  }
  return color;
}

/* ------------------------------------------------------------------ *
 * Background + custom component
 * ------------------------------------------------------------------ */

const BackgroundLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const p = layer.props as { kind: BackgroundKind } & Record<string, unknown>;
  const entry = BACKGROUND_REGISTRY[p.kind] ?? BACKGROUND_REGISTRY.cinematicGradient;
  const Component = entry.component as React.FC<Record<string, unknown>>;
  const { kind, ...rest } = p;
  return (
    <AbsoluteFill>
      <Component {...rest} />
    </AbsoluteFill>
  );
};

/**
 * A layer backed by a registered React component.
 *
 * This is the escape hatch that keeps Raw Motion from being a fixed set of
 * effects: anything expressible as a React component can be a layer, driven
 * by props the inspector and an agent can both edit.
 */
const ComponentLayer: React.FC<{ layer: Layer }> = ({ layer }) => {
  const p = layer.props as { component: string; props: Record<string, unknown> };
  const entry = lookupComponent(p.component);

  if (!entry) {
    return (
      <MissingAsset
        label={p.component ? `Unknown component: ${p.component}` : "No component selected"}
      />
    );
  }

  const Component = entry.component as React.FC<Record<string, unknown>>;
  return <Component {...entry.defaults} {...p.props} />;
};
