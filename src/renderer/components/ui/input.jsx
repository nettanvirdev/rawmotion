import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      // dir=auto so RTL user content lays itself out correctly.
      dir="auto"
      aria-invalid={error ? true : undefined}
      className={cn(
        // No border. Focus is signalled by a fill shift, and an error by the
        // message below plus red text - never by an outline.
        "w-full rounded-md bg-surface-sunken px-2 py-3.5 text-14 text-ink",
        "placeholder:text-ink-placeholder outline-none transition-colors duration-150",
        "focus:bg-wash-strong",
        "disabled:cursor-not-allowed disabled:text-ink-faint",
        error && "text-red-500",
        className,
      )}
      {...props}
    />
  );
});

/** 28px-tall variant for dense chrome (toolbars, inline edits). */
export const InputCompact = React.forwardRef(function InputCompact(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      dir="auto"
      className={cn(
        "h-7 w-full rounded-md px-2 text-12 text-ink outline-none",
        "bg-gray-50/40 dark:bg-white/[0.03]",
        "placeholder:text-ink-placeholder transition-colors duration-150",
        "focus:bg-gray-100/60 dark:focus:bg-white/[0.07]",
        className,
      )}
      {...props}
    />
  );
});

/** Field-level error text. Action-level results belong in a toast instead. */
export function FieldError({ children }) {
  return (
    <p role="alert" className="mt-1 text-12 text-red-500">
      {children}
    </p>
  );
}

/** Icon block + input assembled into one pill. */
export function SearchInput({ value, onChange, onClear, className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg bg-transparent px-2",
        "focus-within:bg-wash-soft transition-colors duration-150",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <input
        value={value}
        onChange={onChange}
        dir="auto"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-13 text-ink outline-none placeholder:text-ink-placeholder"
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="grid size-5 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-wash-ghost"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Auto-growing textarea. Critical detail: every scrolled ancestor's scrollTop
 * is saved and restored around the resize, otherwise the page jumps as the
 * field grows.
 */
export const Textarea = React.forwardRef(function Textarea(
  { className, maxHeight = 384, onChange, ...props },
  ref,
) {
  const innerRef = React.useRef(null);

  const resize = React.useCallback(
    (el) => {
      if (!el) return;

      const ancestors = [];
      for (let node = el.parentElement; node; node = node.parentElement) {
        ancestors.push([node, node.scrollTop]);
      }

      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";

      for (const [node, top] of ancestors) node.scrollTop = top;
    },
    [maxHeight],
  );

  React.useLayoutEffect(() => {
    resize(innerRef.current);
  }, [resize, props.value]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      rows={1}
      dir="auto"
      onChange={(e) => {
        resize(e.target);
        onChange?.(e);
      }}
      className={cn(
        "w-full resize-none bg-transparent text-15 text-ink outline-none",
        "placeholder:text-ink-placeholder scrollbar-none",
        className,
      )}
      {...props}
    />
  );
});
