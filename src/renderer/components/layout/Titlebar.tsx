/**
 * Frameless-window chrome.
 *
 * Owns the drag region and the window buttons. Unchanged in behaviour from
 * the version this project started with - including the trick where dragging
 * a maximized window restores it and re-centres it under the cursor - but
 * moved onto the `rawmotion` bridge and given the editor's palette, since it
 * now sits above a permanently dark instrument rather than a themed document.
 */

import { useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import { bridge } from "@/lib/bridge";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

export function Titlebar({
  windowState = "normal",
  onWindowStateChange,
  title,
}: {
  windowState?: string;
  onWindowStateChange?: (state: string) => void;
  title?: string;
}) {
  const isMaximized = windowState === "maximized" || windowState === "fullscreen";

  useEffect(() => {
    const unsubscribe = bridge.window.onState((state) => onWindowStateChange?.(state));
    return () => unsubscribe?.();
  }, [onWindowStateChange]);

  const onMouseDown = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest(".titlebar-no-drag")) return;
    if (isMaximized) bridge.window.beginDrag();
  };

  return (
    <header
      onMouseDown={onMouseDown}
      className={cn(
        // Native drag applies only when the window is floating; maximized
        // uses the manual begin-drag handler above.
        windowState === "normal" && "titlebar-drag",
        "relative flex h-8 min-h-8 select-none items-center justify-between",
        "bg-[var(--rm-void)] pl-3",
        !isMaximized && "rounded-t-[10px]",
      )}
    >
      <div className="flex items-center gap-2">
        <BrandMark className="size-3.5 text-[var(--rm-text-dim)]" />
      </div>

      {/* Centred independently of the flanking content so the title stays
          optically centred in the window rather than in the space left over. */}
      {title ? (
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] text-[var(--rm-text-faint)]">
          {title}
        </span>
      ) : null}

      <div className="titlebar-no-drag flex h-full">
        <WindowButton onClick={() => bridge.window.minimize()} label="Minimize">
          <Minus className="size-3" aria-hidden />
        </WindowButton>
        <WindowButton
          onClick={() => bridge.window.maximize()}
          label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className="size-2.5" aria-hidden />
        </WindowButton>
        <WindowButton
          onClick={() => bridge.window.close()}
          label="Close"
          className={cn("hover:bg-red-600 hover:text-white", !isMaximized && "rounded-tr-[10px]")}
        >
          <X className="size-3" aria-hidden />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-full w-[44px] place-items-center text-[var(--rm-text-dim)]",
        "transition-colors duration-150 hover:bg-white/8",
        className,
      )}
    >
      {children}
    </button>
  );
}
