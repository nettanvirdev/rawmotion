/**
 * Render state.
 *
 * A read-mostly mirror of the queue that actually lives in the main process.
 * The renderer never owns job state - it cannot, since rendering outlives any
 * particular component - so this store only reflects what arrives on the
 * progress channel and exposes the two commands that mutate it.
 */

import { create } from "zustand";
import { bridge, errorMessage, type RenderJob } from "@/lib/bridge";

export interface RenderState {
  jobs: RenderJob[];
  error: string | null;

  /** Subscribe to main-process progress. Returns an unsubscribe function. */
  attach(): () => void;
  refresh(): Promise<void>;
  cancel(jobId: string): Promise<void>;
  reveal(dirName: string, outputRelative: string): Promise<void>;
}

export const useRenderStore = create<RenderState>((set) => ({
  jobs: [],
  error: null,

  attach() {
    const unsubscribe = bridge.render.onProgress((jobs) => set({ jobs }));
    // Pull once on attach: jobs may already be running from before this
    // component mounted, and the progress event only fires on change.
    void bridge.render
      .list()
      .then((jobs) => set({ jobs }))
      .catch((error) => set({ error: errorMessage(error) }));
    return unsubscribe;
  },

  async refresh() {
    try {
      set({ jobs: await bridge.render.list(), error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  async cancel(jobId) {
    try {
      await bridge.render.cancel(jobId);
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  async reveal(dirName, outputRelative) {
    try {
      await bridge.render.reveal(dirName, outputRelative);
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));

/** Jobs still doing work, in queue order. */
export function activeJobs(jobs: RenderJob[]): RenderJob[] {
  return jobs.filter(
    (job) => job.status === "queued" || job.status === "bundling" || job.status === "rendering",
  );
}
