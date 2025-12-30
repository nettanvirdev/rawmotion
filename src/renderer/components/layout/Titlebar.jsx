import { useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import { Button } from "../ui/button";

// Inline SVG icon as base64 data URL (guaranteed to work, no CSP issues)
const FALLBACK_ICON =
  "data:image/png;base64,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";

export function Titlebar({
  title = "Electron+React Template",
  windowState = "normal",
  onWindowStateChange,
}) {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const handleTitlebarMouseDown = (e) => {
    // Don't trigger drag if clicking on window control buttons
    if (e.target.closest(".titlebar-no-drag")) return;

    if (windowState === "maximized" || windowState === "fullscreen") {
      window.electronAPI?.beginDrag?.();
    }
  };

  useEffect(() => {
    window.electronAPI?.onWindowState?.((state) =>
      onWindowStateChange?.(state)
    );
  }, [onWindowStateChange]);

  // Disable native drag when maximized or fullscreen - only allow drag in normal state
  const dragEnabled = windowState === "normal";
  const isMaximized =
    windowState === "maximized" || windowState === "fullscreen";
  const headerClass = `${
    dragEnabled ? "titlebar-drag" : ""
  } h-8 min-h-8 flex items-center justify-between pl-3.5 bg-[var(--titlebar)] ${
    isMaximized ? "" : "rounded-t-[10px]"
  } select-none`;

  return (
    <header className={headerClass} onMouseDown={handleTitlebarMouseDown}>
      {/* Left side - Icon and Title */}
      <div className="flex items-center gap-2">
        <img src={FALLBACK_ICON} alt="Logo" className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs font-normal text-foreground/90">{title}</span>
      </div>

      {/* Right side - Window Controls */}
      <div className="titlebar-no-drag flex h-full">
        <WindowButton onClick={handleMinimize} title="Minimize">
          <Minus className="w-3 h-3" />
        </WindowButton>

        <WindowButton onClick={handleMaximize} title="Maximize">
          <Square className="w-2.5 h-2.5" />
        </WindowButton>

        <WindowButton
          onClick={handleClose}
          title="Close"
          className={`${
            isMaximized ? "" : "rounded-tr-[10px]"
          } hover:bg-red-600 hover:text-white`}
        >
          <X className="w-3 h-3" />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({ children, onClick, title, className = "" }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className={`w-[46px] h-full rounded-none text-foreground hover:bg-white/10 ${className}`}
    >
      {children}
    </Button>
  );
}
