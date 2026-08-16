/**
 * Theme context.
 *
 * Every component reads its colours from here rather than taking them as
 * props with hard-coded defaults. That is what makes a theme a *theme*: one
 * change restyles the whole film, instead of an agent having to set `accent`
 * on forty layers and getting one of them wrong.
 *
 * Explicit props still win. An agent that deliberately wants a red callout
 * in a blue film sets `accent` on that layer and it is honoured - the theme
 * supplies the default, not the law.
 */

import React, { createContext, useContext, useMemo } from "react";
import { DEFAULT_THEME, resolveTheme } from "./themes.js";
import { DEFAULT_GRID, type GridSpec } from "./layout";

export interface Theme {
  name: string;
  description: string;
  background: string;
  accent: string;
  accentSoft: string;
  text: string;
  textDim: string;
  textFaint: string;
  panel: string;
  panelEdge: string;
  surface: string;
  isLight?: boolean;
  glass?: boolean;
  backdrop: Record<string, number | boolean>;
}

const ThemeContext = createContext<Theme>(resolveTheme(DEFAULT_THEME) as Theme);
const GridContext = createContext<GridSpec>(DEFAULT_GRID);

export const useTheme = (): Theme => useContext(ThemeContext);
export const useGrid = (): GridSpec => useContext(GridContext);

export const ThemeProvider: React.FC<{
  preset?: string;
  overrides?: Partial<Theme>;
  grid?: GridSpec;
  children: React.ReactNode;
}> = ({ preset, overrides, grid, children }) => {
  const theme = useMemo(
    () => resolveTheme(preset, overrides) as Theme,
    [preset, overrides],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <GridContext.Provider value={grid ?? DEFAULT_GRID}>{children}</GridContext.Provider>
    </ThemeContext.Provider>
  );
};

/**
 * Prefer an explicit value, fall back to the theme.
 *
 * Written as a helper rather than `prop ?? theme.x` at each call site because
 * the empty string matters: the inspector and the MCP schema both produce
 * `""` for "not set", and `??` would treat that as a deliberate choice and
 * render invisible text.
 */
export function themed<T>(explicit: T | undefined | null | "", fallback: T): T {
  if (explicit === undefined || explicit === null || explicit === "") return fallback;
  return explicit;
}
