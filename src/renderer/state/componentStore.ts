/**
 * Custom components of the open project.
 *
 * A separate store, like `renderStore`, because this state is a *mirror* of
 * the main process's compilation of `components/` - it is not part of the
 * document, is not undoable, and must never dirty the project.
 *
 * Two paths feed it: an explicit `load` when a project opens, and the
 * `components:changed` push whenever anything - the in-app source editor,
 * Claude, VS Code - touches the directory. Both replace the whole list;
 * reconciliation lives in the main process.
 */

import { create } from "zustand";
import { bridge, type CustomComponentEntry } from "@/lib/bridge";

interface ComponentState {
  components: CustomComponentEntry[];
  loading: boolean;
  load(dirName: string): Promise<void>;
  setAll(components: CustomComponentEntry[]): void;
  clear(): void;
  /** Subscribe to main-process pushes. Returns the unsubscribe. */
  attach(): () => void;
}

export const useComponentStore = create<ComponentState>((set) => ({
  components: [],
  loading: false,

  async load(dirName) {
    set({ loading: true });
    try {
      const components = await bridge.components.list(dirName);
      set({ components, loading: false });
    } catch {
      // A project without a readable components directory is still a
      // project; the editor simply has no custom entries.
      set({ components: [], loading: false });
    }
  },

  setAll(components) {
    set({ components });
  },

  clear() {
    set({ components: [] });
  },

  attach() {
    return bridge.components.onChanged(({ components }) => {
      set({ components });
    });
  },
}));

/** Entries healthy enough to hand to the composition. */
export function renderableComponents(
  components: CustomComponentEntry[],
): CustomComponentEntry[] {
  // Entries with compile errors still travel: the runtime renders their
  // error card in place, which beats a layer silently vanishing.
  return components.filter((c) => c.code || c.error);
}
