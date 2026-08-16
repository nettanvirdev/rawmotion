/**
 * The Remotion root used by the render bundle.
 *
 * Only the final-render path goes through here - the editor mounts
 * `RawMotionComposition` in `@remotion/player` directly, because the Player
 * takes its dimensions and duration as props rather than from a registered
 * composition.
 *
 * There is exactly one composition, `RawMotion`, and its metadata is
 * computed from the project supplied as an input prop. That is what removes
 * the duration ceiling: nothing here declares a length, so a 10-second
 * teaser and a 30-minute film are the same composition with different input.
 */

import React from "react";
import { Composition } from "remotion";
import {
  RawMotionComposition,
  metadataFor,
} from "../motion/RawMotionComposition";
import { createProject, normalizeProject } from "../shared/project.js";

/**
 * Stand-in used when the composition is opened without input props - the
 * Remotion Studio, or a `selectComposition` call made before the project is
 * attached. Remotion evaluates `defaultProps` eagerly, so this must be a
 * valid project rather than `null`.
 */
const PLACEHOLDER = createProject({ name: "Raw Motion" });

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RawMotion"
    component={RawMotionComposition as unknown as React.FC<Record<string, unknown>>}
    defaultProps={{ project: PLACEHOLDER } as Record<string, unknown>}
    // Width, height, fps and duration are all derived from the project.
    // Remotion requires literal defaults on the element even though
    // calculateMetadata overrides them, hence the placeholder values.
    width={PLACEHOLDER.composition.width}
    height={PLACEHOLDER.composition.height}
    fps={PLACEHOLDER.composition.fps}
    durationInFrames={1}
    calculateMetadata={({ props }) => {
      // Input props arrive as plain JSON over the CLI/renderer boundary, so
      // they are re-normalised here rather than trusted: a project written
      // by an agent may be missing fields the renderer assumes.
      const project = normalizeProject((props as { project: unknown }).project);
      return { props: { ...props, project }, ...metadataFor(project) };
    }}
  />
);
