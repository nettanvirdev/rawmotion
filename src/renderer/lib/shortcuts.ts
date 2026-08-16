/**
 * Central keyboard shortcut registry.
 *
 * One listener on `window`, one table of bindings. The alternative - a
 * `keydown` handler in each component that needs one - is how editors end up
 * with Space doing two different things depending on focus, and with no way
 * to show the user what their keys do. Because everything is declared here,
 * the command palette can enumerate bindings and render their key hints
 * without a second source of truth.
 *
 * A binding is matched against a normalised description of the event, so
 * `"mod+z"` means Cmd on macOS and Ctrl elsewhere without any per-platform
 * branching at the call sites.
 */

import { useEffect } from "react";

export interface Binding {
  /** e.g. "mod+z", "shift+mod+z", "space", "j", "arrowleft". */
  keys: string;
  run: (event: KeyboardEvent) => void;
  /** Fire even when a text field has focus. Off by default. */
  allowInInput?: boolean;
  /** Skip `preventDefault`. Rare - only for keys the browser must still see. */
  passive?: boolean;
}

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Turn a KeyboardEvent into the canonical string a binding is written as.
 *
 * Modifier order is fixed (mod, alt, shift) so `"shift+mod+z"` and
 * `"mod+shift+z"` both normalise to the same thing via `normalizeBinding`.
 */
function describe(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (IS_MAC ? event.metaKey : event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");

  const key = event.key.toLowerCase();
  // Space arrives as " ", which is unusable in a binding string.
  parts.push(key === " " ? "space" : key);
  return parts.join("+");
}

function normalizeBinding(keys: string): string {
  const parts = keys.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  const mods = new Set(parts);
  const ordered: string[] = [];
  if (mods.has("mod") || mods.has("cmd") || mods.has("ctrl")) ordered.push("mod");
  if (mods.has("alt") || mods.has("option")) ordered.push("alt");
  if (mods.has("shift")) ordered.push("shift");
  ordered.push(key);
  return ordered.join("+");
}

/**
 * Whether the event originated in something the user is typing into.
 *
 * `isContentEditable` matters as much as the tag check - the code panel and
 * any rich text field would otherwise lose every keystroke that collides
 * with a shortcut.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Bind a set of shortcuts for the lifetime of the calling component.
 *
 * `bindings` is re-read on every keystroke through a ref-like closure, so
 * handlers may close over current state without the caller having to
 * memoise them.
 */
export function useShortcuts(bindings: Binding[], enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const table = new Map<string, Binding>();
    for (const binding of bindings) {
      table.set(normalizeBinding(binding.keys), binding);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Autorepeat would fire "next frame" dozens of times from one held key
      // for non-navigation bindings; arrows deliberately opt back in below.
      const binding = table.get(describe(event));
      if (!binding) return;
      if (!binding.allowInInput && isTypingTarget(event.target)) return;

      if (!binding.passive) event.preventDefault();
      binding.run(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, enabled]);
}

/** Render a binding for display, e.g. "mod+shift+z" -> "⇧⌘Z". */
export function formatKeys(keys: string): string {
  const parts = normalizeBinding(keys).split("+");
  const key = parts.pop() ?? "";

  const mods = parts
    .map((part) => {
      if (part === "mod") return IS_MAC ? "⌘" : "Ctrl";
      if (part === "alt") return IS_MAC ? "⌥" : "Alt";
      if (part === "shift") return IS_MAC ? "⇧" : "Shift";
      return part;
    })
    // macOS convention orders modifiers ⌃⌥⇧⌘; with only these three the
    // display order is the reverse of the match order.
    .reverse();

  const label = KEY_LABELS[key] ?? key.toUpperCase();
  return IS_MAC ? [...mods, label].join("") : [...mods, label].join("+");
}

const KEY_LABELS: Record<string, string> = {
  space: "Space",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  enter: "↵",
  escape: "Esc",
  backspace: "⌫",
  delete: "Del",
  home: "Home",
  end: "End",
};
