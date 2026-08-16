/**
 * The launcher - what Raw Motion shows with no project open.
 *
 * Treated as a designed screen rather than a file-open dialog. It is the
 * first thing a new user sees and the thing an existing user sees several
 * times a day, and an application that looks unfinished when it is empty
 * feels unfinished when it is full.
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle, FolderOpen, Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { COMPOSITION_PRESETS } from "@shared/project.js";
import { TEMPLATES } from "@shared/templates.js";
import { bridge, errorMessage, type ProjectSummary } from "@/lib/bridge";
import { BrandMark } from "@/components/ui/brand-mark";
import { SettingsModal } from "./SettingsModal";
import { cn } from "@/lib/utils";

export const Launcher: React.FC<{
  onOpened: (dirName: string, project: import("@shared/project.js").Project) => void;
  /** Open straight onto the create form - set when the editor's app menu
   *  chose "New project" so the user lands where they were heading. */
  initialCreating?: boolean;
}> = ({ onOpened, initialCreating = false }) => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(initialCreating);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refresh = () => {
    bridge.workspace
      .list()
      .then(setProjects)
      .catch((e) => {
        setProjects([]);
        setError(errorMessage(e));
      });
  };

  useEffect(refresh, []);

  const open = async (dirName: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.project.open(dirName);
      onOpened(result.dirName, result.project);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const create = async (
    templateId: string,
    name: string,
    composition: { width: number; height: number; fps: number },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
      const built = template.build();

      const result = await bridge.project.create({
        name,
        composition,
        scenes: built.scenes,
      });
      onOpened(result.dirName, result.project);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="rm-editor flex h-full flex-col overflow-hidden">
      {/* A single soft light behind the content, so the empty screen still
          has depth. Nothing else moves here - a launcher that animates on
          every open becomes tiresome by the tenth time. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 size-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.16 275 / 0.10) 0%, transparent 65%)",
        }}
      />

      <div className="rm-scroll relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-8 pb-16 pt-[13vh]">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-5 text-[var(--rm-text)]" />
            <span className="text-[13px] tracking-[0.02em] text-[var(--rm-text)]">
              Raw Motion
            </span>
          </div>

          <h1 className="mt-7 text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-[var(--rm-text)]">
            Create something extraordinary.
          </h1>
          <p className="mt-2.5 max-w-[440px] text-[14px] leading-[1.55] text-[var(--rm-text-dim)]">
            Motion design that lives as real code - previewed live, edited by
            hand or by Claude, and rendered frame-accurate.
          </p>

          {error ? (
            <div className="mt-6 flex items-start gap-2 rounded-[8px] bg-[color-mix(in_oklch,var(--rm-danger),transparent_88%)] px-3 py-2.5">
              <AlertTriangle className="mt-px size-4 shrink-0 text-[var(--rm-danger)]" />
              <p className="text-[12px] leading-[1.5] text-[var(--rm-danger)]">{error}</p>
            </div>
          ) : null}

          {creating ? (
            <NewProjectForm
              busy={busy}
              onCancel={() => setCreating(false)}
              onCreate={create}
            />
          ) : (
            <div className="mt-8 flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreating(true)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[7px] px-3.5 text-[13px] transition-colors duration-100",
                  "bg-[var(--rm-text)] text-[var(--rm-void)] hover:bg-white",
                  busy && "opacity-50",
                )}
              >
                <Plus className="size-4" />
                New project
              </button>
              <button
                type="button"
                onClick={() =>
                  void bridge.workspace.reveal().catch((e) => setError(errorMessage(e)))
                }
                className="flex h-9 items-center gap-2 rounded-[7px] bg-[var(--rm-chrome)] px-3.5 text-[13px] text-[var(--rm-text-dim)] transition-colors duration-100 hover:text-[var(--rm-text)]"
              >
                <FolderOpen className="size-4" />
                Open workspace folder
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="flex h-9 items-center gap-2 rounded-[7px] bg-[var(--rm-chrome)] px-3.5 text-[13px] text-[var(--rm-text-dim)] transition-colors duration-100 hover:text-[var(--rm-text)]"
              >
                <Settings className="size-4" />
                Settings
              </button>
            </div>
          )}

          <section className="mt-12">
            <h2 className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
              Recent
            </h2>

            {projects === null ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-[var(--rm-text-faint)]">
                <Loader2 className="size-3.5 animate-spin" />
                Reading workspace
              </div>
            ) : projects.length === 0 ? (
              <p className="py-4 text-[12px] text-[var(--rm-text-faint)]">
                No projects yet. Create one to begin.
              </p>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.dirName}
                    project={project}
                    busy={busy}
                    onOpen={() => void open(project.dirName)}
                    onDeleted={() => void refresh()}
                    onError={setError}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        canChangeWorkspace
        onWorkspaceChanged={refresh}
      />
    </div>
  );
};

/**
 * One recent-project row. Delete is a two-step control - the trash icon
 * arms, a second click confirms - and the folder goes to the OS trash, so a
 * slip is recoverable from the bin rather than gone.
 */
const ProjectRow: React.FC<{
  project: ProjectSummary;
  busy: boolean;
  onOpen: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}> = ({ project, busy, onOpen, onDeleted, onError }) => {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await bridge.workspace.delete(project.dirName);
      onDeleted();
    } catch (e) {
      onError(errorMessage(e));
      setDeleting(false);
      setArmed(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!busy && !deleting) onOpen();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy && !deleting) onOpen();
      }}
      onMouseLeave={() => setArmed(false)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-[8px] bg-[var(--rm-chrome)] px-3 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--rm-chrome-high)]",
        (busy || deleting) && "pointer-events-none opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[var(--rm-text)]">
          {project.name}
          {project.broken ? (
            <span className="ml-2 text-[11px] text-[var(--rm-danger)]">unreadable</span>
          ) : null}
        </p>
        <p className="rm-num mt-0.5 text-[11px] text-[var(--rm-text-faint)]">
          {project.broken
            ? project.dirName
            : `${project.width}x${project.height} · ${project.fps}fps · ${project.sceneCount} ${project.sceneCount === 1 ? "scene" : "scenes"}`}
        </p>
      </div>
      <span className="rm-num shrink-0 text-[11px] text-[var(--rm-text-faint)]">
        {relativeTime(project.updatedAt)}
      </span>
      {armed ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void remove();
          }}
          className="shrink-0 rounded-[6px] bg-[var(--rm-danger)] px-2 py-1 text-[11px] font-medium text-white"
        >
          {deleting ? "Deleting…" : "Delete?"}
        </button>
      ) : (
        <button
          type="button"
          title="Move project to trash"
          onClick={(e) => {
            e.stopPropagation();
            setArmed(true);
          }}
          className="shrink-0 rounded-[6px] p-1.5 text-[var(--rm-text-faint)] opacity-0 transition-opacity duration-100 hover:bg-[var(--rm-chrome-low)] hover:text-[var(--rm-danger)] group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
};

const NewProjectForm: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onCreate: (
    templateId: string,
    name: string,
    composition: { width: number; height: number; fps: number },
  ) => void;
}> = ({ busy, onCancel, onCreate }) => {
  const [name, setName] = useState("Untitled");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [presetId, setPresetId] = useState<string | null>(COMPOSITION_PRESETS[0].id);
  // The presets are conveniences: clicking one fills these fields, and the
  // fields stay editable so any resolution or frame rate - 120fps included -
  // is one keystroke away rather than a missing preset.
  const [width, setWidth] = useState(COMPOSITION_PRESETS[0].width);
  const [height, setHeight] = useState(COMPOSITION_PRESETS[0].height);
  const [fps, setFps] = useState(COMPOSITION_PRESETS[0].fps);

  const applyPreset = (preset: (typeof COMPOSITION_PRESETS)[number]) => {
    setPresetId(preset.id);
    setWidth(preset.width);
    setHeight(preset.height);
    setFps(preset.fps);
  };

  const clampDim = (n: number) => Math.max(16, Math.min(7680, Math.round(n) || 16));
  const clampFps = (n: number) => Math.max(1, Math.min(240, Math.round(n) || 30));

  return (
    <form
      className="mt-8 rounded-[14px] bg-[var(--rm-chrome)] p-4 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.5)]"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(templateId, name.trim() || "Untitled", {
          width: clampDim(width),
          height: clampDim(height),
          fps: clampFps(fps),
        });
      }}
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
          Name
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="mt-1.5 h-9 w-full rounded-[6px] bg-[var(--rm-chrome-high)] px-2.5 text-[13px] text-[var(--rm-text)] outline-none focus:ring-1 focus:ring-[var(--rm-accent)]"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setTemplateId(template.id)}
            className={cn(
              "rounded-[8px] p-3 text-left transition-colors duration-100",
              templateId === template.id
                ? "bg-[var(--rm-accent-dim)]"
                : "bg-[var(--rm-chrome-high)] hover:bg-[color-mix(in_oklch,var(--rm-chrome-high),white_4%)]",
            )}
          >
            <p className="text-[12px] text-[var(--rm-text)]">{template.label}</p>
            <p className="mt-1 text-[10px] leading-[1.45] text-[var(--rm-text-faint)]">
              {template.description}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {COMPOSITION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors duration-100",
              presetId === preset.id
                ? "bg-[var(--rm-accent-dim)] text-[var(--rm-accent)]"
                : "bg-[var(--rm-chrome-high)] text-[var(--rm-text-dim)] hover:text-[var(--rm-text)]",
            )}
          >
            {preset.hint}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            { label: "Width", value: width, set: setWidth },
            { label: "Height", value: height, set: setHeight },
            { label: "FPS", value: fps, set: setFps },
          ] as const
        ).map((field) => (
          <label key={field.label} className="block">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
              {field.label}
            </span>
            <input
              type="number"
              value={field.value}
              onChange={(e) => {
                field.set(Number(e.target.value));
                setPresetId(null);
              }}
              className="rm-num mt-1 h-8 w-full rounded-[6px] bg-[var(--rm-chrome-high)] px-2 text-[12px] text-[var(--rm-text)] outline-none focus:ring-1 focus:ring-[var(--rm-accent)]"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "flex h-8 items-center gap-2 rounded-[6px] bg-[var(--rm-text)] px-3 text-[12px] text-[var(--rm-void)]",
            busy && "opacity-50",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-[6px] px-3 text-[12px] text-[var(--rm-text-dim)] hover:text-[var(--rm-text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";

  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
