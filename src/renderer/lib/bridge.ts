/**
 * Typed access to the preload bridge.
 *
 * Two jobs:
 *
 * 1. **Types.** `window.rawmotion` is created by a CommonJS preload the
 *    compiler never sees, so without this module every IPC call in the app
 *    would be `any`.
 *
 * 2. **Unwrapping.** Every handler resolves with `{ ok, value } | { ok,
 *    error }`. Checking that at 40 call sites would be noise, so `unwrap`
 *    turns a failed result into a thrown `BridgeError` and callers use
 *    ordinary try/catch. The envelope still exists on the wire - this only
 *    changes where it is handled.
 */

import type { Project } from "@shared/project.js";

export interface AppInfo {
  name: string;
  appVersion: string;
  platform: string;
  arch: string;
  isDev: boolean;
  workspace: string;
  versions: { electron: string; chrome: string; node: string };
}

export interface ProjectSummary {
  dirName: string;
  name: string;
  updatedAt: string;
  width: number;
  height: number;
  fps: number;
  sceneCount: number;
  broken?: boolean;
}

export interface AssetRow {
  kind: "image" | "video" | "audio" | "font";
  name: string;
  src: string;
  bytes: number;
  origin: "user" | "generated";
}

export interface FileRow {
  path: string;
  name: string;
  kind: "file" | "directory";
  size: number;
}

export type JobStatus =
  | "queued"
  | "bundling"
  | "rendering"
  | "done"
  | "failed"
  | "cancelled";

export interface RenderJob {
  id: string;
  label: string;
  projectDirName: string;
  status: JobStatus;
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  outputPath: string;
  outputRelative: string;
  format: "mp4" | "webm";
  width: number;
  height: number;
  fps: number;
  error: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type GpuMode = "auto" | "on" | "off";
export type RenderQuality = "draft" | "standard" | "high";

export interface AppSettings {
  workspace: string | null;
  render: { gpu: GpuMode; quality: RenderQuality; concurrency: number | null };
}

export interface SettingsPayload {
  settings: AppSettings;
  paths: { settingsFile: string; workspace: string; userData: string };
  gpu: { available: boolean; description: string; devices: string[] };
  cpu: { model: string; cores: number; memoryGb: number };
}

type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string; detail?: string };

/** Thrown by `unwrap` when a main-process handler reports failure. */
export class BridgeError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "BridgeError";
    this.detail = detail;
  }
}

interface RawBridge {
  window: {
    minimize(): void;
    maximize(): void;
    close(): void;
    beginDrag(): void;
    onState(cb: (state: string) => void): () => void;
  };
  app: {
    getInfo(): Promise<IpcResult<AppInfo>>;
    openExternal(url: string): Promise<IpcResult<boolean>>;
  };
  workspace: {
    list(): Promise<IpcResult<ProjectSummary[]>>;
    reveal(dirName?: string): Promise<IpcResult<boolean>>;
    delete(dirName: string): Promise<IpcResult<boolean>>;
  };
  settings: {
    get(): Promise<IpcResult<SettingsPayload>>;
    update(patch: {
      workspace?: string | null;
      render?: Partial<AppSettings["render"]>;
    }): Promise<IpcResult<SettingsPayload>>;
    chooseWorkspace(): Promise<IpcResult<SettingsPayload & { canceled: boolean }>>;
  };
  project: {
    create(options: {
      name: string;
      composition?: Partial<Project["composition"]>;
      scenes?: Project["scenes"];
    }): Promise<IpcResult<{ dirName: string; project: Project }>>;
    open(dirName: string): Promise<IpcResult<{ dirName: string; project: Project }>>;
    save(dirName: string, project: Project): Promise<IpcResult<{ dirName: string; project: Project }>>;
    close(): Promise<IpcResult<boolean>>;
    assetUrl(dirName: string, src: string): Promise<IpcResult<{ url: string }>>;
    onChangedOnDisk(
      cb: (payload: { dirName: string; project?: Project; error?: string }) => void,
    ): () => void;
  };
  assets: {
    list(dirName: string): Promise<IpcResult<AssetRow[]>>;
    import(
      dirName: string,
      paths?: string[],
    ): Promise<IpcResult<{ imported: AssetRow[]; errors?: string[]; canceled: boolean }>>;
  };
  files: {
    list(dirName: string, path?: string): Promise<IpcResult<FileRow[]>>;
    read(dirName: string, path: string): Promise<IpcResult<{ path: string; content: string }>>;
    write(dirName: string, path: string, content: string): Promise<IpcResult<{ path: string; bytes: number }>>;
  };
  render: {
    enqueue(options: {
      dirName: string;
      project: Project;
      label?: string;
      format?: "mp4" | "webm";
      width?: number;
      height?: number;
      scale?: number;
      quality?: RenderQuality;
    }): Promise<IpcResult<RenderJob>>;
    cancel(jobId: string): Promise<IpcResult<boolean>>;
    list(): Promise<IpcResult<RenderJob[]>>;
    reveal(dirName: string, outputRelative: string): Promise<IpcResult<boolean>>;
    onProgress(cb: (jobs: RenderJob[]) => void): () => void;
  };
}

declare global {
  interface Window {
    rawmotion?: RawBridge;
  }
}

/**
 * The bridge, or a thrown error.
 *
 * Raw Motion has no browser build - every feature needs the main process -
 * so a missing bridge is a broken install rather than a mode to degrade
 * into, and failing loudly beats a UI that silently does nothing.
 */
function requireBridge(): RawBridge {
  const bridge = window.rawmotion;
  if (!bridge) {
    throw new BridgeError(
      "Raw Motion's desktop bridge is unavailable. The preload script failed to load.",
    );
  }
  return bridge;
}

export const isBridgeAvailable = (): boolean => Boolean(window.rawmotion);

/** Await an IPC call and throw on a failed envelope. */
export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new BridgeError(result.error, result.detail);
  return result.value;
}

/* ------------------------------------------------------------------ *
 * Typed facade
 * ------------------------------------------------------------------ */

export const bridge = {
  get raw() {
    return requireBridge();
  },

  window: {
    minimize: () => requireBridge().window.minimize(),
    maximize: () => requireBridge().window.maximize(),
    close: () => requireBridge().window.close(),
    beginDrag: () => requireBridge().window.beginDrag(),
    onState: (cb: (state: string) => void) => requireBridge().window.onState(cb),
  },

  app: {
    getInfo: () => unwrap(requireBridge().app.getInfo()),
    openExternal: (url: string) => unwrap(requireBridge().app.openExternal(url)),
  },

  workspace: {
    list: () => unwrap(requireBridge().workspace.list()),
    reveal: (dirName?: string) => unwrap(requireBridge().workspace.reveal(dirName)),
    delete: (dirName: string) => unwrap(requireBridge().workspace.delete(dirName)),
  },

  settings: {
    get: () => unwrap(requireBridge().settings.get()),
    update: (patch: Parameters<RawBridge["settings"]["update"]>[0]) =>
      unwrap(requireBridge().settings.update(patch)),
    chooseWorkspace: () => unwrap(requireBridge().settings.chooseWorkspace()),
  },

  project: {
    create: (options: Parameters<RawBridge["project"]["create"]>[0]) =>
      unwrap(requireBridge().project.create(options)),
    open: (dirName: string) => unwrap(requireBridge().project.open(dirName)),
    save: (dirName: string, project: Project) =>
      unwrap(requireBridge().project.save(dirName, project)),
    close: () => unwrap(requireBridge().project.close()),
    assetUrl: (dirName: string, src: string) =>
      unwrap(requireBridge().project.assetUrl(dirName, src)),
    onChangedOnDisk: (
      cb: (payload: { dirName: string; project?: Project; error?: string }) => void,
    ) => requireBridge().project.onChangedOnDisk(cb),
  },

  assets: {
    list: (dirName: string) => unwrap(requireBridge().assets.list(dirName)),
    import: (dirName: string, paths?: string[]) =>
      unwrap(requireBridge().assets.import(dirName, paths)),
  },

  files: {
    list: (dirName: string, path?: string) => unwrap(requireBridge().files.list(dirName, path)),
    read: (dirName: string, path: string) => unwrap(requireBridge().files.read(dirName, path)),
    write: (dirName: string, path: string, content: string) =>
      unwrap(requireBridge().files.write(dirName, path, content)),
  },

  render: {
    enqueue: (options: Parameters<RawBridge["render"]["enqueue"]>[0]) =>
      unwrap(requireBridge().render.enqueue(options)),
    cancel: (jobId: string) => unwrap(requireBridge().render.cancel(jobId)),
    list: () => unwrap(requireBridge().render.list()),
    reveal: (dirName: string, outputRelative: string) =>
      unwrap(requireBridge().render.reveal(dirName, outputRelative)),
    onProgress: (cb: (jobs: RenderJob[]) => void) => requireBridge().render.onProgress(cb),
  },
};

/** Human-readable message for anything thrown by the bridge. */
export function errorMessage(error: unknown): string {
  if (error instanceof BridgeError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
