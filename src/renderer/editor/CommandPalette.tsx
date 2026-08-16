/**
 * The command palette.
 *
 * Commands are supplied by the shell rather than assembled here, so the
 * palette and the keyboard shortcuts execute literally the same functions.
 * A palette that reimplements what a shortcut does is a palette that
 * silently drifts out of step with it.
 *
 * Matching is a subsequence test, not a substring one: "rf" should find
 * "Render final". Results are ranked by how tightly the match clusters, so
 * an exact prefix beats letters scattered across a long label.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { formatKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

export interface Command {
  id: string;
  label: string;
  group: string;
  keys?: string;
  run: () => void;
  disabled?: boolean;
}

export const CommandPalette: React.FC<{
  open: boolean;
  commands: Command[];
  onClose: () => void;
}> = ({ open, commands, onClose }) => {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      // Focus after paint; focusing during the same tick loses to the
      // element that was focused when the palette opened.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => rank(commands, query), [commands, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  // Keep the active row in view when navigating with the keyboard.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const runAt = (i: number) => {
    const command = results[i];
    if (!command || command.disabled) return;
    onClose();
    command.run();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh]"
      onPointerDown={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-label="Command palette"
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "relative w-[560px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[10px]",
          "bg-[var(--rm-chrome)] shadow-[0_32px_80px_-16px_rgb(0_0_0/0.7)]",
          "ring-1 ring-[var(--rm-line-strong)]",
        )}
        style={{ animation: "fly-and-scale 160ms cubic-bezier(0.33, 1, 0.68, 1)" }}
      >
        <div className="rm-hairline-b flex h-11 items-center gap-2 px-3">
          <Search className="size-4 shrink-0 text-[var(--rm-text-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands"
            spellCheck={false}
            className="h-full flex-1 bg-transparent text-[13px] text-[var(--rm-text)] outline-none placeholder:text-[var(--rm-text-faint)]"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(index);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          />
        </div>

        <div ref={listRef} className="rm-scroll max-h-[380px] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--rm-text-faint)]">
              No commands match "{query}"
            </p>
          ) : (
            results.map((command, i) => (
              <button
                key={command.id}
                type="button"
                data-active={i === index}
                disabled={command.disabled}
                onPointerEnter={() => setIndex(i)}
                onClick={() => runAt(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[6px] px-2.5 py-2 text-left transition-colors duration-75",
                  i === index && "bg-[var(--rm-accent-dim)]",
                  command.disabled && "opacity-35",
                )}
              >
                <span className="w-[92px] shrink-0 truncate text-[10px] uppercase tracking-[0.1em] text-[var(--rm-text-faint)]">
                  {command.group}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--rm-text)]">
                  {command.label}
                </span>
                {command.keys ? (
                  <kbd className="shrink-0 rounded-[4px] bg-[var(--rm-chrome-high)] px-1.5 py-0.5 text-[10px] text-[var(--rm-text-dim)]">
                    {formatKeys(command.keys)}
                  </kbd>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Subsequence match with a locality score.
 *
 * `score` is the sum of gaps between matched characters; lower is better. A
 * contiguous match scores 0, so "render" ranks "Render final" above
 * "Reveal project folder" even though both contain the letters in order.
 */
function rank(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;

  const scored: { command: Command; score: number }[] = [];

  for (const command of commands) {
    const haystack = `${command.group} ${command.label}`.toLowerCase();
    let cursor = 0;
    let score = 0;
    let matched = true;

    for (const char of q) {
      const found = haystack.indexOf(char, cursor);
      if (found === -1) {
        matched = false;
        break;
      }
      score += found - cursor;
      cursor = found + 1;
    }

    if (matched) scored.push({ command, score });
  }

  return scored.sort((a, b) => a.score - b.score).map((s) => s.command);
}
