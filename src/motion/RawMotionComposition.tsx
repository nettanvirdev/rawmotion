/**
 * The composition.
 *
 * This component *is* Raw Motion's renderer. The editor mounts it inside
 * `@remotion/player` for the live preview, and `@remotion/renderer` mounts
 * the identical file when exporting an MP4. There is deliberately no second
 * implementation: a preview that approximates the output is a preview users
 * learn not to trust.
 *
 * It renders a `Project` and nothing else - no editor state, no selection,
 * no chrome. Overlays such as selection outlines are drawn by the canvas
 * *around* this component, never inside it, so that what is previewed is
 * exactly what is rendered.
 */

import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project, Scene as SceneModel } from "../shared/project.js";
import { sceneTimings } from "../shared/project.js";
import {
  AssetProvider,
  type AssetResolver,
  staticAssetResolver,
  useAssetUrl,
} from "./assets";
import { LayerView } from "./layers";
import { ThemeProvider } from "./theme";
import { resolveTheme } from "./themes.js";
import { EASINGS, blurFilter, mix, progress } from "./timing";

export interface RawMotionCompositionProps {
  project: Project;
  /**
   * How to turn project-relative asset paths into loadable URLs. Defaults to
   * Remotion's `staticFile`, which is what the render bundle needs; the
   * editor overrides it with a map of `file://` URLs.
   */
  resolveAsset?: AssetResolver;
}

export const RawMotionComposition: React.FC<RawMotionCompositionProps> = ({
  project,
  resolveAsset = staticAssetResolver,
}) => {
  const timings = useMemo(() => sceneTimings(project), [project]);

  const themeRef = (project as { theme?: { preset?: string; overrides?: object } }).theme;
  const theme = resolveTheme(themeRef?.preset, themeRef?.overrides);

  return (
    <AssetProvider resolve={resolveAsset}>
      <ThemeProvider preset={themeRef?.preset} overrides={themeRef?.overrides as never}>
      {/* The theme's background is the floor. An explicit composition
          background still wins, so a project can sit a themed film on a
          different ground colour without forking the theme. */}
      <AbsoluteFill
        style={{
          backgroundColor:
            project.composition.background && project.composition.background !== "#070708"
              ? project.composition.background
              : theme.background,
        }}
      >
        {project.scenes.map((scene, i) => {
          const timing = timings[i];
          const incomingOverlap = i > 0 ? timings[i - 1].overlapWithNext : 0;

          return (
            <Sequence
              key={scene.id}
              from={timing.from}
              durationInFrames={scene.durationInFrames}
              name={scene.name}
              layout="none"
            >
              <SceneView
                scene={scene}
                // The transition belongs to the *incoming* scene: it is the
                // one that fades up, wipes on or resolves out of blur. The
                // outgoing scene simply keeps playing underneath, which is
                // how a cross-dissolve actually works.
                transition={i > 0 ? project.scenes[i - 1].transition : undefined}
                transitionFrames={incomingOverlap}
              />
            </Sequence>
          );
        })}

        <AudioTracks project={project} />
      </AbsoluteFill>
      </ThemeProvider>
    </AssetProvider>
  );
};

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

const SceneView: React.FC<{
  scene: SceneModel;
  transition?: SceneModel["transition"];
  transitionFrames: number;
}> = ({ scene, transition, transitionFrames }) => {
  const frame = useCurrentFrame();

  const camera = useCameraTransform(scene, frame);
  const enter = useTransitionStyle(transition, transitionFrames, frame);

  return (
    <AbsoluteFill style={enter.outer}>
      <AbsoluteFill
        style={{
          ...camera,
          ...enter.inner,
        }}
      >
        {scene.layers.map((layer) => (
          <LayerView key={layer.id} layer={layer} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Scene-level camera.
 *
 * A single transform on the scene wrapper rather than per-layer motion, so
 * every layer moves together and parallax stays a property of the layers'
 * own scale rather than something the camera has to coordinate.
 *
 * The move runs across the *whole* scene on an ease-in-out curve, which is
 * what makes a push feel like a camera on a dolly rather than an animation
 * that starts and stops.
 */
function useCameraTransform(scene: SceneModel, frame: number): React.CSSProperties {
  const { move, amount } = scene.camera;
  if (move === "none" || amount === 0) return {};

  const t = progress(frame, 0, scene.durationInFrames, EASINGS.inOutQuint);

  if (move === "push") return { transform: `scale(${mix(t, 1, 1 + amount)})` };
  if (move === "pull") return { transform: `scale(${mix(t, 1 + amount, 1)})` };

  // A pan without a slight scale-up would reveal the empty edge of frame.
  const travel = mix(t, -amount, amount);
  return {
    transform: `scale(${1 + Math.abs(amount)}) translateX(${travel * 100}%)`,
  };
}

/**
 * Transition styles for an incoming scene.
 *
 * Split across two elements: `outer` carries opacity and clipping, `inner`
 * carries transforms. Applying a `filter` and a `transform` to the same
 * element makes Chromium rasterise the blur at the post-transform size,
 * which produces a visible resolution pop mid-transition.
 */
function useTransitionStyle(
  transition: SceneModel["transition"] | undefined,
  frames: number,
  frame: number,
): { outer: React.CSSProperties; inner: React.CSSProperties } {
  if (!transition || transition.type === "none" || frames <= 0) {
    return { outer: {}, inner: {} };
  }

  const t = progress(frame, 0, frames, EASINGS.outExpo);
  if (t >= 1) return { outer: {}, inner: {} };

  switch (transition.type) {
    case "fade":
      return { outer: { opacity: t }, inner: {} };

    case "blur":
      return {
        outer: { opacity: t },
        inner: { filter: blurFilter((1 - t) * 24) },
      };

    case "slide":
      return {
        outer: { opacity: Math.min(1, t * 2) },
        inner: { transform: `translateY(${(1 - t) * 100}%)` },
      };

    case "wipe":
      return {
        // inset() from the right: the incoming scene is revealed by a hard
        // edge travelling across frame, with no cross-fade.
        outer: { clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` },
        inner: {},
      };

    default:
      return { outer: {}, inner: {} };
  }
}

/* ------------------------------------------------------------------ *
 * Audio
 * ------------------------------------------------------------------ */

/**
 * Audio clips, mixed onto the project timeline.
 *
 * Audio is a property of the *project*, not of a scene, which is what lets a
 * music bed run underneath a scene change and a voiceover straddle two
 * scenes. Scene-scoped audio would make both of those impossible to express.
 */
const AudioTracks: React.FC<{ project: Project }> = ({ project }) => {
  const { fps } = useVideoConfig();
  // Safe to call here: AudioTracks renders inside the AssetProvider above.
  const resolve = useAssetUrl();

  // Solo is exclusive across the whole mix, as on a physical desk: if
  // anything is soloed, everything else is silent regardless of its own
  // mute state.
  const soloed = project.audio.some((clip) => clip.solo);

  return (
    <>
      {project.audio.map((clip) => {
        if (!clip.src) return null;
        if (clip.muted && !clip.solo) return null;
        if (soloed && !clip.solo) return null;

        const url = resolve(clip.src);
        if (!url) return null;

        return (
          <Sequence
            key={clip.id}
            from={clip.start}
            durationInFrames={clip.duration}
            name={clip.name}
            layout="none"
          >
            <AudioClipView clip={clip} url={url} fps={fps} />
          </Sequence>
        );
      })}
    </>
  );
};

const AudioClipView: React.FC<{
  clip: Project["audio"][number];
  url: string;
  fps: number;
}> = ({ clip, url }) => (
  <Audio
    src={url}
    startFrom={clip.trimStart}
    // A function volume is evaluated per frame by Remotion, which is how the
    // fades survive into the rendered file - a CSS transition would not.
    volume={(f) => {
      const fadeIn = clip.fadeIn > 0 ? progress(f, 0, clip.fadeIn, "linear") : 1;
      const fadeOut =
        clip.fadeOut > 0
          ? 1 - progress(f, clip.duration - clip.fadeOut, clip.fadeOut, "linear")
          : 1;
      return clip.volume * Math.min(fadeIn, fadeOut);
    }}
  />
);

/**
 * Metadata for Remotion's `<Composition>`.
 *
 * Exported separately so both the render entry and the editor derive the
 * composition's size and length from the same function - the project model.
 */
export function metadataFor(project: Project) {
  const timings = sceneTimings(project);
  const durationInFrames = timings.length
    ? Math.max(1, Math.max(...timings.map((t) => t.to)))
    : 1;

  return {
    width: project.composition.width,
    height: project.composition.height,
    fps: project.composition.fps,
    durationInFrames,
  };
}
