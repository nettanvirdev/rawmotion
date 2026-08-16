import { useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Frameless-window chrome. Sits above the app shell and owns the drag region.
 * Not part of the base design spec - it is the Electron-specific layer - but
 * it borrows the same tokens so it shifts with the theme.
 */
export function Titlebar({ windowState = "normal", onWindowStateChange }) {
  const isMaximized =
    windowState === "maximized" || windowState === "fullscreen";

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onWindowState?.((state) =>
      onWindowStateChange?.(state),
    );
    return () => unsubscribe?.();
  }, [onWindowStateChange]);

  const handleTitlebarMouseDown = (e) => {
    if (e.target.closest(".titlebar-no-drag")) return;
    if (isMaximized) window.electronAPI?.beginDrag?.();
  };

  return (
    <header
      onMouseDown={handleTitlebarMouseDown}
      className={cn(
        // Native drag only applies in the normal state; maximized uses the
        // manual begin-drag handler above to restore-and-follow the cursor.
        windowState === "normal" && "titlebar-drag",
        "flex h-8 min-h-8 select-none items-center justify-between",
        "bg-titlebar pl-3.5",
        !isMaximized && "rounded-t-[10px]",
      )}
    >
      {/* Intentionally no logo or title here - the sidebar header owns the
          branding, and repeating it two rows apart reads as a mistake. This
          side stays empty so the whole strip is drag surface. */}
      <div aria-hidden />

      <div className="titlebar-no-drag flex h-full">
        <WindowButton
          onClick={() => window.electronAPI?.minimize()}
          label="Minimize"
        >
          <Minus className="size-3" aria-hidden />
        </WindowButton>
        <WindowButton
          onClick={() => window.electronAPI?.maximize()}
          label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className="size-2.5" aria-hidden />
        </WindowButton>
        <WindowButton
          onClick={() => window.electronAPI?.close()}
          label="Close"
          className={cn(
            "hover:bg-red-600 hover:text-white",
            !isMaximized && "rounded-tr-[10px]",
          )}
        >
          <X className="size-3" aria-hidden />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({ children, onClick, label, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-full w-[46px] place-items-center text-ink-body",
        "transition-colors duration-150 hover:bg-wash-ghost",
        className,
      )}
    >
      {children}
    </button>
  );
}
