import { useState } from "react";
import { Titlebar } from "./components/layout/Titlebar";

function App() {
  const [windowState, setWindowState] = useState("normal");
  const isMaximized =
    windowState === "maximized" || windowState === "fullscreen";

  return (
    <div
      className={`app ${
        isMaximized ? "h-full" : "h-[calc(100%-2px)] m-[1px] rounded-[10px]"
      } bg-background overflow-hidden flex flex-col`}
    >
      <Titlebar
        title="Electron+React Template"
        windowState={windowState}
        onWindowStateChange={setWindowState}
      />

      <main className="content flex-1 overflow-auto p-6 flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center text-white text-3xl font-bold">
              ⚛️
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-foreground bg-clip-text text-transparent">
            Electron + React
          </h1>
          <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
            Build powerful cross-platform desktop applications stack.
          </p>
          <div className="grid rounded-lg grid-cols-3 gap-4 mt-8 bg-card">
            <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition">
              <p className="font-semibold text-foreground">⚡ Fast</p>
              <p className="text-sm text-muted-foreground">Vite powered</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition">
              <p className="font-semibold text-foreground">🎨 Beautiful</p>
              <p className="text-sm text-muted-foreground">Tailwind + shadcn</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition">
              <p className="font-semibold text-foreground">🚀 Modern</p>
              <p className="text-sm text-muted-foreground">React 18+</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
