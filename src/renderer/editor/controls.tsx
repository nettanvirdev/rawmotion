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

import React, { useCallback, useEffect, useRef, useState } from "react";
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
      event.currentTarget.focus();
      event.currentTarget.select();
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
        onFocus={() => setDraft(display)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
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
}> = ({ value, onChange, onCommit, placeholder, multiline, rows = 3 }) => {
  if (multiline) {
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className={cn(FIELD_CLASS, "h-auto resize-y py-1.5 leading-[1.5]")}
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

export const SelectField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; group?: string }[];
}> = ({ value, onChange, options }) => {
  const groups = new Map<string, typeof options>();
  for (const option of options) {
    const key = option.group ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(option);
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD_CLASS, "cursor-pointer appearance-none pr-6")}
      style={{
        // A native arrow would render in the OS accent and break the panel.
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='rgb(255 255 255 / 0.45)' stroke-width='1.4' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 7px center",
      }}
    >
      {[...groups.entries()].map(([group, items]) =>
        group ? (
          <optgroup key={group} label={group}>
            {items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : (
          items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        ),
      )}
    </select>
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
      className="h-7 w-full cursor-pointer accent-[var(--rm-accent)]"
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
