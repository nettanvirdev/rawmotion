/**
 * Editor state - everything that is *not* the document.
 *
 * Selection, playhead, zoom, which panels are open. None of it is persisted
 * into `project.json`, and none of it belongs in undo history: a user who
 * presses Cmd+Z after nudging a layer expects the nudge to revert, not their
 * scroll position.
 *
 * The playhead lives here rather than inside the Player because several
 * components need it - the timeline draws it, the inspector shows a
 * timecode, the canvas overlay follows it - and reading it out of an
 * imperative player ref in each of them would resynchronise badly.
 */

import { create } from "zustand";

export type Selection =
  | { kind: "none" }
  | { kind: "scene"; id: string }
  | { kind: "layer"; id: string }
  | { kind: "audio"; id: string };

export type BottomPanel = "timeline" | "renders";
export type LeftPanel = "scenes" | "assets" | "components" | "files";

/** Canvas zoom. `"fit"` recomputes on resize; a number is an explicit scale. */
export type Zoom = "fit" | number;

export interface EditorState {
  selection: Selection;
  /** Absolute frame on the project timeline. */
  playhead: number;
  playing: boolean;

  zoom: Zoom;
  pan: { x: number; y: number };
  /** Overlay the composition grid the engine actually lays out on. */
  showSafeAreas: boolean;

  leftPanel: LeftPanel;
  bottomPanel: BottomPanel;
  leftOpen: boolean;
  inspectorOpen: boolean;
  bottomHeight: number;

  /** Horizontal timeline scale, in pixels per frame. */
  timelineScale: number;

  commandPaletteOpen: boolean;

  /** The custom-component source editor modal. `file` = which file is open. */
  componentEditorOpen: boolean;
  componentEditorFile: string | null;
  openComponentEditor(file?: string | null): void;
  closeComponentEditor(): void;

  select(selection: Selection): void;
  selectLayer(id: string): void;
  selectScene(id: string): void;
  clearSelection(): void;

  setPlayhead(frame: number): void;
  setPlaying(playing: boolean): void;
  togglePlaying(): void;

  setZoom(zoom: Zoom): void;
  zoomBy(factor: number): void;
  setPan(pan: { x: number; y: number }): void;
  resetView(): void;
  toggleSafeAreas(): void;

  setLeftPanel(panel: LeftPanel): void;
  setBottomPanel(panel: BottomPanel): void;
  toggleLeft(): void;
  toggleInspector(): void;
  setBottomHeight(height: number): void;

  setTimelineScale(scale: number): void;
  zoomTimelineBy(factor: number): void;

  setCommandPaletteOpen(open: boolean): void;
}

const MIN_CANVAS_ZOOM = 0.05;
const MAX_CANVAS_ZOOM = 8;
const MIN_TIMELINE_SCALE = 0.5;
const MAX_TIMELINE_SCALE = 40;

export const useEditorStore = create<EditorState>((set, get) => ({
  selection: { kind: "none" },
  playhead: 0,
  playing: false,

  zoom: "fit",
  pan: { x: 0, y: 0 },
  showSafeAreas: false,

  leftPanel: "scenes",
  bottomPanel: "timeline",
  leftOpen: true,
  inspectorOpen: true,
  bottomHeight: 260,

  timelineScale: 4,

  commandPaletteOpen: false,

  componentEditorOpen: false,
  componentEditorFile: null,
  openComponentEditor: (file = null) =>
    set({ componentEditorOpen: true, componentEditorFile: file ?? null }),
  closeComponentEditor: () => set({ componentEditorOpen: false }),

  select: (selection) => set({ selection }),
  selectLayer: (id) => set({ selection: { kind: "layer", id } }),
  selectScene: (id) => set({ selection: { kind: "scene", id } }),
  clearSelection: () => set({ selection: { kind: "none" } }),

  // Rounded and floored: a fractional playhead would make the timeline and
  // the Player disagree about which frame is current, producing a one-frame
  // flicker whenever a scrub lands mid-frame.
  setPlayhead: (frame) => set({ playhead: Math.max(0, Math.round(frame)) }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set({ playing: !get().playing }),

  setZoom: (zoom) =>
    set({
      zoom:
        typeof zoom === "number"
          ? Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom))
          : zoom,
    }),

  /**
   * Multiply the current zoom.
   *
   * When the canvas is in `"fit"` mode there is no numeric scale to multiply,
   * so the caller is expected to have measured the fitted scale and pushed it
   * in first; falling back to 1 here keeps the gesture from jumping wildly.
   */
  zoomBy: (factor) => {
    const current = get().zoom;
    const base = typeof current === "number" ? current : 1;
    get().setZoom(base * factor);
  },

  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: "fit", pan: { x: 0, y: 0 } }),
  toggleSafeAreas: () => set({ showSafeAreas: !get().showSafeAreas }),

  setLeftPanel: (leftPanel) => set({ leftPanel, leftOpen: true }),
  setBottomPanel: (bottomPanel) => set({ bottomPanel }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
  setBottomHeight: (height) =>
    set({ bottomHeight: Math.max(160, Math.min(620, Math.round(height))) }),

  setTimelineScale: (scale) =>
    set({
      timelineScale: Math.min(
        MAX_TIMELINE_SCALE,
        Math.max(MIN_TIMELINE_SCALE, scale),
      ),
    }),
  zoomTimelineBy: (factor) => get().setTimelineScale(get().timelineScale * factor),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}));
