import { cn } from "@/lib/utils";

/**
 * The system's only loading treatment. It uses spinners and text - never grey
 * placeholder bars. Do not mix the two.
 *
 * Under prefers-reduced-motion the rotation stops but the ring stays visible,
 * so the state remains legible.
 */
export function Spinner({ className, label = "Loading" }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-3 shrink-0 rounded-full border-2 border-current",
        "border-r-transparent animate-[var(--animate-spin-fast)]",
        className,
      )}
    />
  );
}

/** Centered spinner + label, for a list or panel that is still filling. */
export function LoadingRow({ children = "Loading…", className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-6 text-12 text-ink-muted",
        className,
      )}
    >
      <Spinner />
      <span>{children}</span>
    </div>
  );
}
