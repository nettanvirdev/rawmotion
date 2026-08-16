/**
 * The preview canvas.
 *
 * Wraps `@remotion/player` around the same `RawMotionComposition` the final
 * render uses, and adds the viewing apparatus around it: zoom, pan, fit,
 * safe areas, transport.
 *
 * The delicate part is the relationship between the Player's internal frame
 * and the editor's `playhead`. They are two clocks, and if both try to drive
 * each other they oscillate. The rule here:
 *
 *   - while playing, the Player is authoritative and pushes frames out;
 *   - while paused, the editor is authoritative and seeks the Player.
 *
 * `syncingRef` marks frame updates that originated from our own seek so the
 * Player's echo does not bounce back as a user scrub.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  AlertTriangle,
  Frame,
  Maximize2,
  Pause,
  Play,
  Scan,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Project } from "@shared/project.js";
import { formatTimecode, projectDurationInFrames } from "@shared/project.js";
import { RawMotionComposition } from "@motion/RawMotionComposition";
import { mapAssetResolver } from "@motion/assets";
import { DEFAULT_GRID, safeArea } from "@motion/layout";
import { useEditorStore } from "@/state/editorStore";
import { IconButton } from "./controls";
import { cn } from "@/lib/utils";

export const Canvas: React.FC<{
  project: Project;
  assetUrls: Record<string, string>;
}> = ({ project, assetUrls }) => {
  const playerRef = useRef<PlayerRef>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const showSafeAreas = useEditorStore((s) => s.showSafeAreas);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const resetView = useEditorStore((s) => s.resetView);
  const toggleSafeAreas = useEditorStore((s) => s.toggleSafeAreas);

  const { width, height, fps } = project.composition;
  const durationInFrames = useMemo(() => projectDurationInFrames(project), [project]);

  /* ---- crash recovery ---- */

  // A composition that throws - a bad property, a malformed layer - takes the
  // Player's internal error boundary with it, and that boundary never resets
  // on its own: the canvas stays dark even after the offending edit is undone.
  // Remounting the Player (the key below) is the only way out, so any project
  // change while broken retries automatically - undo included.
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const previewBroken = useRef(false);

  const retryPreview = useCallback(() => {
    previewBroken.current = false;
    setPreviewEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    if (!previewBroken.current) return;
    retryPreview();
  }, [project, retryPreview]);

  /* ---- fit-to-viewport ---- */

  const [fitScale, setFitScale] = useState(0.5);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const measure = () => {
      const box = element.getBoundingClientRect();
      // 56px of breathing room so the frame never touches the panel edges -
      // a preview flush against its container reads as cropped.
      const scale = Math.min(
        (box.width - 56) / width,
        (box.height - 56) / height,
      );
      setFitScale(Math.max(0.02, scale));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height]);

  const scale = zoom === "fit" ? fitScale : zoom;

  /* ---- clock synchronisation ---- */

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return undefined;

    const onFrameUpdate = (event: { detail: { frame: number } }) => {
      if (syncingRef.current) return;
      setPlayhead(event.detail.frame);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      previewBroken.current = true;
      setPlaying(false);
    };

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    player.addEventListener("error", onError);
    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("error", onError);
    };
    // previewEpoch: the Player remounts after a crash and the new instance
    // needs the listeners attached again.
  }, [setPlayhead, setPlaying, previewEpoch]);

  // Editor -> Player, only while paused. Seeking during playback would fight
  // the Player's own advance and stutter.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || playing) return;
    if (player.getCurrentFrame() === playhead) return;

    syncingRef.current = true;
    player.seekTo(playhead);
    // Cleared on a macrotask so the Player's resulting frameupdate - which
    // is dispatched synchronously during seekTo on some paths and async on
    // others - is still covered.
    const timer = setTimeout(() => {
      syncingRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [playhead, playing]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing && !player.isPlaying()) player.play();
    if (!playing && player.isPlaying()) player.pause();
  }, [playing]);

  /* ---- pan and wheel zoom ---- */

  const panGesture = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    // Middle mouse, or space-less alt-drag: the two conventions every canvas
    // tool supports. Left-drag is reserved for future direct manipulation.
    if (event.button !== 1 && !(event.button === 0 && event.altKey)) return;
    event.preventDefault();
    panGesture.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const g = panGesture.current;
    if (!g) return;
    setPan({ x: g.panX + (event.clientX - g.x), y: g.panY + (event.clientY - g.y) });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!panGesture.current) return;
    panGesture.current = null;
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      // Ctrl/Cmd + wheel is the universal zoom gesture, and is also what a
      // trackpad pinch reports. Plain wheel scrolls (pans) instead.
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.002);
        setZoom((zoom === "fit" ? fitScale : zoom) * factor);
      } else {
        setPan({ x: pan.x - event.deltaX, y: pan.y - event.deltaY });
      }
    },
    [zoom, fitScale, pan, setZoom, setPan],
  );

  /* ---- asset resolution ---- */

  const resolveAsset = useMemo(() => mapAssetResolver(assetUrls), [assetUrls]);

  // Remotion compares inputProps by identity to decide whether to remount;
  // an inline object here would rebuild the whole composition every render.
  const inputProps = useMemo(
    () => ({ project, resolveAsset }),
    [project, resolveAsset],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={resetView}
        className="rm-checker relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div
          style={{
            width: width * scale,
            height: height * scale,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            // The frame casts a shadow onto the void so it reads as a
            // physical object sitting above the workspace.
            boxShadow: "0 24px 80px -16px rgb(0 0 0 / 0.7), 0 0 0 1px oklch(1 0 0 / 0.06)",
          }}
          className="relative shrink-0"
        >
          <Player
            key={previewEpoch}
            ref={playerRef}
            component={RawMotionComposition as unknown as React.FC<Record<string, unknown>>}
            inputProps={inputProps as unknown as Record<string, unknown>}
            durationInFrames={durationInFrames}
            compositionWidth={width}
            compositionHeight={height}
            fps={fps}
            errorFallback={({ error }) => {
              previewBroken.current = true;
              return <PreviewCrash message={error.message} onRetry={retryPreview} />;
            }}
            style={{ width: "100%", height: "100%" }}
            // The editor owns the transport, so the Player shows no chrome
            // of its own; two sets of transport controls in one window is a
            // usability failure, not a convenience.
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            acknowledgeRemotionLicense
          />

          {showSafeAreas ? <LayoutGuides /> : null}
        </div>

        <ZoomBadge scale={scale} isFit={zoom === "fit"} />
      </div>

      <Transport
        playhead={playhead}
        playing={playing}
        durationInFrames={durationInFrames}
        fps={fps}
        onTogglePlay={() => setPlaying(!playing)}
        onSeek={setPlayhead}
        onZoomIn={() => setZoom(scale * 1.25)}
        onZoomOut={() => setZoom(scale / 1.25)}
        onFit={resetView}
        onActualSize={() => setZoom(1)}
        onToggleSafeAreas={toggleSafeAreas}
        safeAreas={showSafeAreas}
      />
    </div>
  );
};

/**
 * Layout guides.
 *
 * Draws the *actual* grid the engine positions layers on - the same
 * `DEFAULT_GRID` and `safeArea` the renderer uses - rather than a generic
 * broadcast safe-area overlay. That is the point: a guide that approximates
 * the real grid is worse than none, because a user aligning to it would be
 * aligning to a line the composition does not have.
 *
 * Column lines are drawn brighter than row lines because horizontal
 * alignment is what people actually check.
 */
const LayoutGuides: React.FC = () => {
  const grid = DEFAULT_GRID;

  // Percentages, so the overlay scales with the canvas at any zoom.
  const area = safeArea(100, 100, grid);
  const gutterX = (grid.gutter / 1920) * 100;
  const gutterY = (grid.gutter / 1080) * 100;
  const colWidth = (area.width - gutterX * (grid.columns - 1)) / grid.columns;
  const rowHeight = (area.height - gutterY * (grid.rows - 1)) / grid.rows;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Safe area */}
      <div
        className="absolute border border-dashed border-[var(--rm-accent)]/30"
        style={{
          left: `${area.left}%`,
          top: `${area.top}%`,
          width: `${area.width}%`,
          height: `${area.height}%`,
        }}
      />

      {Array.from({ length: grid.columns }, (_, i) => (
        <div
          key={`c${i}`}
          className="absolute bg-[var(--rm-accent)]/12"
          style={{
            left: `${area.left + i * (colWidth + gutterX)}%`,
            top: `${area.top}%`,
            width: `${colWidth}%`,
            height: `${area.height}%`,
          }}
        />
      ))}

      {Array.from({ length: grid.rows - 1 }, (_, i) => (
        <div
          key={`r${i}`}
          className="absolute bg-white/8"
          style={{
            left: `${area.left}%`,
            top: `${area.top + (i + 1) * rowHeight + i * gutterY}%`,
            width: `${area.width}%`,
            height: "1px",
          }}
        />
      ))}

      {/* Centre lines - the reference for anything meant to be centred. */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
      <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
    </div>
  );
};

/**
 * Shown in place of the preview when the composition throws.
 *
 * The crash is almost always the *edit*, not the app - a malformed value in
 * a layer the user just touched - so the copy points at undo, and the
 * boundary above retries automatically the moment the project changes.
 */
const PreviewCrash: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--rm-chrome-low)] p-8 text-center">
    <AlertTriangle className="size-5 text-[var(--rm-danger)]" />
    <p className="max-w-[440px] text-[12px] leading-[1.6] text-[var(--rm-text-dim)]">
      The preview crashed on the current composition
      {message ? (
        <>
          : <span className="text-[var(--rm-danger)]">{message}</span>
        </>
      ) : (
        "."
      )}
    </p>
    <p className="text-[11px] text-[var(--rm-text-faint)]">
      Undo the last change or fix the layer - the preview reloads on the next edit.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-1 h-8 rounded-[6px] bg-[var(--rm-chrome-high)] px-3 text-[12px] text-[var(--rm-text)] transition-colors duration-100 hover:bg-[var(--rm-accent)]"
    >
      Reload preview
    </button>
  </div>
);

const ZoomBadge: React.FC<{ scale: number; isFit: boolean }> = ({ scale, isFit }) => (
  <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-white/55 backdrop-blur-sm rm-num">
    {isFit ? "Fit " : ""}
    {Math.round(scale * 100)}%
  </div>
);

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

const Transport: React.FC<{
  playhead: number;
  playing: boolean;
  durationInFrames: number;
  fps: number;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onToggleSafeAreas: () => void;
  safeAreas: boolean;
}> = ({
  playhead,
  playing,
  durationInFrames,
  fps,
  onTogglePlay,
  onSeek,
  onZoomIn,
  onZoomOut,
  onFit,
  onActualSize,
  onToggleSafeAreas,
  safeAreas,
}) => (
  <div className="rm-panel rm-hairline-t flex h-10 shrink-0 items-center gap-1 px-2">
    <IconButton title="Go to start" onClick={() => onSeek(0)}>
      <SkipBack className="size-3.5" />
    </IconButton>

    <button
      type="button"
      onClick={onTogglePlay}
      title={playing ? "Pause (Space)" : "Play (Space)"}
      aria-label={playing ? "Pause" : "Play"}
      className={cn(
        "grid size-7 place-items-center rounded-[5px] transition-colors duration-100",
        "bg-[var(--rm-chrome-high)] text-[var(--rm-text)] hover:bg-[var(--rm-accent)]",
      )}
    >
      {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
    </button>

    <IconButton title="Go to end" onClick={() => onSeek(durationInFrames - 1)}>
      <SkipForward className="size-3.5" />
    </IconButton>

    <div className="ml-2 flex items-baseline gap-1.5">
      <span className="rm-num text-[12px] text-[var(--rm-text)]">
        {formatTimecode(playhead, fps)}
      </span>
      <span className="rm-num text-[11px] text-[var(--rm-text-faint)]">
        / {formatTimecode(durationInFrames, fps)}
      </span>
    </div>

    <div className="flex-1" />

    <span className="rm-num mr-1 text-[10px] text-[var(--rm-text-faint)]">
      frame {playhead}
    </span>

    <IconButton title="Layout grid" onClick={onToggleSafeAreas} active={safeAreas}>
      <Frame className="size-3.5" />
    </IconButton>
    <IconButton title="Zoom out" onClick={onZoomOut}>
      <ZoomOut className="size-3.5" />
    </IconButton>
    <IconButton title="Zoom in" onClick={onZoomIn}>
      <ZoomIn className="size-3.5" />
    </IconButton>
    <IconButton title="Actual pixels (100%)" onClick={onActualSize}>
      <Maximize2 className="size-3.5" />
    </IconButton>
    <IconButton title="Fit to window" onClick={onFit}>
      <Scan className="size-3.5" />
    </IconButton>
  </div>
);
