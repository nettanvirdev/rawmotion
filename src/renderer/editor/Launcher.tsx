/**
 * The launcher - what Raw Motion shows with no project open.
 *
 * Treated as a designed screen rather than a file-open dialog. It is the
 * first thing a new user sees and the thing an existing user sees several
 * times a day, and an application that looks unfinished when it is empty
 * feels unfinished when it is full.
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle, FolderOpen, Loader2, Plus } from "lucide-react";
import { COMPOSITION_PRESETS } from "@shared/project.js";
import { TEMPLATES } from "@shared/templates.js";
import { bridge, errorMessage, type ProjectSummary } from "@/lib/bridge";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

export const Launcher: React.FC<{
  onOpened: (dirName: string, project: import("@shared/project.js").Project) => void;
}> = ({ onOpened }) => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    bridge.workspace
      .list()
      .then(setProjects)
      .catch((e) => {
        setProjects([]);
        setError(errorMessage(e));
      });
  }, []);

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

  const create = async (templateId: string, name: string, presetId: string) => {
    setBusy(true);
    setError(null);
    try {
      const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
      const preset = COMPOSITION_PRESETS.find((p) => p.id === presetId);
      const built = template.build();

      const result = await bridge.project.create({
        name,
        composition: preset
          ? { width: preset.width, height: preset.height, fps: preset.fps }
          : built.composition,
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
                onClick={() => void bridge.workspace.reveal()}
                className="flex h-9 items-center gap-2 rounded-[7px] bg-[var(--rm-chrome)] px-3.5 text-[13px] text-[var(--rm-text-dim)] transition-colors duration-100 hover:text-[var(--rm-text)]"
              >
                <FolderOpen className="size-4" />
                Open workspace folder
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
                  <button
                    key={project.dirName}
                    type="button"
                    disabled={busy}
                    onClick={() => void open(project.dirName)}
                    className="group flex w-full items-center gap-3 rounded-[8px] bg-[var(--rm-chrome)] px-3 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--rm-chrome-high)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-[var(--rm-text)]">
                        {project.name}
                        {project.broken ? (
                          <span className="ml-2 text-[11px] text-[var(--rm-danger)]">
                            unreadable
                          </span>
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
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const NewProjectForm: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onCreate: (templateId: string, name: string, presetId: string) => void;
}> = ({ busy, onCancel, onCreate }) => {
  const [name, setName] = useState("Untitled");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [presetId, setPresetId] = useState(COMPOSITION_PRESETS[0].id);

  return (
    <form
      className="mt-8 rounded-[10px] bg-[var(--rm-chrome)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(templateId, name.trim() || "Untitled", presetId);
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
                ? "bg-[var(--rm-accent-dim)] ring-1 ring-[var(--rm-accent)]"
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
            onClick={() => setPresetId(preset.id)}
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
