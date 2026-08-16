/**
 * The editor shell.
 *
 * Owns layout, the keyboard map, the command list, and the two subscriptions
 * that make the app feel live: disk changes and render progress. Everything
 * below it is a view onto a store.
 *
 * Commands are declared once, in `commands`, and both the palette and the
 * shortcut table are derived from that array - so a command can never have a
 * shortcut the palette does not show, or a palette entry that does something
 * different from its key.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Command as CommandIcon,
  Film,
  Menu as MenuIcon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Redo2,
  Settings as SettingsIcon,
  Undo2,
} from "lucide-react";
import type { Project } from "@shared/project.js";
import { projectDurationInFrames, sceneTimings } from "@shared/project.js";
import { bridge, errorMessage, type ProjectSummary } from "@/lib/bridge";
import { useShortcuts, type Binding } from "@/lib/shortcuts";
import { useEditorStore } from "@/state/editorStore";
import { useComponentStore } from "@/state/componentStore";
import { useProjectStore } from "@/state/projectStore";
import { useRenderStore, activeJobs } from "@/state/renderStore";
import { recordUserOperation, useAiStore } from "@/state/aiStore";
import * as ops from "@/state/operations";
import { Canvas } from "./Canvas";
import { CommandPalette, type Command } from "./CommandPalette";
import { ComponentEditor } from "./ComponentEditor";
import { RenderDialog, type RenderChoice } from "./RenderDialog";
import { SettingsModal } from "./SettingsModal";
import { Inspector } from "./Inspector";
import { LeftPanel } from "./LeftPanel";
import { RenderQueuePanel } from "./RenderQueuePanel";
import { Timeline } from "./Timeline";
import { useAssetUrls } from "./useAssetUrls";
import { IconButton } from "./controls";
import { cn } from "@/lib/utils";

export const EditorShell: React.FC<{
  dirName: string;
  project: Project;
  onCloseProject: () => void;
  onNewProject: () => void;
  onOpened: (dirName: string, project: Project) => void;
}> = ({ dirName, project, onCloseProject, onNewProject, onOpened }) => {
  const editor = useEditorStore();
  const projectStore = useProjectStore();
  const renderStore = useRenderStore();
  const record = useAiStore((s) => s.record);

  const [notice, setNotice] = useState<string | null>(null);
  const [renderOpen, setRenderOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const assetUrls = useAssetUrls(dirName, project);

  const duration = useMemo(() => projectDurationInFrames(project), [project]);
  const jobs = renderStore.jobs;
  const running = activeJobs(jobs).length;

  /* ---- live subscriptions ---- */

  useEffect(() => renderStore.attach(), []);

  // Custom components: load on open, then follow main-process pushes so an
  // edit from any source - the in-app editor, Claude, VS Code - hot-reloads
  // the preview.
  useEffect(() => {
    void useComponentStore.getState().load(dirName);
    const detach = useComponentStore.getState().attach();
    return () => {
      detach();
      useComponentStore.getState().clear();
    };
  }, [dirName]);

  useEffect(() => {
    return bridge.project.onChangedOnDisk((payload) => {
      if (payload.dirName !== dirName) return;

      if (payload.error) {
        setNotice(`project.json could not be read: ${payload.error}`);
        return;
      }
      if (!payload.project) return;

      setNotice(null);
      useProjectStore.getState().adoptFromDisk(payload.project);
      record({
        source: "agent",
        label: "Project updated on disk",
        detail: "Reloaded from an external edit",
        revertible: true,
      });
    });
  }, [dirName, record]);

  /* ---- actions ---- */

  const render = async (choice: RenderChoice) => {
    try {
      // Save first: the queue snapshots the model it is handed, and an
      // export that silently omits the last edit is worse than a slow one.
      await useProjectStore.getState().save();
      await bridge.render.enqueue({
        dirName,
        project,
        format: choice.format,
        scale: choice.scale,
        quality: choice.quality,
        label: project.name,
      });
      setRenderOpen(false);
      editor.setBottomPanel("renders");
      recordUserOperation(`Queued ${choice.format.toUpperCase()} render`);
    } catch (error) {
      setRenderOpen(false);
      setNotice(errorMessage(error));
    }
  };

  /** Save first, then hand control back to App - leaving the editor must
   *  never cost the user their last edit. */
  const saveThen = async (next: () => void) => {
    try {
      await useProjectStore.getState().save();
    } catch {
      // A failed save must not trap the user in the editor.
    }
    next();
  };

  const closeProject = () => void saveThen(onCloseProject);
  const newProject = () => void saveThen(onNewProject);

  const openOther = async (dir: string) => {
    try {
      await useProjectStore.getState().save();
      await bridge.project.close().catch(() => {});
      const result = await bridge.project.open(dir);
      onOpened(result.dirName, result.project);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const addSceneAtEnd = () => {
    projectStore.apply("Add scene", (p) => ops.addScene(p));
    recordUserOperation("Added a scene");
  };

  const stepFrame = (delta: number) =>
    editor.setPlayhead(Math.min(duration - 1, Math.max(0, editor.playhead + delta)));

  /** Jump to the boundary of the previous or next scene. */
  const stepScene = (direction: -1 | 1) => {
    const timings = sceneTimings(project);
    const marks = timings.map((t) => t.from);
    if (direction === -1) {
      const previous = [...marks].reverse().find((m) => m < editor.playhead);
      editor.setPlayhead(previous ?? 0);
    } else {
      const next = marks.find((m) => m > editor.playhead);
      editor.setPlayhead(next ?? duration - 1);
    }
  };

  const deleteSelection = () => {
    const { selection } = editor;
    if (selection.kind === "layer") {
      projectStore.apply("Delete layer", (p) => ops.removeLayer(p, selection.id));
      editor.clearSelection();
    } else if (selection.kind === "audio") {
      projectStore.apply("Remove audio", (p) => ops.removeAudio(p, selection.id));
      editor.clearSelection();
    } else if (selection.kind === "scene") {
      projectStore.apply("Delete scene", (p) => ops.removeScene(p, selection.id));
      editor.clearSelection();
    }
  };

  const duplicateSelection = () => {
    const { selection } = editor;
    if (selection.kind === "layer") {
      projectStore.apply("Duplicate layer", (p) => ops.duplicateLayer(p, selection.id).project);
    } else if (selection.kind === "scene") {
      projectStore.apply("Duplicate scene", (p) => ops.duplicateScene(p, selection.id));
    }
  };

  const undo = () => {
    const label = projectStore.undo();
    if (label) setNotice(null);
  };
  const redo = () => projectStore.redo();

  /* ---- commands ---- */

  const commands: Command[] = useMemo(
    () => [
      { id: "play", group: "Playback", label: "Play / pause", keys: "space", run: editor.togglePlaying },
      { id: "start", group: "Playback", label: "Go to start", keys: "home", run: () => editor.setPlayhead(0) },
      { id: "end", group: "Playback", label: "Go to end", keys: "end", run: () => editor.setPlayhead(duration - 1) },
      { id: "prev-scene", group: "Playback", label: "Previous scene", keys: "j", run: () => stepScene(-1) },
      { id: "next-scene", group: "Playback", label: "Next scene", keys: "l", run: () => stepScene(1) },

      { id: "undo", group: "Edit", label: "Undo", keys: "mod+z", run: undo, disabled: !projectStore.canUndo() },
      { id: "redo", group: "Edit", label: "Redo", keys: "mod+shift+z", run: redo, disabled: !projectStore.canRedo() },
      { id: "save", group: "Edit", label: "Save project", keys: "mod+s", run: () => void projectStore.save() },
      { id: "duplicate", group: "Edit", label: "Duplicate selection", keys: "mod+d", run: duplicateSelection },
      { id: "delete", group: "Edit", label: "Delete selection", keys: "backspace", run: deleteSelection },

      { id: "add-scene", group: "Create", label: "Add scene", run: addSceneAtEnd },
      { id: "add-text", group: "Create", label: "Add text layer", run: () => addLayerHere("text") },
      { id: "add-shape", group: "Create", label: "Add shape layer", run: () => addLayerHere("shape") },
      { id: "add-background", group: "Create", label: "Add background layer", run: () => addLayerHere("background") },
      { id: "add-composite", group: "Create", label: "Add composite layer (custom component)", run: () => addLayerHere("composite") },

      { id: "import", group: "Assets", label: "Import media", run: () => void importMedia() },

      { id: "component-editor", group: "Components", label: "Edit component source…", keys: "mod+e", run: () => editor.openComponentEditor() },
      { id: "component-browser", group: "Components", label: "Show components panel", run: () => editor.setLeftPanel("components") },

      { id: "render", group: "Render", label: "Export video…", keys: "mod+shift+r", run: () => setRenderOpen(true) },
      { id: "renders", group: "Render", label: "Show render queue", run: () => editor.setBottomPanel("renders") },
      { id: "timeline", group: "Render", label: "Show timeline", run: () => editor.setBottomPanel("timeline") },

      { id: "fit", group: "View", label: "Fit to window", keys: "mod+0", run: editor.resetView },
      { id: "actual", group: "View", label: "Actual pixels", keys: "mod+1", run: () => editor.setZoom(1) },
      { id: "safe", group: "View", label: "Toggle layout grid", run: editor.toggleSafeAreas },
      { id: "left", group: "View", label: "Toggle left panel", keys: "mod+b", run: editor.toggleLeft },
      { id: "inspector", group: "View", label: "Toggle inspector", keys: "mod+alt+b", run: editor.toggleInspector },

      { id: "new-project", group: "Project", label: "New project…", run: newProject },
      { id: "reveal", group: "Project", label: "Reveal project folder", run: () => void bridge.workspace.reveal(dirName).catch((e) => setNotice(errorMessage(e))) },
      { id: "settings", group: "Project", label: "Settings…", keys: "mod+,", run: () => setSettingsOpen(true) },
      { id: "close", group: "Project", label: "Close project", keys: "mod+w", run: closeProject },
    ],
    // Rebuilt whenever anything a command closes over changes. The array is
    // small and this runs on state changes, not per frame.
    [editor, projectStore, project, duration, dirName],
  );

  function addLayerHere(type: "text" | "shape" | "background" | "composite") {
    const timings = sceneTimings(project);
    const index = Math.max(0, timings.findLastIndex((t) => editor.playhead >= t.from));
    const scene = project.scenes[index];
    if (!scene) return;

    let newId = "";
    projectStore.transaction(`Add ${type} layer`, () => {
      projectStore.apply("Add layer", (p) => {
        const result = ops.addLayer(p, scene.id, {
          type,
          animation:
            type === "background"
              ? {}
              : { enter: { preset: "riseFade", durationInFrames: 24, delay: 0 } },
        });
        newId = result.layerId;
        return result.project;
      });
    });
    if (newId) editor.selectLayer(newId);
    recordUserOperation(`Added a ${type} layer to ${scene.name}`);
  }

  async function importMedia() {
    try {
      const result = await bridge.assets.import(dirName);
      if (!result.canceled && result.imported.length) {
        projectStore.apply("Import assets", (p) => ops.registerAssets(p, result.imported));
        editor.setLeftPanel("assets");
        recordUserOperation(`Imported ${result.imported.length} asset(s)`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  /* ---- keyboard ---- */

  const bindings: Binding[] = useMemo(() => {
    const fromCommands: Binding[] = commands
      .filter((c) => c.keys && !c.disabled)
      .map((c) => ({ keys: c.keys!, run: c.run }));

    return [
      ...fromCommands,
      // Frame stepping is not in the command list: it fires on autorepeat and
      // would clutter the palette with two entries nobody searches for.
      { keys: "arrowleft", run: () => stepFrame(-1) },
      { keys: "arrowright", run: () => stepFrame(1) },
      { keys: "shift+arrowleft", run: () => stepFrame(-project.composition.fps) },
      { keys: "shift+arrowright", run: () => stepFrame(project.composition.fps) },
      { keys: "k", run: () => editor.setPlaying(false) },
      { keys: "delete", run: deleteSelection },
      { keys: "escape", run: () => editor.clearSelection() },
      {
        keys: "mod+k",
        allowInInput: true,
        run: () => editor.setCommandPaletteOpen(!editor.commandPaletteOpen),
      },
    ];
  }, [commands, editor, project]);

  useShortcuts(bindings);

  /* ---- layout ---- */

  return (
    <div className="rm-editor flex h-full min-h-0 flex-col">
      <Toolbar
        project={project}
        running={running}
        dirty={projectStore.dirty}
        saving={projectStore.saving}
        canUndo={projectStore.canUndo()}
        canRedo={projectStore.canRedo()}
        onUndo={undo}
        onRedo={redo}
        onRender={() => setRenderOpen(true)}
        onOpenPalette={() => editor.setCommandPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        menu={
          <AppMenu
            currentDir={dirName}
            onNewProject={newProject}
            onOpenProject={(dir) => void openOther(dir)}
            onCloseProject={closeProject}
            onImport={() => void importMedia()}
            onReveal={() =>
              void bridge.workspace.reveal(dirName).catch((e) => setNotice(errorMessage(e)))
            }
            onExport={() => setRenderOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        }
      />

      {notice ? <Notice message={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="flex min-h-0 flex-1">
        {editor.leftOpen ? (
          <aside className="rm-panel rm-hairline-r flex w-[240px] shrink-0 flex-col">
            <LeftPanel project={project} dirName={dirName} />
          </aside>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Canvas project={project} assetUrls={assetUrls} />

          <BottomDock height={editor.bottomHeight} onResize={editor.setBottomHeight}>
            {editor.bottomPanel === "timeline" ? (
              <Timeline project={project} />
            ) : (
              <RenderQueuePanel dirName={dirName} />
            )}
          </BottomDock>
        </main>

        {editor.inspectorOpen ? (
          <aside className="rm-panel rm-hairline-l flex w-[272px] shrink-0 flex-col">
            <Inspector project={project} />
          </aside>
        ) : null}
      </div>

      <CommandPalette
        open={editor.commandPaletteOpen}
        commands={commands}
        onClose={() => editor.setCommandPaletteOpen(false)}
      />

      <ComponentEditor dirName={dirName} />

      <RenderDialog
        open={renderOpen}
        project={project}
        busy={false}
        onClose={() => setRenderOpen(false)}
        onRender={(choice) => void render(choice)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        canChangeWorkspace={false}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Toolbar
 * ------------------------------------------------------------------ */

const Toolbar: React.FC<{
  project: Project;
  running: number;
  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRender: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  menu: React.ReactNode;
}> = ({
  project,
  running,
  dirty,
  saving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRender,
  onOpenPalette,
  onOpenSettings,
  menu,
}) => {
  const editor = useEditorStore();

  return (
    <div className="rm-panel rm-hairline-b flex h-10 shrink-0 items-center gap-1 px-2">
      {menu}
      <IconButton title="Toggle left panel" onClick={editor.toggleLeft} active={editor.leftOpen}>
        <PanelLeft className="size-4" />
      </IconButton>

      <div className="ml-1 flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[12px] text-[var(--rm-text)]">{project.name}</span>
        <SaveState dirty={dirty} saving={saving} />
      </div>

      <div className="mx-2 h-4 w-px bg-[var(--rm-line)]" />

      <IconButton title="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="size-4" />
      </IconButton>
      <IconButton title="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="size-4" />
      </IconButton>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        title="Command palette"
        className="mr-1 flex h-7 items-center gap-1.5 rounded-[5px] bg-[var(--rm-chrome-high)] px-2 text-[11px] text-[var(--rm-text-faint)] transition-colors duration-100 hover:text-[var(--rm-text-dim)]"
      >
        <CommandIcon className="size-3" />
        <span>Commands</span>
      </button>

      <IconButton
        title="Timeline"
        onClick={() => editor.setBottomPanel("timeline")}
        active={editor.bottomPanel === "timeline"}
      >
        <PanelBottom className="size-4" />
      </IconButton>
      <IconButton
        title={running ? `Render queue (${running} running)` : "Render queue"}
        onClick={() => editor.setBottomPanel("renders")}
        active={editor.bottomPanel === "renders"}
      >
        <span className="relative">
          <Clock className="size-4" />
          {running ? (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--rm-accent)]" />
          ) : null}
        </span>
      </IconButton>

      <button
        type="button"
        onClick={onRender}
        className="ml-1 flex h-7 items-center gap-1.5 rounded-[5px] bg-[var(--rm-accent)] px-2.5 text-[12px] text-white transition-opacity duration-100 hover:opacity-90"
      >
        <Film className="size-3.5" />
        Render
      </button>

      <IconButton title="Settings" onClick={onOpenSettings}>
        <SettingsIcon className="size-4" />
      </IconButton>

      <IconButton
        title="Toggle inspector"
        onClick={editor.toggleInspector}
        active={editor.inspectorOpen}
      >
        <PanelRight className="size-4" />
      </IconButton>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * App menu
 *
 * The one drop-down in the editor: project-level actions that a standard
 * application would keep in a File menu. Everything here is also in the
 * command palette; this exists because a menu you can see beats a palette
 * you have to know about.
 * ------------------------------------------------------------------ */

const AppMenu: React.FC<{
  currentDir: string;
  onNewProject: () => void;
  onOpenProject: (dirName: string) => void;
  onCloseProject: () => void;
  onImport: () => void;
  onReveal: () => void;
  onExport: () => void;
  onSettings: () => void;
}> = ({
  currentDir,
  onNewProject,
  onOpenProject,
  onCloseProject,
  onImport,
  onReveal,
  onExport,
  onSettings,
}) => {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bridge.workspace
      .list()
      .then(setProjects)
      .catch(() => setProjects([]));

    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (label: string, run: () => void, hint?: string) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        run();
      }}
      className="flex w-full items-center justify-between rounded-[5px] px-2 py-1.5 text-left text-[12px] text-[var(--rm-text)] transition-colors duration-100 hover:bg-[var(--rm-chrome-high)]"
    >
      <span>{label}</span>
      {hint ? <span className="ml-6 text-[10px] text-[var(--rm-text-faint)]">{hint}</span> : null}
    </button>
  );

  const divider = <div className="mx-2 my-1 h-px bg-[var(--rm-line)]" />;

  const others = projects.filter((p) => p.dirName !== currentDir && !p.broken).slice(0, 6);

  return (
    <div ref={ref} className="relative">
      <IconButton title="Menu" onClick={() => setOpen((o) => !o)} active={open}>
        <MenuIcon className="size-4" />
      </IconButton>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[240px] rounded-[10px] bg-[var(--rm-chrome)] p-1.5 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6),0_6px_16px_-6px_rgb(0_0_0/0.4)]">
          {item("New project…", onNewProject)}
          {item("Close project", onCloseProject, "back to launcher")}

          {others.length ? (
            <>
              {divider}
              <p className="px-2 pb-1 pt-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
                Open recent
              </p>
              {others.map((p) => (
                <button
                  key={p.dirName}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenProject(p.dirName);
                  }}
                  className="block w-full truncate rounded-[5px] px-2 py-1.5 text-left text-[12px] text-[var(--rm-text-dim)] transition-colors duration-100 hover:bg-[var(--rm-chrome-high)] hover:text-[var(--rm-text)]"
                >
                  {p.name}
                </button>
              ))}
            </>
          ) : null}

          {divider}
          {item("Import media…", onImport)}
          {item("Reveal project folder", onReveal)}
          {divider}
          {item("Export video…", onExport, "Ctrl+Shift+R")}
          {item("Settings…", onSettings, "Ctrl+,")}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Save indicator.
 *
 * Deliberately quiet. Autosave means the honest state is almost always
 * "saved", and a badge that flashes on every keystroke trains the user to
 * ignore it - which is a problem on the rare occasion it says something.
 */
const SaveState: React.FC<{ dirty: boolean; saving: boolean }> = ({ dirty, saving }) => {
  if (saving) {
    return <span className="text-[10px] text-[var(--rm-text-faint)]">Saving</span>;
  }
  if (dirty) {
    return <span className="text-[10px] text-[var(--rm-text-faint)]">Unsaved</span>;
  }
  return <span className="text-[10px] text-[var(--rm-text-faint)]">Saved</span>;
};

const Notice: React.FC<{ message: string; onDismiss: () => void }> = ({
  message,
  onDismiss,
}) => (
  <button
    type="button"
    onClick={onDismiss}
    className="rm-hairline-b block w-full bg-[color-mix(in_oklch,var(--rm-danger),transparent_86%)] px-3 py-1.5 text-left text-[11px] text-[var(--rm-danger)]"
  >
    {message}
    <span className="ml-2 opacity-60">Dismiss</span>
  </button>
);

/* ------------------------------------------------------------------ *
 * Bottom dock
 * ------------------------------------------------------------------ */

const BottomDock: React.FC<{
  height: number;
  onResize: (height: number) => void;
  children: React.ReactNode;
}> = ({ height, onResize, children }) => {
  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    const onMove = (e: PointerEvent) => onResize(startHeight - (e.clientY - startY));
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="relative flex shrink-0 flex-col" style={{ height }}>
      {/* 5px hit area over a 1px visual - the standard way to make a splitter
          grabbable without drawing a thick divider. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panel"
        onPointerDown={onPointerDown}
        className={cn(
          "absolute inset-x-0 -top-[2px] z-20 h-[5px] cursor-ns-resize",
          "before:absolute before:inset-x-0 before:top-[2px] before:h-px before:bg-[var(--rm-line)]",
          "hover:before:bg-[var(--rm-accent)]",
        )}
      />
      {children}
    </div>
  );
};
