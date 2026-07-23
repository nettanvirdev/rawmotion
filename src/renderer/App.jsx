import { useEffect, useState } from "react";
import { Zap, Palette, Rocket, Star, BookOpen, ShieldCheck } from "lucide-react";
import { Titlebar } from "./components/layout/Titlebar";
import { Button } from "./components/ui/button";

const FEATURES = [
  {
    icon: Zap,
    title: "Fast",
    desc: "Vite 8 + HMR",
  },
  {
    icon: Palette,
    title: "Beautiful",
    desc: "Tailwind 4 + shadcn",
  },
  {
    icon: Rocket,
    title: "Modern",
    desc: "React 19 + Electron 43",
  },
];

function App() {
  const [windowState, setWindowState] = useState("normal");
  const [info, setInfo] = useState(null);

  const isMaximized =
    windowState === "maximized" || windowState === "fullscreen";

  useEffect(() => {
    window.electronAPI?.getAppInfo?.().then(setInfo).catch(() => {});
  }, []);

  const openExternal = (url) => window.electronAPI?.openExternal?.(url);

  const versionChips = info
    ? [
        { label: "App", value: `v${info.appVersion}` },
        { label: "Electron", value: info.versions.electron },
        { label: "Node", value: info.versions.node },
        { label: "Chromium", value: info.versions.chrome.split(".")[0] },
      ]
    : [];

  return (
    <div
      className={`app ${
        isMaximized ? "h-full" : "h-[calc(100%-2px)] m-[1px] rounded-[10px]"
      } bg-background overflow-hidden flex flex-col`}
    >
      <Titlebar
        title="Electron Starter"
        windowState={windowState}
        onWindowStateChange={setWindowState}
      />

      <main className="content flex-1 overflow-auto p-6 flex items-center justify-center">
        <div className="text-center max-w-2xl w-full">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center text-3xl shadow-lg ring-1 ring-border">
              ⚛️
            </div>
          </div>

          <h1 className="text-5xl font-bold mb-3 tracking-tight">
            Electron + React
          </h1>
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            A production-ready desktop starter — build fast, ship signed
            installers and portable builds in one command.
          </p>

          {/* Runtime version chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[28px]">
            {versionChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground"
              >
                <span className="font-medium text-foreground/80">
                  {chip.label}
                </span>
                {chip.value}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-4 rounded-xl bg-secondary/40 hover:bg-secondary transition-colors flex flex-col items-center gap-2"
              >
                <Icon className="w-5 h-5 text-foreground/80" />
                <p className="font-semibold text-foreground text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() =>
                openExternal("https://github.com/nettanvirdev/electron-starter")
              }
            >
              <Star className="w-4 h-4 mr-2" />
              Star on GitHub
            </Button>
            <Button
              variant="secondary"
              onClick={() => openExternal("https://www.electronjs.org/docs")}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Docs
            </Button>
          </div>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            Context isolation · sandboxed renderer · single-instance lock
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
