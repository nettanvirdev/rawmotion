/**
 * Inspector control primitives.
 *
 * Every field in the inspector is one of these. They exist as a set rather
 * than as ad-hoc inputs because a property panel's credibility comes almost
 * entirely from consistency: identical label column, identical row height,
 * identical focus treatment. A single hand-rolled input in the middle of
 * forty generated ones is immediately visible.
 *
 * The important behaviour here is `NumberField`'s scrub gesture, described
 * on that component.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, children, actions }) => (
  <section className="rm-hairline-b px-3 py-3">
    <header className="mb-2 flex h-5 items-center justify-between">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]">
        {title}
      </h3>
      {actions}
    </header>
    <div className="space-y-1.5">{children}</div>
  </section>
);

export const Row: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <label className="grid grid-cols-[76px_1fr] items-center gap-2" title={hint}>
    <span className="truncate text-[11px] text-[var(--rm-text-dim)]">{label}</span>
    <div className="min-w-0">{children}</div>
  </label>
);

/** Two or three controls sharing one label, e.g. X and Y. */
export const Pair: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="grid grid-cols-[76px_1fr] items-center gap-2">
    <span className="truncate text-[11px] text-[var(--rm-text-dim)]">{label}</span>
    <div className="grid min-w-0 grid-cols-2 gap-1.5">{children}</div>
  </div>
);

const FIELD_CLASS =
  "h-7 w-full min-w-0 rounded-[5px] bg-[var(--rm-chrome-high)] px-2 text-[12px] " +
  "text-[var(--rm-text)] outline-none transition-colors duration-100 " +
  "hover:bg-[color-mix(in_oklch,var(--rm-chrome-high),white_4%)] " +
  "focus:bg-[var(--rm-chrome-low)] focus:ring-1 focus:ring-[var(--rm-accent)]";

/* ------------------------------------------------------------------ *
 * NumberField
 * ------------------------------------------------------------------ */

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Called once when a scrub or typed edit finishes. Use to close an undo group. */
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places shown when not focused. */
  precision?: number;
  suffix?: string;
  disabled?: boolean;
}

/**
 * A numeric field that can be dragged.
 *
 * Scrubbing is not a flourish - it is the difference between adjusting a
 * value and *finding* one. Typing 240, looking, typing 260, looking is a
 * slow loop; dragging while watching the canvas is a fast one, and a motion
 * tool lives or dies on that loop.
 *
 * Details that matter:
 *  - A drag only begins after 3px of movement, so a click still focuses the
 *    input for typing.
 *  - Pointer capture keeps the gesture alive outside the field's bounds.
 *  - Shift scales the step down for fine adjustment.
 *  - While focused the raw string is kept, so typing "-" or "1." does not
 *    get rewritten to 0 mid-keystroke.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 2,
  suffix,
  disabled,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const gesture = useRef<{ startX: number; startValue: number; dragging: boolean } | null>(null);

  const clampTo = useCallback(
    (n: number) => Math.min(max, Math.max(min, n)),
    [min, max],
  );

  const display =
    draft ??
    (Number.isFinite(value)
      ? String(Number(value.toFixed(precision)))
      : "0");

  const onPointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    gesture.current = { startX: event.clientX, startValue: value, dragging: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLInputElement>) => {
    const g = gesture.current;
    if (!g) return;

    const dx = event.clientX - g.startX;
    if (!g.dragging) {
      if (Math.abs(dx) < 3) return;
      g.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "ew-resize";
    }

    const scale = event.shiftKey ? 0.1 : 1;
    onChange(clampTo(g.startValue + dx * step * scale));
  };

  const endGesture = (event: React.PointerEvent<HTMLInputElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;

    if (g.dragging) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      document.body.style.cursor = "";
      onCommit?.();
    } else {
      // A plain click: hand focus to the input so the value can be typed.
      // No select-all - the caret lands where the click put it, like any
      // normal input. Select-all made the first keystroke wipe the value.
      event.currentTarget.focus();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={display}
        className={cn(FIELD_CLASS, "rm-num cursor-ew-resize", suffix && "pr-6", disabled && "opacity-40")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          // A draft exists only once the user has actually typed. Blurring
          // an untouched field must be a no-op: seeding the draft on focus
          // meant a stale snapshot got committed on blur, silently reverting
          // any change made elsewhere (a slider drag, an agent edit) while
          // the field held focus.
          if (draft !== null) {
            const parsed = Number(draft);
            if (Number.isFinite(parsed)) onChange(clampTo(parsed));
            setDraft(null);
            onCommit?.();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
            return;
          }
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
            return;
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const base = draft !== null ? Number(draft) : value;
            if (Number.isFinite(base)) {
              const next = clampTo(base + delta);
              setDraft(String(Number(next.toFixed(precision))));
              onChange(next);
            }
          }
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--rm-text-faint)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Other fields
 * ------------------------------------------------------------------ */

export const TextField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  /** Monospace, for code-like content such as JSON. */
  mono?: boolean;
}> = ({ value, onChange, onCommit, placeholder, multiline, rows = 3, mono }) => {
  if (multiline) {
    return (
      <textarea
        value={value}
        rows={mono ? Math.max(rows, 10) : rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className={cn(
          FIELD_CLASS,
          "h-auto resize-y py-1.5 leading-[1.5]",
          mono && "rm-num text-[11px] leading-[1.6]",
        )}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className={FIELD_CLASS}
    />
  );
};

/**
 * A themed dropdown.
 *
 * A native `<select>` popup is drawn by the OS and cannot be themed - a
 * black system menu in the middle of the inspector reads as a foreign
 * object. This renders its own listbox in a portal (so panel overflow
 * cannot clip it), flips above the trigger when there is no room below,
 * and keeps focus on the trigger so keyboard handling stays in one place.
 */
export const SelectField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; group?: string }[];
}> = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = options.find((o) => o.value === value);

  // Options interleaved with their group headers, in declaration order.
  const items = useMemo(() => {
    const out: (
      | { kind: "header"; label: string }
      | { kind: "option"; option: (typeof options)[number]; index: number }
    )[] = [];
    let lastGroup: string | undefined;
    options.forEach((option, index) => {
      if (option.group && option.group !== lastGroup) {
        out.push({ kind: "header", label: option.group });
      }
      lastGroup = option.group;
      out.push({ kind: "option", option, index });
    });
    return out;
  }, [options]);

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect(r);
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    setOpen(false);
    if (option && option.value !== value) onChange(option.value);
  };

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => Math.min(options.length - 1, Math.max(0, i + delta)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActiveIndex(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(activeIndex);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  // Estimated menu height decides whether it opens downward or flips up.
  const headerCount = items.length - options.length;
  const estimated = Math.min(320, options.length * 26 + headerCount * 22 + 8);
  const placeBelow = rect ? window.innerHeight - rect.bottom - 8 >= Math.min(estimated, 180) : true;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(FIELD_CLASS, "flex cursor-pointer items-center justify-between gap-1.5 text-left")}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className="size-3 shrink-0 text-[var(--rm-text-faint)]" />
      </button>

      {open && rect
        ? createPortal(
            // `rm-editor` re-establishes the chrome tokens: the portal lands
            // on document.body, outside the editor root that defines them,
            // and without it the listbox background resolves to transparent.
            <div className="rm-editor contents">
              {/* Transparent backdrop: any interaction outside closes. */}
              <div
                className="fixed inset-0 z-[70]"
                onPointerDown={() => setOpen(false)}
                onWheel={() => setOpen(false)}
              />
              <div
                ref={listRef}
                role="listbox"
                className="rm-scroll fixed z-[71] overflow-y-auto rounded-[7px] bg-[var(--rm-chrome-low)] py-1 shadow-[0_1px_2px_rgb(0_0_0/0.4),0_12px_32px_-8px_rgb(0_0_0/0.55)]"
                style={{
                  left: rect.left,
                  width: Math.max(rect.width, 150),
                  maxHeight: 320,
                  ...(placeBelow
                    ? { top: rect.bottom + 4 }
                    : { bottom: window.innerHeight - rect.top + 4 }),
                }}
              >
                {items.map((item, i) =>
                  item.kind === "header" ? (
                    <div
                      key={`h-${i}`}
                      className="px-2.5 pb-0.5 pt-2 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--rm-text-faint)]"
                    >
                      {item.label}
                    </div>
                  ) : (
                    <button
                      key={item.option.value}
                      type="button"
                      role="option"
                      aria-selected={item.option.value === value}
                      data-active={item.index === activeIndex || undefined}
                      onPointerEnter={() => setActiveIndex(item.index)}
                      // pointerdown, not click: the backdrop would swallow the
                      // mousedown-mouseup pair before a click could assemble.
                      onPointerDown={(e) => {
                        e.preventDefault();
                        commit(item.index);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-2.5 py-[5px] text-left text-[12px] text-[var(--rm-text)]",
                        item.index === activeIndex && "bg-[var(--rm-chrome-high)]",
                      )}
                    >
                      <span className="truncate">{item.option.label}</span>
                      {item.option.value === value ? (
                        <Check className="size-3 shrink-0 text-[var(--rm-accent)]" />
                      ) : null}
                    </button>
                  ),
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export const ColorField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
}> = ({ value, onChange, onCommit }) => (
  <div className="flex items-center gap-1.5">
    <div className="relative size-7 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-inset ring-[var(--rm-line-strong)]">
      <div className="absolute inset-0" style={{ background: value }} />
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Colour"
      />
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className={cn(FIELD_CLASS, "rm-num font-mono text-[11px] uppercase")}
      spellCheck={false}
    />
  </div>
);

export const SliderField: React.FC<{
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}> = ({ value, onChange, onCommit, min = 0, max = 1, step = 0.01, precision = 2 }) => (
  <div className="grid grid-cols-[1fr_56px] items-center gap-2">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      className="rm-range w-full cursor-pointer"
      style={{
        // Drives the filled portion of the custom track - see globals.css §7.
        ["--rm-range-fill" as never]: `${((value - min) / Math.max(1e-9, max - min)) * 100}%`,
      }}
    />
    <NumberField
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      min={min}
      max={max}
      step={step}
      precision={precision}
    />
  </div>
);

export const ToggleField: React.FC<{
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={label}
    onClick={() => onChange(!value)}
    className={cn(
      "relative h-[18px] w-[30px] rounded-full transition-colors duration-150",
      value ? "bg-[var(--rm-accent)]" : "bg-[var(--rm-chrome-high)]",
    )}
  >
    <span
      className={cn(
        "absolute top-[3px] size-3 rounded-full bg-white transition-transform duration-150",
        value ? "translate-x-[15px]" : "translate-x-[3px]",
      )}
    />
  </button>
);

/** Segmented control. Used where a select would hide two or three options. */
export function SegmentedField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
}) {
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-[5px] bg-[var(--rm-chrome-high)] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-6 flex-1 items-center justify-center rounded-[3px] text-[11px] transition-colors duration-100",
            value === option.value
              ? "bg-[var(--rm-chrome-low)] text-[var(--rm-text)]"
              : "text-[var(--rm-text-dim)] hover:text-[var(--rm-text)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Small icon button used throughout the editor chrome.
 *
 * `active` is a distinct state from hover: it marks a persistent toggle
 * (safe areas on, panel open), and it uses the accent so the user can see
 * current state at a glance across a dense toolbar.
 */
export const IconButton: React.FC<{
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, title, active, disabled, danger, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    className={cn(
      "grid size-7 shrink-0 place-items-center rounded-[5px] transition-colors duration-100",
      "text-[var(--rm-text-dim)] hover:bg-[var(--rm-chrome-high)] hover:text-[var(--rm-text)]",
      active && "bg-[var(--rm-accent-dim)] text-[var(--rm-accent)] hover:bg-[var(--rm-accent-dim)]",
      danger && "hover:bg-[color-mix(in_oklch,var(--rm-danger),transparent_82%)] hover:text-[var(--rm-danger)]",
      disabled && "pointer-events-none opacity-30",
      className,
    )}
  >
    {children}
  </button>
);

/**
 * The empty state shown by every panel with nothing in it.
 *
 * Centralised so "no assets yet" and "nothing selected" look like the same
 * product. An unstyled blank panel is the single fastest way to make an
 * application feel unfinished.
 */
export const EmptyState: React.FC<{
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, hint, icon, action }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
    {icon ? <div className="mb-3 text-[var(--rm-text-faint)]">{icon}</div> : null}
    <p className="text-[12px] text-[var(--rm-text-dim)]">{title}</p>
    {hint ? (
      <p className="mt-1 max-w-[220px] text-[11px] leading-[1.5] text-[var(--rm-text-faint)]">
        {hint}
      </p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

/** Focus an element when it mounts. Used by dialogs and the palette. */
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
