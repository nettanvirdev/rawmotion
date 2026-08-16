/**
 * The left panel: scenes, assets, components and project files.
 *
 * A rail of icons plus one open panel, rather than four stacked accordions.
 * Accordions in a fixed-height column force everything to fight for the same
 * vertical space; a rail gives whichever list the user is working in the
 * whole column.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Blocks,
  FileCode2,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Music,
  Plus,
  RefreshCw,
  Video,
} from "lucide-react";
import type { Project } from "@shared/project.js";
import { formatDuration, sceneTimings } from "@shared/project.js";
import { COMPONENT_REGISTRY } from "@motion/registry";
import { bridge, errorMessage, type AssetRow, type FileRow } from "@/lib/bridge";
import { useEditorStore, type LeftPanel as PanelId } from "@/state/editorStore";
import { useProjectStore } from "@/state/projectStore";
import { recordUserOperation } from "@/state/aiStore";
import * as ops from "@/state/operations";
import { EmptyState, IconButton } from "./controls";
import { cn } from "@/lib/utils";

const TABS: { id: PanelId; icon: React.FC<{ className?: string }>; label: string }[] = [
  { id: "scenes", icon: Layers, label: "Scenes" },
  { id: "assets", icon: ImageIcon, label: "Assets" },
  { id: "components", icon: Blocks, label: "Components" },
  { id: "files", icon: FileCode2, label: "Files" },
];

export const LeftPanel: React.FC<{ project: Project; dirName: string }> = ({
  project,
  dirName,
}) => {
  const panel = useEditorStore((s) => s.leftPanel);
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel);

  return (
    <div className="flex h-full min-h-0">
      <nav className="rm-hairline-r flex w-10 shrink-0 flex-col items-center gap-1 py-2">
        {TABS.map((tab) => (
          <IconButton
            key={tab.id}
            title={tab.label}
            active={panel === tab.id}
            onClick={() => setLeftPanel(tab.id)}
          >
            <tab.icon className="size-4" />
          </IconButton>
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {panel === "scenes" ? <ScenesPanel project={project} /> : null}
        {panel === "assets" ? <AssetsPanel project={project} dirName={dirName} /> : null}
        {panel === "components" ? <ComponentsPanel project={project} /> : null}
        {panel === "files" ? <FilesPanel dirName={dirName} /> : null}
      </div>
    </div>
  );
};

const PanelHeader: React.FC<{ title: string; actions?: React.ReactNode }> = ({
  title,
  actions,
}) => (
  <header className="rm-hairline-b flex h-8 shrink-0 items-center gap-1 px-2">
    <h2 className="flex-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
      {title}
    </h2>
    {actions}
  </header>
);

/* ------------------------------------------------------------------ *
 * Scenes
 * ------------------------------------------------------------------ */

const ScenesPanel: React.FC<{ project: Project }> = ({ project }) => {
  const apply = useProjectStore((s) => s.apply);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);

  const timings = sceneTimings(project);
  const { fps } = project.composition;

  return (
    <>
      <PanelHeader
        title="Scenes"
        actions={
          <IconButton
            title="Add scene"
            onClick={() => {
              apply("Add scene", (p) => ops.addScene(p));
              recordUserOperation("Added a scene");
            }}
          >
            <Plus className="size-3.5" />
          </IconButton>
        }
      />

      <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {project.scenes.map((scene, i) => {
          const active = selection.kind === "scene" && selection.id === scene.id;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                select({ kind: "scene", id: scene.id });
                setPlayhead(timings[i].from);
              }}
              className={cn(
                "group mb-0.5 flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left transition-colors duration-100",
                active
                  ? "bg-[var(--rm-accent-dim)]"
                  : "hover:bg-[var(--rm-chrome-high)]",
              )}
            >
              <span className="rm-num w-4 shrink-0 text-[10px] text-[var(--rm-text-faint)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--rm-text)]">
                {scene.name}
              </span>
              <span className="rm-num shrink-0 text-[10px] text-[var(--rm-text-faint)]">
                {formatDuration(scene.durationInFrames, fps)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

const ASSET_ICONS = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  font: FileCode2,
} as const;

const AssetsPanel: React.FC<{ project: Project; dirName: string }> = ({
  project,
  dirName,
}) => {
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useProjectStore((s) => s.apply);
  const transaction = useProjectStore((s) => s.transaction);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const playhead = useEditorStore((s) => s.playhead);

  const refresh = useCallback(async () => {
    try {
      setRows(await bridge.assets.list(dirName));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [dirName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importAssets = async () => {
    setBusy(true);
    try {
      const result = await bridge.assets.import(dirName);
      if (!result.canceled && result.imported.length) {
        apply("Import assets", (p) => ops.registerAssets(p, result.imported));
        recordUserOperation(
          `Imported ${result.imported.length} asset${result.imported.length === 1 ? "" : "s"}`,
        );
      }
      if (result.errors?.length) setError(result.errors.join("\n"));
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Drop an asset into the composition.
   *
   * Audio becomes a project-level clip at the playhead; visual media becomes
   * a layer in the scene under the playhead. Both are one transaction so a
   * single undo removes the whole insertion.
   */
  const addToComposition = (asset: AssetRow) => {
    const timings = sceneTimings(project);
    const index = Math.max(
      0,
      timings.findLastIndex((t) => playhead >= t.from),
    );
    const scene = project.scenes[index];
    if (!scene) return;

    if (asset.kind === "audio") {
      transaction(`Add ${asset.name}`, () => {
        apply("Add audio", (p) =>
          ops.addAudio(p, {
            kind: "music",
            name: asset.name,
            src: asset.src,
            start: playhead,
            duration: 150,
          }).project,
        );
      });
      recordUserOperation(`Added audio "${asset.name}"`);
      return;
    }

    if (asset.kind === "font") return;

    let newId = "";
    transaction(`Add ${asset.name}`, () => {
      apply("Add layer", (p) => {
        const result = ops.addLayer(p, scene.id, {
          type: asset.kind === "video" ? "video" : "image",
          name: asset.name,
          props: { src: asset.src },
          animation: { enter: { preset: "scaleIn", durationInFrames: 22, delay: 0 } },
        });
        newId = result.layerId;
        return result.project;
      });
    });
    if (newId) selectLayer(newId);
    recordUserOperation(`Added "${asset.name}" to ${scene.name}`);
  };

  return (
    <>
      <PanelHeader
        title="Assets"
        actions={
          <>
            <IconButton title="Refresh" onClick={() => void refresh()}>
              <RefreshCw className="size-3.5" />
            </IconButton>
            <IconButton title="Import media" onClick={() => void importAssets()} disabled={busy}>
              <Plus className="size-3.5" />
            </IconButton>
          </>
        }
      />

      {error ? <PanelError message={error} onDismiss={() => setError(null)} /> : null}

      <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-6" strokeWidth={1.2} />}
            title="No assets yet"
            hint="Import media, or drop files into the project's assets folder and refresh."
          />
        ) : (
          rows.map((asset) => {
            const Icon = ASSET_ICONS[asset.kind];
            return (
              <button
                key={asset.src}
                type="button"
                onDoubleClick={() => addToComposition(asset)}
                title={`${asset.src}\nDouble-click to add to the composition`}
                className="group mb-0.5 flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-[var(--rm-chrome-high)]"
              >
                <Icon className="size-3.5 shrink-0 text-[var(--rm-text-faint)]" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--rm-text-dim)] group-hover:text-[var(--rm-text)]">
                  {asset.name}
                </span>
                {asset.origin === "generated" ? (
                  <span className="shrink-0 rounded-full bg-[var(--rm-chrome-high)] px-1.5 text-[9px] text-[var(--rm-text-faint)]">
                    gen
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

const ComponentsPanel: React.FC<{ project: Project }> = ({ project }) => {
  const apply = useProjectStore((s) => s.apply);
  const transaction = useProjectStore((s) => s.transaction);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const playhead = useEditorStore((s) => s.playhead);

  const addComponent = (name: string) => {
    const timings = sceneTimings(project);
    const index = Math.max(0, timings.findLastIndex((t) => playhead >= t.from));
    const scene = project.scenes[index];
    if (!scene) return;

    let newId = "";
    transaction(`Add ${name}`, () => {
      apply("Add component", (p) => {
        const result = ops.addLayer(p, scene.id, {
          type: "component",
          name,
          props: { component: name, props: {} },
          animation: { enter: { preset: "depthIn", durationInFrames: 26, delay: 0 } },
        });
        newId = result.layerId;
        return result.project;
      });
    });
    if (newId) selectLayer(newId);
    recordUserOperation(`Added ${name} to ${scene.name}`);
  };

  return (
    <>
      <PanelHeader title="Components" />
      <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {COMPONENT_REGISTRY.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => addComponent(entry.name)}
            title={entry.description}
            className="mb-1 w-full rounded-[6px] px-2 py-2 text-left transition-colors duration-100 hover:bg-[var(--rm-chrome-high)]"
          >
            <p className="text-[12px] text-[var(--rm-text)]">{entry.label}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-[1.45] text-[var(--rm-text-faint)]">
              {entry.description}
            </p>
          </button>
        ))}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Files
 * ------------------------------------------------------------------ */

/**
 * The project directory, browsable.
 *
 * Read-only for now, and honestly labelled as such. Its purpose is to make
 * the project legible - to show that a Raw Motion project is a real folder
 * of real files rather than an opaque document - which is the premise the
 * whole agent workflow rests on.
 */
const FilesPanel: React.FC<{ dirName: string }> = ({ dirName }) => {
  const [path, setPath] = useState(".");
  const [rows, setRows] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bridge.files
      .list(dirName, path)
      .then((result) => {
        if (!cancelled) {
          setRows(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [dirName, path]);

  const parent = path === "." ? null : path.split("/").slice(0, -1).join("/") || ".";

  return (
    <>
      <PanelHeader
        title="Files"
        actions={
          <IconButton title="Reveal in file manager" onClick={() => void bridge.workspace.reveal(dirName)}>
            <FolderOpen className="size-3.5" />
          </IconButton>
        }
      />

      <div className="rm-hairline-b px-2 py-1">
        <span className="rm-num text-[10px] text-[var(--rm-text-faint)]">
          {path === "." ? dirName : `${dirName}/${path}`}
        </span>
      </div>

      {error ? <PanelError message={error} onDismiss={() => setError(null)} /> : null}

      <div className="rm-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {parent !== null ? (
          <button
            type="button"
            onClick={() => setPath(parent)}
            className="mb-0.5 flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[12px] text-[var(--rm-text-dim)] hover:bg-[var(--rm-chrome-high)]"
          >
            ..
          </button>
        ) : null}

        {rows.map((row) => (
          <button
            key={row.path}
            type="button"
            onClick={() => row.kind === "directory" && setPath(row.path)}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left",
              row.kind === "directory"
                ? "hover:bg-[var(--rm-chrome-high)]"
                : "cursor-default",
            )}
          >
            {row.kind === "directory" ? (
              <FolderOpen className="size-3.5 shrink-0 text-[var(--rm-text-faint)]" />
            ) : (
              <Film className="size-3.5 shrink-0 text-[var(--rm-text-faint)] opacity-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--rm-text-dim)]">
              {row.name}
            </span>
            {row.kind === "file" ? (
              <span className="rm-num shrink-0 text-[10px] text-[var(--rm-text-faint)]">
                {formatBytes(row.size)}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PanelError: React.FC<{ message: string; onDismiss: () => void }> = ({
  message,
  onDismiss,
}) => (
  <button
    type="button"
    onClick={onDismiss}
    title="Dismiss"
    className="block w-full whitespace-pre-wrap px-2 py-1.5 text-left text-[10px] leading-[1.5] text-[var(--rm-danger)]"
  >
    {message}
  </button>
);
