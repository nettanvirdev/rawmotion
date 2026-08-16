import { useCallback, useEffect, useState } from "react";

/**
 * Theme state lives on <html> as classes: `dark`, `oled`, `high-contrast`.
 * index.html applies the stored value before first paint, so this module
 * only ever has to keep the DOM and localStorage in sync afterwards.
 */

export const THEME_KEY = "rawmotion.theme"; // "light" | "dark" | "oled"
export const CONTRAST_KEY = "rawmotion.highContrast";
export const TEXT_SCALE_KEY = "rawmotion.textScale";

const THEMES = ["light", "dark", "oled"];

export function readTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  return THEMES.includes(stored) ? stored : "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark" || theme === "oled");
  root.classList.toggle("oled", theme === "oled");
  localStorage.setItem(THEME_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState(readTheme);

  const setTheme = useCallback((next) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  return { theme, setTheme, toggle, isDark: theme !== "light" };
}

/** Root-level UI scale. Rescales the whole rem-based system. */
export function useTextScale() {
  const [scale, setScaleState] = useState(() => {
    const stored = Number(localStorage.getItem(TEXT_SCALE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 1;
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--app-text-scale", scale);
    localStorage.setItem(TEXT_SCALE_KEY, String(scale));
  }, [scale]);

  return [scale, setScaleState];
}
