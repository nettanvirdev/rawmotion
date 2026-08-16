/**
 * The timeline.
 *
 * Shows the whole project horizontally: a ruler with timecode, a band of
 * scene segments, the layer tracks of the active scene, and the project's
 * audio tracks.
 *
 * ## Why the active scene, not every scene at once
 *
 * A flat list of every layer in every scene is unreadable past about three
 * scenes, and it is also wrong: layer timings are scene-relative, so two
 * layers on the same visual row would mean different things. Showing scenes
 * as a band and the active scene's layers below keeps both the overview and
 * the detail, and matches how the model is actually shaped.
 *
 * Clips are drawn at absolute project frames and edits are converted back to
 * scene-relative on commit, which is the only coordinate conversion in the
 * component and is confined to `commitDrag`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Music, Unlock, Volume2, VolumeX } from "lucide-react";
import type { Layer, Project, Scene } from "@shared/project.js";
import {
  formatTimecode,
  projectDurationInFrames,
  sceneTimings,
} from "@shared/project.js";
import { useEditorStore } from "@/state/editorStore";
import { useProjectStore } from "@/state/projectStore";
import * as ops from "@/state/operations";
import { IconButton } from "./controls";
import { cn } from "@/lib/utils";

const LABEL_WIDTH = 168;
const RULER_HEIGHT = 26;
const SCENE_BAND_HEIGHT = 22;

type DragKind = "move" | "trim-start" | "trim-end";

interface Drag {
  kind: DragKind;
  target: { type: "layer" | "audio"; id: string };
  startX: number;
  originStart: number;
  originDuration: number;
  moved: boolean;
}

export const Timeline: React.FC<{ project: Project }> = ({ project }) => {
  const scaleRaw = useEditorStore((s) => s.timelineScale);
  const playhead = useEditorStore((s) => s.playhead);
  const selection = useEditorStore((s) => s.selection);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const select = useEditorStore((s) => s.select);
  const zoomTimelineBy = useEditorStore((s) => s.zoomTimelineBy);

  const apply = useProjectStore((s) => s.apply);

  const trackAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const { fps } = project.composition;
  const duration = useMemo(() => projectDurationInFrames(project), [project]);
  const timings = useMemo(() => sceneTimings(project), [project]);

  /** Pixels per frame. */
  const scale = scaleRaw;
  const contentWidth = Math.max(320, duration * scale + 160);

  /** The scene the playhead is in - the one whose layers are shown. */
  const activeIndex = useMemo(() => {
    for (let i = timings.length - 1; i >= 0; i -= 1) {
      if (playhead >= timings[i].from) return i;
    }
    return 0;
  }, [timings, playhead]);

  const activeScene: Scene | undefined = project.scenes[activeIndex];
  const activeFrom = timings[activeIndex]?.from ?? 0;

  /**
   * Keep the playhead in view.
   *
   * Without this the timeline silently shows frame 0 while the playhead sits
   * at frame 200, so the active scene's clips are off screen and the panel
   * looks empty. Scrolls only when the playhead leaves a margin inside the
   * viewport, so ordinary scrubbing does not yank the view on every frame.
   */
  useEffect(() => {
    const element = trackAreaRef.current;
    if (!element) return;

    const x = playhead * scale;
    const margin = 80;
    const left = element.scrollLeft;
    const right = left + element.clientWidth;

    if (x < left + margin) {
      element.scrollLeft = Math.max(0, x - margin);
    } else if (x > right - margin) {
      element.scrollLeft = x - element.clientWidth + margin;
    }
  }, [playhead, scale]);

  /* ---- scrubbing ---- */

  const frameFromClientX = useCallback(
    (clientX: number) => {
      const element = trackAreaRef.current;
      if (!element) return 0;
      const box = element.getBoundingClientRect();
      return Math.max(0, Math.round((clientX - box.left + element.scrollLeft) / scale));
    },
    [scale],
  );

  const startScrub = (event: React.PointerEvent) => {
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    setPlayhead(Math.min(duration - 1, frameFromClientX(event.clientX)));

    const onMove = (e: PointerEvent) =>
      setPlayhead(Math.min(duration - 1, frameFromClientX(e.clientX)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ---- clip dragging ---- */

  const beginDrag = (
    event: React.PointerEvent,
    kind: DragKind,
    target: Drag["target"],
    start: number,
    durationFrames: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      kind,
      target,
      startX: event.clientX,
      originStart: start,
      originDuration: durationFrames,
      moved: false,
    };
    setDragging(true);

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaFrames = Math.round((e.clientX - drag.startX) / scale);
      // A drag that has not moved a whole frame is still a click; committing
      // now would push a no-op onto the undo stack on every clip selection.
      if (deltaFrames === 0 && !drag.moved) return;
      drag.moved = true;

      commitDrag(drag, deltaFrames, { coalesce: true });
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /**
   * Apply a drag delta to the model.
   *
   * All edits from one gesture share a coalesce key, so the whole drag
   * collapses into a single undo entry.
   */
  const commitDrag = (drag: Drag, deltaFrames: number, opts: { coalesce: boolean }) => {
    const key = opts.coalesce ? `drag:${drag.target.id}` : undefined;

    if (drag.target.type === "layer") {
      const timing = timingFor(drag, deltaFrames);
      apply(
        drag.kind === "move" ? "Move layer" : "Trim layer",
        (p) => ops.setLayerTiming(p, drag.target.id, timing),
        { coalesceKey: key },
      );
      return;
    }

    const timing = timingFor(drag, deltaFrames);
    apply(
      drag.kind === "move" ? "Move audio" : "Trim audio",
      (p) =>
        ops.updateAudio(p, drag.target.id, {
          start: Math.max(0, timing.start ?? 0),
          duration: Math.max(1, timing.duration ?? 1),
        }),
      { coalesceKey: key },
    );
  };

  const totalTrackHeight =
    (activeScene?.layers.length ?? 0) * 30 + project.audio.length * 30 + 60;

  return (
    <div className="rm-panel flex min-h-0 flex-1 flex-col">
      <TimelineToolbar
        project={project}
        sceneName={activeScene?.name ?? ""}
        onZoomIn={() => zoomTimelineBy(1.4)}
        onZoomOut={() => zoomTimelineBy(1 / 1.4)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Track labels. A separate column rather than sticky cells, so the
            track area scrolls horizontally without the labels smearing. */}
        <div
          className="rm-hairline-r shrink-0 overflow-hidden"
          style={{ width: LABEL_WIDTH }}
        >
          <div style={{ height: RULER_HEIGHT + SCENE_BAND_HEIGHT }} className="rm-hairline-b" />
          <div className="overflow-hidden">
            {activeScene?.layers
              .slice()
              .reverse()
              .map((layer) => (
                <LayerLabel
                  key={layer.id}
                  layer={layer}
                  selected={selection.kind === "layer" && selection.id === layer.id}
                  onSelect={() => select({ kind: "layer", id: layer.id })}
                  onToggleHidden={() =>
                    apply("Toggle visibility", (p) =>
                      ops.updateLayer(p, layer.id, { hidden: !layer.hidden }),
                    )
                  }
                  onToggleLocked={() =>
                    apply("Toggle lock", (p) =>
                      ops.updateLayer(p, layer.id, { locked: !layer.locked }),
                    )
                  }
                />
              ))}

            {project.audio.length ? (
              <div className="rm-hairline-t mt-1 pt-1">
                {project.audio.map((clip) => (
                  <AudioLabel
                    key={clip.id}
                    clip={clip}
                    selected={selection.kind === "audio" && selection.id === clip.id}
                    onSelect={() => select({ kind: "audio", id: clip.id })}
                    onToggleMuted={() =>
                      apply("Toggle mute", (p) =>
                        ops.updateAudio(p, clip.id, { muted: !clip.muted }),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Track area */}
        <div
          ref={trackAreaRef}
          className="rm-scroll relative min-w-0 flex-1 overflow-auto"
        >
          <div style={{ width: contentWidth, minHeight: totalTrackHeight }}>
            <Ruler
              duration={duration}
              fps={fps}
              scale={scale}
              onScrub={startScrub}
            />

            <SceneBand
              project={project}
              timings={timings}
              scale={scale}
              activeIndex={activeIndex}
              selectedId={selection.kind === "scene" ? selection.id : null}
              onSelect={(scene, from) => {
                select({ kind: "scene", id: scene.id });
                setPlayhead(from);
              }}
              onScrub={startScrub}
            />

            <div className="relative">
              {activeScene?.layers
                .slice()
                .reverse()
                .map((layer) => (
                  <div key={layer.id} className="relative h-[30px]">
                    <Clip
                      label={layer.name}
                      left={(activeFrom + layer.start) * scale}
                      width={layer.duration * scale}
                      tone={toneForLayer(layer)}
                      selected={selection.kind === "layer" && selection.id === layer.id}
                      dimmed={layer.hidden}
                      locked={layer.locked}
                      onSelect={() => select({ kind: "layer", id: layer.id })}
                      onDragStart={(e, kind) =>
                        layer.locked
                          ? undefined
                          : beginDrag(e, kind, { type: "layer", id: layer.id }, layer.start, layer.duration)
                      }
                    />
                  </div>
                ))}

              {project.audio.length ? (
                <div className="rm-hairline-t mt-1 pt-1">
                  {project.audio.map((clip) => (
                    <div key={clip.id} className="relative h-[30px]">
                      <Clip
                        label={clip.name}
                        left={clip.start * scale}
                        width={clip.duration * scale}
                        tone="audio"
                        selected={selection.kind === "audio" && selection.id === clip.id}
                        dimmed={clip.muted}
                        onSelect={() => select({ kind: "audio", id: clip.id })}
                        onDragStart={(e, kind) =>
                          beginDrag(e, kind, { type: "audio", id: clip.id }, clip.start, clip.duration)
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Playhead frame={playhead} scale={scale} dragging={dragging} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Convert a drag delta into new timing.
 *
 * Trimming the start moves the in-point *and* shortens the clip by the same
 * amount, so the out-point stays put - which is what a user expects when
 * pulling the left edge of a clip.
 */
function timingFor(drag: Drag, deltaFrames: number): { start?: number; duration?: number } {
  if (drag.kind === "move") {
    return { start: Math.max(0, drag.originStart + deltaFrames) };
  }
  if (drag.kind === "trim-start") {
    const start = Math.max(0, drag.originStart + deltaFrames);
    const consumed = start - drag.originStart;
    return { start, duration: Math.max(1, drag.originDuration - consumed) };
  }
  return { duration: Math.max(1, drag.originDuration + deltaFrames) };
}

function toneForLayer(layer: Layer): ClipTone {
  if (layer.type === "background") return "background";
  if (layer.type === "text") return "text";
  if (layer.type === "component") return "component";
  if (layer.type === "video" || layer.type === "image") return "media";
  return "shape";
}

/* ------------------------------------------------------------------ *
 * Ruler
 * ------------------------------------------------------------------ */

const Ruler: React.FC<{
  duration: number;
  fps: number;
  scale: number;
  onScrub: (event: React.PointerEvent) => void;
}> = ({ duration, fps, scale, onScrub }) => {
  // Choose a tick interval that keeps labels at least ~64px apart at the
  // current zoom, stepping through musically sensible second counts rather
  // than arbitrary frame counts.
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const secondsPerTick =
    candidates.find((s) => s * fps * scale >= 64) ?? candidates[candidates.length - 1];
  const framesPerTick = secondsPerTick * fps;
  const tickCount = Math.floor(duration / framesPerTick) + 1;

  return (
    <div
      onPointerDown={onScrub}
      style={{ height: RULER_HEIGHT }}
      className="relative cursor-ew-resize select-none bg-[var(--rm-chrome-low)]"
    >
      {Array.from({ length: tickCount }, (_, i) => {
        const frame = i * framesPerTick;
        return (
          <div
            key={frame}
            className="absolute top-0 h-full"
            style={{ left: frame * scale }}
          >
            <div className="h-2 w-px bg-[var(--rm-line-strong)]" />
            <span className="rm-num absolute left-1 top-1.5 whitespace-nowrap text-[9px] text-[var(--rm-text-faint)]">
              {formatTimecode(frame, fps)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Scene band
 * ------------------------------------------------------------------ */

const SceneBand: React.FC<{
  project: Project;
  timings: ReturnType<typeof sceneTimings>;
  scale: number;
  activeIndex: number;
  selectedId: string | null;
  onSelect: (scene: Scene, from: number) => void;
  onScrub: (event: React.PointerEvent) => void;
}> = ({ project, timings, scale, activeIndex, selectedId, onSelect, onScrub }) => (
  <div
    onPointerDown={onScrub}
    style={{ height: SCENE_BAND_HEIGHT }}
    className="rm-hairline-b relative select-none bg-[var(--rm-chrome-low)]"
  >
    {project.scenes.map((scene, i) => {
      const timing = timings[i];
      return (
        <button
          key={scene.id}
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(scene, timing.from);
          }}
          title={`${scene.name} - ${scene.durationInFrames} frames`}
          className={cn(
            "absolute top-[3px] flex h-[16px] items-center overflow-hidden rounded-[3px] px-1.5 text-left text-[10px] transition-colors duration-100",
            i === activeIndex
              ? "bg-[var(--rm-accent-dim)] text-[var(--rm-accent)]"
              : "bg-[var(--rm-chrome-high)] text-[var(--rm-text-dim)] hover:text-[var(--rm-text)]",
            selectedId === scene.id && "ring-1 ring-[var(--rm-accent)]",
          )}
          style={{
            left: timing.from * scale + 1,
            // -2px so consecutive scenes read as separate blocks rather than
            // one continuous bar.
            width: Math.max(6, timing.duration * scale - 2),
          }}
        >
          <span className="truncate">{scene.name}</span>
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ *
 * Clip
 * ------------------------------------------------------------------ */

type ClipTone = "text" | "media" | "shape" | "background" | "component" | "audio";

const TONE_STYLES: Record<ClipTone, string> = {
  text: "bg-[oklch(0.42_0.09_275)]",
  media: "bg-[oklch(0.42_0.09_215)]",
  shape: "bg-[oklch(0.40_0.05_265)]",
  background: "bg-[oklch(0.36_0.04_265)]",
  component: "bg-[oklch(0.44_0.10_305)]",
  audio: "bg-[oklch(0.42_0.09_165)]",
};

const Clip: React.FC<{
  label: string;
  left: number;
  width: number;
  tone: ClipTone;
  selected: boolean;
  dimmed?: boolean;
  locked?: boolean;
  onSelect: () => void;
  onDragStart: (event: React.PointerEvent, kind: DragKind) => void;
}> = ({ label, left, width, tone, selected, dimmed, locked, onSelect, onDragStart }) => (
  <div
    onPointerDown={(e) => {
      onSelect();
      if (e.button === 0) onDragStart(e, "move");
    }}
    className={cn(
      "group absolute top-[3px] flex h-[24px] items-center overflow-hidden rounded-[4px] px-2",
      "transition-shadow duration-100",
      TONE_STYLES[tone],
      locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
      dimmed && "opacity-40",
      selected
        ? "ring-[1.5px] ring-[var(--rm-accent)]"
        : "shadow-[inset_0_10px_14px_-12px_rgb(255_255_255/0.16)] hover:shadow-[inset_0_10px_14px_-12px_rgb(255_255_255/0.3)]",
    )}
    style={{ left, width: Math.max(8, width) }}
  >
    <span className="pointer-events-none truncate text-[11px] text-white/90">{label}</span>

    {/* Trim handles. Invisible until hover so the clip stays clean, but
        always 6px wide so they are hittable without precision. */}
    {!locked ? (
      <>
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
            onDragStart(e, "trim-start");
          }}
          className="absolute left-0 top-0 h-full w-[6px] cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/25"
        />
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
            onDragStart(e, "trim-end");
          }}
          className="absolute right-0 top-0 h-full w-[6px] cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/25"
        />
      </>
    ) : null}
  </div>
);

const Playhead: React.FC<{ frame: number; scale: number; dragging: boolean }> = ({
  frame,
  scale,
  dragging,
}) => (
  <div
    className="pointer-events-none absolute top-0 z-10 h-full"
    style={{ left: frame * scale }}
  >
    <div
      className={cn(
        "h-full w-px bg-[var(--rm-accent)]",
        !dragging && "transition-none",
      )}
    />
    <div className="absolute -left-[4px] top-0 size-[9px] rotate-45 rounded-[1px] bg-[var(--rm-accent)]" />
  </div>
);

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

const LayerLabel: React.FC<{
  layer: Layer;
  selected: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
}> = ({ layer, selected, onSelect, onToggleHidden, onToggleLocked }) => (
  <div
    onClick={onSelect}
    className={cn(
      "group flex h-[30px] cursor-default items-center gap-1 px-2",
      selected ? "bg-[var(--rm-accent-dim)]" : "hover:bg-[var(--rm-chrome-high)]",
    )}
  >
    <span
      className={cn(
        "min-w-0 flex-1 truncate text-[11px]",
        layer.hidden ? "text-[var(--rm-text-faint)]" : "text-[var(--rm-text-dim)]",
        selected && "text-[var(--rm-text)]",
      )}
    >
      {layer.name}
    </span>

    <IconButton
      title={layer.locked ? "Unlock" : "Lock"}
      onClick={onToggleLocked}
      className={cn("size-5", !layer.locked && "opacity-0 group-hover:opacity-100")}
    >
      {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
    </IconButton>
    <IconButton
      title={layer.hidden ? "Show" : "Hide"}
      onClick={onToggleHidden}
      className={cn("size-5", !layer.hidden && "opacity-0 group-hover:opacity-100")}
    >
      {layer.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
    </IconButton>
  </div>
);

const AudioLabel: React.FC<{
  clip: Project["audio"][number];
  selected: boolean;
  onSelect: () => void;
  onToggleMuted: () => void;
}> = ({ clip, selected, onSelect, onToggleMuted }) => (
  <div
    onClick={onSelect}
    className={cn(
      "group flex h-[30px] cursor-default items-center gap-1 px-2",
      selected ? "bg-[var(--rm-accent-dim)]" : "hover:bg-[var(--rm-chrome-high)]",
    )}
  >
    <Music className="size-3 shrink-0 text-[var(--rm-text-faint)]" />
    <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--rm-text-dim)]">
      {clip.name}
    </span>
    <IconButton title={clip.muted ? "Unmute" : "Mute"} onClick={onToggleMuted} className="size-5">
      {clip.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
    </IconButton>
  </div>
);

/* ------------------------------------------------------------------ *
 * Toolbar
 * ------------------------------------------------------------------ */

const TimelineToolbar: React.FC<{
  project: Project;
  sceneName: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
}> = ({ project, sceneName, onZoomIn, onZoomOut }) => {
  const duration = projectDurationInFrames(project);
  return (
    <div className="rm-hairline-b flex h-8 shrink-0 items-center gap-2 px-2">
      <span className="text-[11px] text-[var(--rm-text)]">{sceneName}</span>
      <span className="rm-num text-[10px] text-[var(--rm-text-faint)]">
        {project.scenes.length} {project.scenes.length === 1 ? "scene" : "scenes"} ·{" "}
        {formatTimecode(duration, project.composition.fps)} ·{" "}
        {project.composition.width}x{project.composition.height} @ {project.composition.fps}fps
      </span>
      <div className="flex-1" />
      <IconButton title="Zoom out timeline" onClick={onZoomOut}>
        <span className="text-[13px] leading-none">-</span>
      </IconButton>
      <IconButton title="Zoom in timeline" onClick={onZoomIn}>
        <span className="text-[13px] leading-none">+</span>
      </IconButton>
    </div>
  );
};
