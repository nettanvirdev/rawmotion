/**
 * Project state - the persistent creative document.
 *
 * Deliberately the *only* store that owns project data. Editor state
 * (selection, zoom), render state and AI history live in their own stores,
 * because mixing them would mean a playhead move dirties the document and a
 * scrub lands in the undo stack.
 *
 * ## Undo
 *
 * History holds whole `Project` snapshots rather than inverse operations.
 * Snapshots are the right trade here: the operations in `operations.ts` are
 * structurally sharing, so an undo entry costs a handful of objects rather
 * than a copy of the document, and a snapshot cannot get out of step with
 * its operation the way a hand-written inverse can.
 *
 * Two mechanisms keep the stack meaningful:
 *
 *  - **Coalescing.** Dragging a slider fires an edit per pointer move. Edits
 *    sharing a `coalesceKey` within a short window replace the top entry
 *    instead of pushing, so one drag is one undo.
 *  - **Transactions.** `transaction()` groups many edits into a single entry.
 *    This is what makes an AI operation - which may add a scene, six layers
 *    and a soundtrack - undo as one action, which the spec calls out as
 *    essential for trust.
 */

import { create } from "zustand";
import type { Project } from "@shared/project.js";
import { bridge, errorMessage } from "@/lib/bridge";

/** Edits sharing a key within this window collapse into one history entry. */
const COALESCE_WINDOW_MS = 700;

/** Autosave debounce. Long enough to batch a drag, short enough to feel safe. */
const AUTOSAVE_MS = 600;

/** Entries kept. Beyond this the oldest are dropped. */
const HISTORY_LIMIT = 200;

interface HistoryEntry {
  project: Project;
  label: string;
  coalesceKey?: string;
  at: number;
}

export interface ProjectState {
  dirName: string | null;
  project: Project | null;

  past: HistoryEntry[];
  future: HistoryEntry[];

  dirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;

  /** Depth of nested `transaction` calls. */
  transactionDepth: number;
  /** Snapshot taken when the outermost transaction opened. */
  transactionBase: Project | null;
  transactionLabel: string;

  load(dirName: string, project: Project): void;
  closeProject(): void;

  apply(
    label: string,
    updater: (project: Project) => Project,
    options?: { coalesceKey?: string },
  ): void;

  transaction(label: string, body: () => void): void;

  undo(): string | null;
  redo(): string | null;
  canUndo(): boolean;
  canRedo(): boolean;

  save(): Promise<void>;
  adoptFromDisk(project: Project): void;
  setError(error: string | null): void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectStore = create<ProjectState>((set, get) => {
  /** Queue a debounced save. Cancels any pending one. */
  function scheduleSave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void get().save();
    }, AUTOSAVE_MS);
  }

  /** Record `project` as the new present, pushing the previous onto history. */
  function commit(previous: Project, next: Project, label: string, coalesceKey?: string) {
    const { past } = get();
    const now = Date.now();
    const top = past[past.length - 1];

    const shouldCoalesce =
      Boolean(coalesceKey) &&
      top?.coalesceKey === coalesceKey &&
      now - top.at < COALESCE_WINDOW_MS;

    // When coalescing, the *older* snapshot is kept - undo should return to
    // where the drag began, not to the previous pointer position.
    const nextPast = shouldCoalesce
      ? [...past.slice(0, -1), { ...top, at: now }]
      : [...past, { project: previous, label, coalesceKey, at: now }];

    set({
      project: next,
      past: nextPast.slice(-HISTORY_LIMIT),
      // Any new edit invalidates the redo branch - standard linear history.
      future: [],
      dirty: true,
    });
    scheduleSave();
  }

  return {
    dirName: null,
    project: null,
    past: [],
    future: [],
    dirty: false,
    saving: false,
    lastSavedAt: null,
    error: null,
    transactionDepth: 0,
    transactionBase: null,
    transactionLabel: "",

    load(dirName, project) {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      set({
        dirName,
        project,
        past: [],
        future: [],
        dirty: false,
        saving: false,
        lastSavedAt: project.meta.updatedAt,
        error: null,
        transactionDepth: 0,
        transactionBase: null,
      });
    },

    closeProject() {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      set({
        dirName: null,
        project: null,
        past: [],
        future: [],
        dirty: false,
        error: null,
      });
    },

    apply(label, updater, options) {
      const { project, transactionDepth } = get();
      if (!project) return;

      const next = updater(project);
      // Reference equality means the operation declined to change anything -
      // deleting the last scene, for example. Recording that as an undo entry
      // would give the user a no-op to step through.
      if (next === project) return;

      if (transactionDepth > 0) {
        // Inside a transaction the intermediate states are not history; only
        // the state at commit time is.
        set({ project: next, dirty: true });
        return;
      }

      commit(project, next, label, options?.coalesceKey);
    },

    transaction(label, body) {
      const { project, transactionDepth } = get();
      if (!project) return;

      if (transactionDepth === 0) {
        set({ transactionBase: project, transactionLabel: label });
      }
      set({ transactionDepth: get().transactionDepth + 1 });

      try {
        body();
      } finally {
        const depth = get().transactionDepth - 1;
        set({ transactionDepth: depth });

        if (depth === 0) {
          const base = get().transactionBase;
          const current = get().project;
          set({ transactionBase: null, transactionLabel: "" });

          if (base && current && base !== current) {
            // Push the single entry the whole transaction collapses into.
            set({
              past: [...get().past, { project: base, label, at: Date.now() }].slice(
                -HISTORY_LIMIT,
              ),
              future: [],
              dirty: true,
            });
            scheduleSave();
          }
        }
      }
    },

    undo() {
      const { past, project } = get();
      if (!past.length || !project) return null;

      const entry = past[past.length - 1];
      set({
        project: entry.project,
        past: past.slice(0, -1),
        future: [
          ...get().future,
          { project, label: entry.label, at: Date.now() },
        ].slice(-HISTORY_LIMIT),
        dirty: true,
      });
      scheduleSave();
      return entry.label;
    },

    redo() {
      const { future, project } = get();
      if (!future.length || !project) return null;

      const entry = future[future.length - 1];
      set({
        project: entry.project,
        future: future.slice(0, -1),
        past: [
          ...get().past,
          { project, label: entry.label, at: Date.now() },
        ].slice(-HISTORY_LIMIT),
        dirty: true,
      });
      scheduleSave();
      return entry.label;
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    async save() {
      const { dirName, project, saving } = get();
      if (!dirName || !project || saving) return;

      set({ saving: true });
      try {
        const saved = await bridge.project.save(dirName, project);
        // Only the timestamp is adopted from the response. Replacing the
        // whole model would discard anything the user typed during the
        // round-trip.
        set((state) => ({
          saving: false,
          dirty: false,
          lastSavedAt: saved.project.meta.updatedAt,
          error: null,
          project: state.project
            ? { ...state.project, meta: saved.project.meta }
            : state.project,
        }));
      } catch (error) {
        set({ saving: false, error: errorMessage(error) });
      }
    },

    /**
     * Take a project edited outside the app.
     *
     * Recorded as an ordinary history entry so an unexpected external change
     * is undoable, and marked clean because disk already holds this version.
     */
    adoptFromDisk(project) {
      const current = get().project;
      if (!current) return;
      if (JSON.stringify(current) === JSON.stringify(project)) return;

      set({
        project,
        past: [
          ...get().past,
          { project: current, label: "External edit", at: Date.now() },
        ].slice(-HISTORY_LIMIT),
        future: [],
        dirty: false,
        lastSavedAt: project.meta.updatedAt,
      });
    },

    setError(error) {
      set({ error });
    },
  };
});
