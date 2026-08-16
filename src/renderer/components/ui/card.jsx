import { cn } from "@/lib/utils";

/**
 * In-flow surface. It has no border, so the FILL is the only thing separating
 * it from the canvas — and `--surface` is #ffffff in light mode, same as the
 * canvas. Use surface-sunken (gray-50 · dark gray-850), which steps off the
 * canvas in both themes. `--surface` is for floating layers that also carry a
 * shadow.
 */
export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface-sunken p-1.5",
        className
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }) {
  return (
    <div className={cn("rounded-xl bg-surface-sunken", className)} {...props} />
  );
}

export function PanelHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5 text-14 text-ink-body",
        className
      )}
      {...props}
    />
  );
}

export function PanelRow({ className, ...props }) {
  return <div className={cn("px-3", className)} {...props} />;
}
