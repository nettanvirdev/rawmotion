/**
 * Application root.
 *
 * Two states: no project (the launcher) or a project (the editor). There is
 * no router - Raw Motion is a single-document application, and a URL for
 * "the editor" would be a fiction with nothing to link to.
 *
 * The window chrome sits above both, so the frameless titlebar stays put
 * while the content beneath it changes.
 */

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@shared/project.js";
import { bridge, isBridgeAvailable } from "@/lib/bridge";
import { useProjectStore } from "@/state/projectStore";
import { useEditorStore } from "@/state/editorStore";
import { EditorShell } from "@/editor/EditorShell";
import { Launcher } from "@/editor/Launcher";
import { Titlebar } from "@/components/layout/Titlebar";
import { cn } from "@/lib/utils";

export default function App() {
  const [windowState, setWindowState] = useState("normal");
  // Set when "New project" is chosen from inside the editor, so the launcher
  // opens straight onto the create form instead of the recent list.
  const [createOnLaunch, setCreateOnLaunch] = useState(false);
  const dirName = useProjectStore((s) => s.dirName);
  const project = useProjectStore((s) => s.project);
  const load = useProjectStore((s) => s.load);
  const closeProject = useProjectStore((s) => s.closeProject);

  // The editor is a dark instrument regardless of the app theme - see the
  // note in globals.css section 11. Forcing the class here rather than in
  // index.html keeps the launcher and the editor consistent without
  // overriding the user's stored preference.
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const onOpened = useCallback(
    (nextDirName: string, nextProject: Project) => {
      setCreateOnLaunch(false);
      load(nextDirName, nextProject);
      // A freshly opened project should show its first frame, not wherever
      // the playhead happened to be in the last one.
      useEditorStore.getState().setPlayhead(0);
      useEditorStore.getState().clearSelection();
    },
    [load],
  );

  const onCloseProject = useCallback(() => {
    void bridge.project.close().catch(() => {
      // Closing is best-effort: the main process may already have released
      // the watcher. Failing here must not trap the user in the editor.
    });
    setCreateOnLaunch(false);
    closeProject();
  }, [closeProject]);

  const onNewProject = useCallback(() => {
    void bridge.project.close().catch(() => {});
    closeProject();
    setCreateOnLaunch(true);
  }, [closeProject]);

  const isMaximized = windowState === "maximized" || windowState === "fullscreen";

  if (!isBridgeAvailable()) return <BridgeMissing />;

  return (
    <div
      className={cn(
        // `rm-editor` here, not just in the shells below: the titlebar and
        // this root paint with `--rm-*` tokens, and those are only defined
        // under the class. Without it their backgrounds resolve to nothing
        // and the transparent window shows the desktop through the chrome.
        "rm-editor flex h-full flex-col overflow-hidden bg-[var(--rm-void)]",
        isMaximized ? "h-full" : "m-px h-[calc(100%-2px)] rounded-[10px]",
      )}
    >
      <Titlebar
        windowState={windowState}
        onWindowStateChange={setWindowState}
        title={project ? project.name : "Raw Motion"}
      />

      <div className="relative min-h-0 flex-1">
        {dirName && project ? (
          <EditorShell
            key={dirName}
            dirName={dirName}
            project={project}
            onCloseProject={onCloseProject}
            onNewProject={onNewProject}
            onOpened={onOpened}
          />
        ) : (
          <Launcher onOpened={onOpened} initialCreating={createOnLaunch} />
        )}
      </div>
    </div>
  );
}

/**
 * Shown when the preload bridge is absent.
 *
 * This means the app is running outside Electron or the preload failed. It
 * is unrecoverable from the renderer, so the screen explains rather than
 * offering a retry that cannot work.
 */
function BridgeMissing() {
  return (
    <div className="rm-editor flex h-full items-center justify-center p-8">
      <div className="max-w-[420px] text-center">
        <h1 className="text-[15px] text-[var(--rm-text)]">Desktop bridge unavailable</h1>
        <p className="mt-2 text-[12px] leading-[1.6] text-[var(--rm-text-dim)]">
          Raw Motion's renderer could not reach the Electron main process. This
          usually means the preload script failed to load, or the window was
          opened outside the desktop application.
        </p>
      </div>
    </div>
  );
}
