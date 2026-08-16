import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { SearchInput } from "@/components/ui/input";
import { BrandMark } from "@/components/ui/brand-mark";

const WIDTH_KEY = "rawmotion.sidebarWidth";
const OPEN_KEY = "rawmotion.sidebarOpen";
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 245;

/** Sidebar width + open state, persisted and mirrored onto --sidebar-width. */
export function useSidebar() {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  });
  const [open, setOpen] = useState(
    () => localStorage.getItem(OPEN_KEY) !== "false",
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, String(open));
  }, [open]);

  const commitWidth = useCallback((next) => {
    localStorage.setItem(WIDTH_KEY, String(next));
  }, []);

  return { width, setWidth, commitWidth, open, setOpen };
}

export function Sidebar({
  width,
  setWidth,
  commitWidth,
  open,
  onToggle,
  projects,
  activeId,
  onSelect,
  onNewProject,
  onOpenSettings,
}) {
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [dragging, setDragging] = useState(false);

  const visible = projects.filter((p) =>
    p.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!open) {
    return (
      <CollapsedRail
        onToggle={onToggle}
        onNewProject={onNewProject}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <nav
      aria-label="Projects"
      style={{ width: `${width}px` }}
      className={cn(
        "relative flex shrink-0 flex-col bg-sidebar",
        // No width transition while dragging, or the handle lags the cursor.
        !dragging && "transition-[width] duration-[250ms] ease-in-out",
      )}
    >
      {/* Header - sticky, over a gradient fade to the sidebar background. */}
      <div className="relative z-10 shrink-0 px-1.5 py-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-2 px-1.5">
            <BrandMark className="size-4 text-ink-strong" />
            <span className="nudge-label truncate text-13 text-ink-strong">
              Raw Motion
            </span>
          </div>
          <Tooltip content="Collapse sidebar">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="grid size-[34px] shrink-0 place-items-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-wash-strong hover:text-ink-body"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          </Tooltip>
        </div>

        <div className="mt-1 space-y-0.5">
          <NavItem icon={Plus} label="New project" onClick={onNewProject} />
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search projects"
          />
        </div>

        {scrolled ? (
          <div className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-[var(--sidebar)] from-50% to-transparent" />
        ) : null}
      </div>

      {/* Body */}
      <div
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-1.5 py-2.5"
      >
        <p className="px-2.5 py-1 text-12 text-ink-muted">Projects</p>

        {visible.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-12 text-ink-muted">
            {query ? "No matches" : "No projects yet"}
          </p>
        ) : (
          <ul>
            {visible.map((project) => (
              <li key={project.id}>
                <ProjectRow
                  project={project}
                  selected={project.id === activeId}
                  onSelect={() => onSelect(project.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-1.5 py-1">
        <div className="mb-1 h-2" />
        <NavItem icon={Settings} label="Settings" onClick={onOpenSettings} />
      </div>

      <Resizer
        width={width}
        setWidth={setWidth}
        commitWidth={commitWidth}
        onDraggingChange={setDragging}
      />
    </nav>
  );
}

function NavItem({ icon: Icon, label, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-13 text-ink-body",
        "transition-colors duration-150 hover:bg-wash-strong hover:text-ink-strong",
        active && "bg-row-selected text-ink-strong",
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="nudge-label truncate">{label}</span>
    </button>
  );
}

function ProjectRow({ project, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "group flex min-h-8 w-full items-center gap-2 rounded-lg px-[11px] py-1.5 text-13",
        "transition-colors duration-150",
        selected
          ? "bg-row-selected text-ink-strong"
          : "text-ink-body hover:bg-wash-strong",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-start leading-5">
        {project.title}
      </span>
      {/* Reveal-on-hover: visibility, not display, so the row never shifts. */}
      <span className="reveal-on-hover invisible shrink-0 text-10 text-ink-faint group-hover:visible">
        {project.updated}
      </span>
    </button>
  );
}

/** 1px visual, 12px hit area. */
function Resizer({ width, setWidth, commitWidth, onDraggingChange }) {
  const startRef = useRef(null);

  const onPointerDown = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width };
    onDraggingChange(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (ev) => {
      const next = Math.min(
        MAX_WIDTH,
        Math.max(
          MIN_WIDTH,
          startRef.current.width + ev.clientX - startRef.current.x,
        ),
      );
      setWidth(next);
    };

    const onUp = (ev) => {
      onMove(ev);
      const next = Math.min(
        MAX_WIDTH,
        Math.max(
          MIN_WIDTH,
          startRef.current.width + ev.clientX - startRef.current.x,
        ),
      );
      commitWidth(next);
      onDraggingChange(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 -end-1.5 z-[20] w-3 cursor-col-resize"
    >
      <div className="mx-auto h-full w-full transition-colors duration-150 hover:bg-wash-ghost" />
    </div>
  );
}

/** 42px desktop-only rail: each 34px icon box holds a 30px fill-on-hover square. */
function CollapsedRail({ onToggle, onNewProject, onOpenSettings }) {
  const items = [
    { icon: PanelLeftOpen, label: "Expand sidebar", onClick: onToggle },
    { icon: Plus, label: "New project", onClick: onNewProject },
    { icon: Clapperboard, label: "Renders", onClick: () => {} },
    { icon: Folder, label: "Assets", onClick: () => {} },
  ];

  return (
    <nav
      aria-label="Projects"
      className="flex w-[42px] shrink-0 flex-col items-center bg-sidebar py-1"
    >
      <div className="grid size-[34px] place-items-center">
        <BrandMark className="size-4 text-ink-strong" />
      </div>

      <div className="mt-1 flex flex-1 flex-col items-center gap-0.5">
        {items.map(({ icon: Icon, label, onClick }) => (
          <RailButton key={label} icon={Icon} label={label} onClick={onClick} />
        ))}
      </div>

      <RailButton icon={Settings} label="Settings" onClick={onOpenSettings} />
    </nav>
  );
}

function RailButton({ icon: Icon, label, onClick }) {
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="grid size-[34px] place-items-center"
      >
        <span className="grid size-[30px] place-items-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-wash-strong hover:text-ink-body">
          <Icon className="size-4" aria-hidden />
        </span>
      </button>
    </Tooltip>
  );
}
