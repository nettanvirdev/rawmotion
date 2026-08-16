import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * gray-950 in both themes, no arrow, 4px offset.
 * Suppressed on touch devices by Radix - never hide essential information here.
 */
export function Tooltip({ children, content, side = "bottom", delay = 200 }) {
  if (!content) return children;

  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={4}
          collisionPadding={16}
          className={cn(
            "z-[9999] rounded-md bg-gray-950 px-2 py-1",
            "text-12 text-white shadow-[var(--shadow-tooltip)]",
            "animate-[var(--animate-fly-and-scale)]",
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
