/**
 * The custom component source editor.
 *
 * A project's components are ordinary TSX files, and this modal is an honest
 * editor for them: a file list, a monospaced source pane, and the compiler's
 * verdict, updated on every save. It does not try to be an IDE - anyone who
 * wants IntelliSense opens the file in their own editor and the watcher hot
 * reloads the preview exactly the same way.
 *
 * Saving goes through `components:save`, which compiles in the same
 * round-trip; errors land beside the source immediately, and a successful
 * save is already live in the preview by the time the status flips to
 * "Compiled".
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Plus, Trash2, X } from "lucide-react";
import { componentTemplate, safeName } from "@shared/component-manifest.js";
import { bridge, errorMessage } from "@/lib/bridge";
import { useComponentStore } from "@/state/componentStore";
import { useEditorStore } from "@/state/editorStore";
import { recordUserOperation } from "@/state/aiStore";
import { IconButton } from "./controls";
import { cn } from "@/lib/utils";

/** "components/GlassCard.tsx" -> "GlassCard.tsx" */
const baseName = (file: string) => file.replace(/^components\//, "");

export const ComponentEditor: React.FC<{ dirName: string }> = ({ dirName }) => {
  const open = useEditorStore((s) => s.componentEditorOpen);
  const requestedFile = useEditorStore((s) => s.componentEditorFile);
  const close = useEditorStore((s) => s.closeComponentEditor);
  const components = useComponentStore((s) => s.components);

  const [file, setFile] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const entry = useMemo(
    () => components.find((c) => c.file === file) ?? null,
    [components, file],
  );

  const loadFile = useCallback(
    async (target: string) => {
      try {
        const result = await bridge.components.read(dirName, baseName(target));
        setFile(target);
        setSource(result.content);
        setDirty(false);
        setStatus({ kind: "idle" });
      } catch (e) {
        setStatus({ kind: "error", message: errorMessage(e) });
      }
    },
    [dirName],
  );

  // Opening the modal loads the requested file, or the first one.
  useEffect(() => {
    if (!open) return;
    const target =
      requestedFile ?? components[0]?.file ?? null;
    if (target) void loadFile(target);
    else {
      setFile(null);
      setSource("");
      setDirty(false);
    }
    // Deliberately not keyed on `components`: a hot-reload push must not
    // yank the file selection out from under a typing user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestedFile, loadFile]);

  const save = useCallback(async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const saved = await bridge.components.save(dirName, baseName(file), source);
      await useComponentStore.getState().load(dirName);
      setDirty(false);
      setStatus(
        saved.error ? { kind: "error", message: saved.error } : { kind: "saved" },
      );
      recordUserOperation(`Edited component ${saved.name}`);
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [file, busy, dirName, source]);

  const create = async () => {
    const taken = new Set(components.map((c) => c.file));
    let base = "MyComponent";
    let n = 1;
    while (taken.has(`components/${base}.tsx`)) base = `MyComponent${(n += 1)}`;
    try {
      await bridge.components.save(dirName, `${base}.tsx`, componentTemplate(base));
      await useComponentStore.getState().load(dirName);
      await loadFile(`components/${base}.tsx`);
      recordUserOperation(`Created component ${base}`);
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    }
  };

  const duplicate = async () => {
    if (!file) return;
    const stem = safeName(baseName(file));
    const taken = new Set(components.map((c) => c.file));
    let copy = `${stem}Copy`;
    let n = 1;
    while (taken.has(`components/${copy}.tsx`)) copy = `${stem}Copy${(n += 1)}`;
    try {
      await bridge.components.save(dirName, `${copy}.tsx`, source);
      await useComponentStore.getState().load(dirName);
      await loadFile(`components/${copy}.tsx`);
      recordUserOperation(`Duplicated component ${stem}`);
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    }
  };

  const [armedDelete, setArmedDelete] = useState(false);
  const remove = async () => {
    if (!file) return;
    if (!armedDelete) {
      setArmedDelete(true);
      return;
    }
    setArmedDelete(false);
    try {
      await bridge.components.delete(dirName, baseName(file));
      await useComponentStore.getState().load(dirName);
      const remaining = useComponentStore.getState().components;
      recordUserOperation(`Deleted component ${baseName(file)}`);
      if (remaining[0]) await loadFile(remaining[0].file);
      else {
        setFile(null);
        setSource("");
        setDirty(false);
      }
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    }
  };

  // Ctrl/Cmd+S saves; the browser's own save dialog must never appear here.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    }
  };

  if (!open) return null;

  const compileError = status.kind === "error" ? status.message : entry?.error ?? null;

  return (
    <div
      className="rm-editor fixed inset-0 z-[9999] flex items-center justify-center bg-[oklch(0.08_0.005_265/0.6)] p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="flex h-[min(760px,92vh)] w-full max-w-[1080px] flex-col rounded-[20px] bg-[var(--rm-chrome)] shadow-[0_32px_80px_-16px_rgb(0_0_0/0.6),0_8px_24px_-8px_rgb(0_0_0/0.4)]">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-4">
          <h2 className="text-[15px] font-medium text-[var(--rm-text)]">Components</h2>
          <p className="flex-1 truncate text-[11px] text-[var(--rm-text-faint)]">
            Real TSX modules in this project&apos;s components folder - editable here, in your
            own editor, or by AI. Saving compiles and hot-reloads the preview.
          </p>
          <IconButton title="Close" onClick={close}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="mt-3 flex min-h-0 flex-1">
          {/* File list */}
          <div className="flex w-[220px] shrink-0 flex-col rm-hairline-r">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
                Files
              </span>
              <IconButton title="New component" onClick={() => void create()}>
                <Plus className="size-3.5" />
              </IconButton>
            </div>
            <div className="rm-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
              {components.length === 0 ? (
                <p className="px-2 py-3 text-[11px] leading-[1.5] text-[var(--rm-text-faint)]">
                  No custom components yet. Create one - it becomes available in the
                  component picker immediately.
                </p>
              ) : (
                components.map((c) => (
                  <button
                    key={c.file}
                    type="button"
                    onClick={() => void loadFile(c.file)}
                    className={cn(
                      "mb-0.5 flex w-full items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-left text-[12px] transition-colors duration-100",
                      c.file === file
                        ? "bg-[var(--rm-accent-dim)] text-[var(--rm-text)]"
                        : "text-[var(--rm-text-dim)] hover:bg-[var(--rm-chrome-high)]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{baseName(c.file)}</span>
                    {c.error ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-[var(--rm-danger)]" />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Source pane */}
          <div className="flex min-w-0 flex-1 flex-col">
            {file ? (
              <>
                <div className="flex items-center gap-1 px-3 py-1.5">
                  <span className="rm-num min-w-0 flex-1 truncate text-[11px] text-[var(--rm-text-faint)]">
                    {file}
                    {dirty ? " •" : ""}
                  </span>
                  <IconButton title="Duplicate" onClick={() => void duplicate()}>
                    <Copy className="size-3.5" />
                  </IconButton>
                  {armedDelete ? (
                    <button
                      type="button"
                      onClick={() => void remove()}
                      onMouseLeave={() => setArmedDelete(false)}
                      className="h-6 rounded-[5px] bg-[var(--rm-danger)] px-2 text-[10px] font-medium text-white"
                    >
                      Delete?
                    </button>
                  ) : (
                    <IconButton title="Delete component" danger onClick={() => void remove()}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy || !dirty}
                    className={cn(
                      "ml-1 flex h-6 items-center gap-1 rounded-[5px] px-2.5 text-[11px] font-medium transition-colors duration-100",
                      dirty
                        ? "bg-[var(--rm-accent)] text-white hover:brightness-110"
                        : "bg-[var(--rm-chrome-high)] text-[var(--rm-text-faint)]",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : status.kind === "saved" && !dirty ? (
                      <Check className="size-3" />
                    ) : null}
                    Save
                  </button>
                </div>

                <textarea
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setDirty(true);
                    if (status.kind === "saved") setStatus({ kind: "idle" });
                  }}
                  spellCheck={false}
                  className="rm-scroll min-h-0 flex-1 resize-none bg-[var(--rm-chrome-low)] px-4 py-3 font-mono text-[12px] leading-[1.6] text-[var(--rm-text)] outline-none"
                />

                <div
                  className={cn(
                    "px-4 py-2 text-[11px] leading-[1.5]",
                    compileError ? "text-[var(--rm-danger)]" : "text-[var(--rm-text-faint)]",
                  )}
                >
                  {compileError ? (
                    <span className="whitespace-pre-wrap">{compileError}</span>
                  ) : entry ? (
                    <>
                      Compiled - registered as <b>{entry.name}</b>
                      {Object.keys(entry.manifest.props).length
                        ? ` with ${Object.keys(entry.manifest.props).length} editable prop${Object.keys(entry.manifest.props).length === 1 ? "" : "s"}`
                        : " (add props to the manifest to get inspector controls)"}
                      . Ctrl+S saves.
                    </>
                  ) : (
                    "Ctrl+S saves and compiles."
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px] leading-[1.7] text-[var(--rm-text-faint)]">
                Create a component to start.
                <br />
                It can import react, remotion, rawmotion and other project components.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
