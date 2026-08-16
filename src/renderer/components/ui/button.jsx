import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Sizes below are total footprint. Transitions touch color and background
 * only - never transform, never shadow.
 *
 * There is deliberately no destructive variant: destructive intent is carried
 * by a confirm dialog, not by button color.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-normal " +
    "transition-colors duration-150 ease-[var(--ease-standard)] " +
    "disabled:cursor-not-allowed disabled:pointer-events-none",
  {
    variants: {
      variant: {
        // Primary. Inverts between themes - the system's signature move.
        solid:
          "bg-action text-action-fg hover:bg-action-hover " +
          "disabled:bg-gray-200 disabled:text-white dark:disabled:bg-gray-700 dark:disabled:text-gray-900",
        // Secondary / cancel.
        filled:
          "bg-gray-100 text-gray-800 hover:bg-gray-100/70 " +
          "dark:bg-gray-850 dark:text-white dark:hover:bg-gray-850/60 disabled:text-ink-faint",
        surface:
          "bg-white text-gray-800 hover:bg-gray-100 " +
          "dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-850 disabled:text-ink-faint",
        // Was an outline variant; borders are not used in this system, so it
        // is now a lighter fill that sits between `filled` and `ghost`.
        subtle:
          "bg-gray-50 text-gray-700 hover:bg-gray-100 " +
          "dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
        ghost:
          "bg-transparent text-ink-muted hover:bg-wash-ghost hover:text-ink-body " +
          "dark:hover:text-ink-strong disabled:text-ink-faint",
      },
      size: {
        // Pill actions: full radius, 6px vertical padding, 14px type.
        default: "rounded-full px-4 py-1.5 text-14 gap-1.5",
        pill: "rounded-2xl px-2.5 py-1 text-14 gap-1.5",
        // Icon buttons, by the surface they live on.
        header: "size-6 rounded-md",
        message: "size-7 rounded-md",
        composer: "size-[30px] rounded-full",
        sidebar: "size-[34px] rounded-md",
      },
    },
    defaultVariants: { variant: "solid", size: "default" },
  },
);

const Button = React.forwardRef(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // A real disabled attribute, not just styling.
      disabled={Comp === "button" ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {/* Swap content for a spinner at the same footprint - no layout shift. */}
      {loading ? <Spinner className="size-4" /> : children}
    </Comp>
  );
});

export { Button, buttonVariants };
