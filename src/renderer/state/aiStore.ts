/**
 * AI operation history.
 *
 * A log of significant changes - both the user's and, once the MCP server is
 * wired in, an agent's. It is not the undo stack: undo is a stack of document
 * states, whereas this is an append-only record of *what happened*, which is
 * what lets a user scan "what did Claude just do to my project" without
 * stepping backwards through it.
 *
 * The two are linked by intent rather than by data: an entry recorded around
 * a `projectStore.transaction` corresponds to exactly one undo step, so
 * "revert this operation" is implementable as a single undo once the entry
 * carries the transaction's position. That mapping is not built yet, and the
 * `revertible` flag marks the entries eligible for it.
 */

import { create } from "zustand";
import { createId } from "@shared/ids.js";

export type OperationSource = "user" | "agent" | "system";

export interface OperationEntry {
  id: string;
  at: string;
  source: OperationSource;
  label: string;
  detail?: string;
  revertible: boolean;
}

const HISTORY_LIMIT = 300;

export interface AiState {
  operations: OperationEntry[];
  record(entry: Omit<OperationEntry, "id" | "at">): void;
  clear(): void;
}

export const useAiStore = create<AiState>((set) => ({
  operations: [],

  record(entry) {
    set((state) => ({
      operations: [
        { id: createId("op"), at: new Date().toISOString(), ...entry },
        ...state.operations,
      ].slice(0, HISTORY_LIMIT),
    }));
  },

  clear: () => set({ operations: [] }),
}));

/** Convenience for the many call sites that only log a user action. */
export function recordUserOperation(label: string, detail?: string) {
  useAiStore.getState().record({ source: "user", label, detail, revertible: true });
}
