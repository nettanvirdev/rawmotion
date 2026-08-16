import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { Titlebar } from "@/components/layout/Titlebar";
import { Sidebar, useSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { BrandMark } from "@/components/ui/brand-mark";

// Placeholder data - the real project store lands with the first feature.
const PROJECTS = [
  { id: "p1", title: "Aurora - launch teaser", updated: "2h" },
  { id: "p2", title: "Q3 feature reveal", updated: "1d" },
  { id: "p3", title: "Logo sting v4", updated: "3d" },
];

const CONTRAST_KEY = "rawmotion.highContrast";

export default function App() {
  const [windowState, setWindowState] = useState("normal");
  const [activeId, setActiveId] = useState(PROJECTS[0].id);
  const { theme, setTheme } = useTheme();
  const sidebar = useSidebar();

  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem(CONTRAST_KEY) === "true",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
    localStorage.setItem(CONTRAST_KEY, String(highContrast));
  }, [highContrast]);

  const isMaximized =
    windowState === "maximized" || windowState === "fullscreen";
  const active = PROJECTS.find((p) => p.id === activeId);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-canvas",
        // Rounded corners only when the window is floating.
        isMaximized ? "h-full" : "m-px h-[calc(100%-2px)] rounded-[10px]",
      )}
    >
      <Titlebar
        windowState={windowState}
        onWindowStateChange={setWindowState}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          {...sidebar}
          onToggle={() => sidebar.setOpen(!sidebar.open)}
          projects={PROJECTS}
          activeId={activeId}
          onSelect={setActiveId}
          onNewProject={() => toast("New project coming soon")}
          onOpenSettings={() => toast("Settings coming soon")}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <Header
            title={active?.title ?? "Raw Motion"}
            theme={theme}
            onThemeChange={setTheme}
            highContrast={highContrast}
            onHighContrastChange={setHighContrast}
          />

          {/* Content column: 58rem, centered. */}
          <section className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[58rem] px-8 pb-8 pt-16">
              <StarterState />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

/** Placeholder until the generation flow exists. */
function StarterState() {
  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark className="size-6 text-ink-muted" />
      <h2 className="mt-4 text-20 font-normal text-ink-strong">
        What are we making?
      </h2>
      <p className="mt-1 text-14 text-ink-muted">
        Describe a motion graphic or a product launch video and Raw Motion will
        storyboard it.
      </p>

      <div className="mt-6 flex items-center gap-1.5">
        <Button onClick={() => toast.success("Design system is wired up")}>
          <Wand2 className="size-4" aria-hidden />
          Generate
        </Button>
        <Button variant="filled">Browse templates</Button>
      </div>

      <div className="mt-10 grid w-full grid-cols-3 gap-1.5 text-start">
        {[
          { title: "Launch teaser", meta: "12s · 1080×1920" },
          { title: "Feature reveal", meta: "30s · 1920×1080" },
          { title: "Logo sting", meta: "4s · 1080×1080" },
        ].map((preset) => (
          <Card key={preset.title} className="p-3">
            <p className="text-14 text-ink-strong">{preset.title}</p>
            <p className="mt-0.5 text-12 text-ink-muted">{preset.meta}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-1.5">
        <Badge variant="info">Preview</Badge>
        <span className="text-12 text-ink-muted">
          Foundation only - no generation pipeline yet.
        </span>
      </div>
    </div>
  );
}
