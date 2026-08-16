/**
 * The morph overlay.
 *
 * During a `morph` transition the matched layers are hidden in both scenes
 * and re-rendered here, in a third element that spans the overlap window.
 * Each pair renders one gliding container whose geometry interpolates from
 * the layer's resolved place in the outgoing scene to its place in the
 * incoming one - so the element visibly *travels and transforms* across the
 * cut instead of dying and being reborn.
 *
 * Content timelines are preserved on both sides: the outgoing content keeps
 * playing forward (a negative Sequence offset continues its clock), and the
 * incoming content runs its natural entrance during the glide, so the moment
 * the overlay unmounts the real layer takes over on exactly the frame the
 * overlay was showing. The handoff is invisible by construction.
 *
 * Motion grammar (from the reference study):
 *  - geometry rides one hard deceleration - most of the travel in the first
 *    third, a long settle into stillness;
 *  - blur is velocity-gated: it appears only while the element moves faster
 *    than ~40 px/frame and resolves as it lands;
 *  - in a container transform the old content's blur leads its fade by a few
 *    frames, and the new content resolves out of blur after the surface is
 *    already moving.
 */

import React from "react";
import { Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Layer, Scene } from "../shared/project.js";
import { LayerContent } from "./layers";
import { getPath, setPath, type MorphPair, type MorphPlan } from "./morph";
import { MorphText } from "./text-morph";
import {
  alignFor,
  hasLayout,
  justifyFor,
  resolveLayout,
  resolveLayoutSpec,
  type LayoutSpec,
  type Rect,
} from "./layout";
import { useGrid } from "./theme";
import { blurFilter, clamp, EASINGS, mix, progress } from "./timing";

export const MorphOverlay: React.FC<{
  from: Scene;
  to: Scene;
  overlap: number;
  plan: MorphPlan;
}> = ({ from, to, overlap, plan }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {plan.pairs.map((pair) => (
        <MorphPairView
          key={`${pair.from.id}->${pair.to.id}`}
          pair={pair}
          fromScene={from}
          frame={frame}
          overlap={overlap}
        />
      ))}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * One pair
 * ------------------------------------------------------------------ */

interface Placement {
  rect: Rect;
  layout: LayoutSpec | undefined;
}

const MorphPairView: React.FC<{
  pair: MorphPair;
  fromScene: Scene;
  frame: number;
  overlap: number;
}> = ({ pair, fromScene, frame, overlap }) => {
  const { width, height } = useVideoConfig();
  const grid = useGrid();

  const a = place(pair.from, width, height, grid);
  const b = place(pair.to, width, height, grid);

  const t = progress(frame, 0, overlap, EASINGS.outExpo);

  const rect: Rect = {
    left: mix(t, a.rect.left, b.rect.left),
    top: mix(t, a.rect.top, b.rect.top),
    width: mix(t, a.rect.width, b.rect.width),
    height: mix(t, a.rect.height, b.rect.height),
  };

  const ta = pair.from.transform;
  const tb = pair.to.transform;
  const x = mix(t, ta.x, tb.x);
  const y = mix(t, ta.y, tb.y);
  const scale = mix(t, ta.scale, tb.scale);
  const rotate = mix(t, ta.rotate, tb.rotate);
  const opacity = mix(t, ta.opacity, tb.opacity);

  // Velocity-gated motion blur: how fast is the anchor actually moving?
  const speed = anchorSpeed(frame, overlap, a.rect, b.rect, ta, tb);
  const travelBlur = speed > 40 ? clamp((speed - 40) * 0.12, 0, 14) : 0;

  // Alignment: a single-content glide uses the destination's alignment; a
  // container transform lets each side keep its own so neither layout lies.
  const singleContent = pair.kind !== "container";
  const align = singleContent ? b.layout : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        display: "flex",
        justifyContent: justifyFor(align?.align),
        alignItems: alignFor(align?.valign),
        opacity,
        transform: [
          `translate3d(${x}px, ${y}px, 0)`,
          `rotate(${rotate}deg)`,
          `scale(${scale})`,
        ].join(" "),
        filter: blurFilter(travelBlur + mix(t, ta.blur, tb.blur)),
        willChange: "transform, opacity, filter",
        backfaceVisibility: "hidden",
        pointerEvents: "none",
      }}
    >
      <PairContent pair={pair} fromScene={fromScene} frame={frame} overlap={overlap} t={t} a={a} b={b} />
    </div>
  );
};

const PairContent: React.FC<{
  pair: MorphPair;
  fromScene: Scene;
  frame: number;
  overlap: number;
  t: number;
  a: Placement;
  b: Placement;
}> = ({ pair, fromScene, frame, overlap, t, a, b }) => {
  switch (pair.kind) {
    case "text":
      return <MorphText from={pair.from} to={pair.to} frame={frame} overlap={overlap} t={t} />;

    case "move":
      return (
        <IncomingClock layer={pair.to}>
          <LayerContent layer={pair.to} />
        </IncomingClock>
      );

    case "props": {
      let props = pair.to.props;
      for (const path of pair.lerpPaths ?? []) {
        const va = getPath(pair.from.props, path);
        const vb = getPath(pair.to.props, path);
        if (typeof va === "number" && typeof vb === "number") {
          props = setPath(props, path, mix(t, va, vb));
        }
      }
      const lerped: Layer = { ...pair.to, props };
      return (
        <IncomingClock layer={pair.to}>
          <LayerContent layer={lerped} />
        </IncomingClock>
      );
    }

    case "container": {
      // One continuous surface, two payloads. The old content defocuses away
      // - blur leading opacity - while the new one resolves after the
      // surface is already travelling.
      const out = progress(frame, 3, Math.max(6, overlap * 0.5), "inOut");
      const outBlur = progress(frame, 0, Math.max(5, overlap * 0.42), "outQuad");
      const tin = progress(frame, overlap * 0.25, Math.max(6, overlap * 0.7), "outExpo");

      return (
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          {out < 1 ? (
            <Stacked
              justify={a.layout}
              style={{
                opacity: 1 - out,
                filter: blurFilter(outBlur * 12),
                transform: `scale(${mix(out, 1, 1.05)})`,
              }}
            >
              <OutgoingClock layer={pair.from} scene={fromScene} overlap={overlap}>
                <LayerContent layer={pair.from} />
              </OutgoingClock>
            </Stacked>
          ) : null}
          {tin > 0 ? (
            <Stacked
              justify={b.layout}
              style={{
                opacity: tin,
                filter: blurFilter((1 - tin) * 10),
                transform: `scale(${mix(tin, 0.96, 1)})`,
              }}
            >
              <IncomingClock layer={pair.to}>
                <LayerContent layer={pair.to} />
              </IncomingClock>
            </Stacked>
          ) : null}
        </div>
      );
    }

    default:
      return null;
  }
};

/** Both payloads of a container transform occupy the same grid cell. */
const Stacked: React.FC<{
  justify: LayoutSpec | undefined;
  style: React.CSSProperties;
  children: React.ReactNode;
}> = ({ justify, style, children }) => (
  <div
    style={{
      gridArea: "1 / 1",
      display: "flex",
      justifyContent: justifyFor(justify?.align),
      alignItems: alignFor(justify?.valign),
      willChange: "transform, opacity, filter",
      ...style,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ *
 * Clocks
 *
 * The overlay's Sequence starts exactly at the incoming scene's first frame,
 * so overlay-local time *is* incoming-scene-local time. These two wrappers
 * shift the clock so each side's content believes it is still on its own
 * timeline - which is what makes the handoff at both edges seamless.
 * ------------------------------------------------------------------ */

const IncomingClock: React.FC<{ layer: Layer; children: React.ReactNode }> = ({
  layer,
  children,
}) => (
  <Sequence from={layer.start} layout="none">
    {children}
  </Sequence>
);

const OutgoingClock: React.FC<{
  layer: Layer;
  scene: Scene;
  overlap: number;
  children: React.ReactNode;
}> = ({ layer, scene, overlap, children }) => {
  // At overlay frame f the outgoing scene is at local frame
  // (duration - overlap) + f; this layer's content is that minus its start.
  const elapsed = Math.max(0, scene.durationInFrames - overlap - layer.start);
  return (
    <Sequence from={-elapsed} layout="none">
      {children}
    </Sequence>
  );
};

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

function place(layer: Layer, width: number, height: number, grid: Parameters<typeof resolveLayout>[3]): Placement {
  const layout = resolveLayoutSpec(
    (layer as Layer & { layout?: LayoutSpec & { preset?: string } }).layout,
  );
  if (layout && hasLayout(layout)) {
    return { rect: resolveLayout(layout, width, height, grid), layout };
  }
  // No layout: the layer lives centred in the full frame.
  return {
    rect: { left: 0, top: 0, width, height },
    layout: { align: "center", valign: "middle" },
  };
}

/**
 * Per-frame speed of the pair's anchor point, in composition pixels, using a
 * numeric derivative of the eased progress. This is what gates motion blur:
 * a short hop never blurs, a full-frame whip blurs hard and resolves as the
 * deceleration tail flattens.
 */
function anchorSpeed(
  frame: number,
  overlap: number,
  ra: Rect,
  rb: Rect,
  ta: Layer["transform"],
  tb: Layer["transform"],
): number {
  const ax = ra.left + ra.width / 2 + ta.x;
  const ay = ra.top + ra.height / 2 + ta.y;
  const bx = rb.left + rb.width / 2 + tb.x;
  const by = rb.top + rb.height / 2 + tb.y;
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 1 || overlap <= 0) return 0;

  const e0 = progress(Math.max(0, frame - 0.5), 0, overlap, EASINGS.outExpo);
  const e1 = progress(Math.min(overlap, frame + 0.5), 0, overlap, EASINGS.outExpo);
  return Math.abs(e1 - e0) * dist;
}
