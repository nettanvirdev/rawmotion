import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Dropdown / context menu surface. Portaled to <body> so it escapes any
 * overflow:hidden ancestor, kept 16px clear of every viewport edge, and
 * plays fly-and-scale in BOTH directions (modals only play it on enter).
 */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;

export const MenuContent = React.forwardRef(function MenuContent(
  { className, sideOffset = 4, ...props },
  ref
) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "z-[9999] min-w-[10rem] overflow-y-auto rounded-lg bg-surface-menu p-0.5",
          "shadow-[var(--shadow-menu)]",
          "max-h-[var(--radix-dropdown-menu-content-available-height)]",
          "animate-[var(--animate-fly-and-scale)]",
          "data-[state=closed]:animate-none data-[state=closed]:opacity-0",
          className
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

export const MenuItem = React.forwardRef(function MenuItem(
  { className, ...props },
  ref
) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={cn(
        "flex h-[27px] cursor-default select-none items-center gap-2 rounded-lg px-2 text-13 font-normal",
        "text-ink-body outline-none transition-colors duration-150",
        "data-[highlighted]:bg-gray-50/40 data-[highlighted]:text-ink-strong",
        "dark:data-[highlighted]:bg-gray-800/40",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ink-faint",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
});

export function MenuSeparator({ className }) {
  return (
    <DropdownMenu.Separator
      className={cn("my-1", className)}
    />
  );
}

export function MenuLabel({ className, ...props }) {
  return (
    <DropdownMenu.Label
      className={cn("px-2 py-1 text-12 text-ink-muted", className)}
      {...props}
    />
  );
}
