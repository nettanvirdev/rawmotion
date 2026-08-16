/**
 * The explainer vocabulary.
 *
 * These are the components a technical video actually needs: code, a
 * terminal, a file tree, a flow diagram, a chapter card. They exist because
 * "make a video explaining this codebase" is a request the engine should be
 * able to satisfy with composition rather than with improvisation - an agent
 * choosing between eight well-made components produces better work than an
 * agent inventing a code block out of shapes and text layers.
 *
 * Every one is driven entirely by serialisable props, so it can be written
 * into `project.json` by an agent and edited afterwards in the inspector.
 *
 * Shared conventions:
 *  - Content reveals top-down on a stagger, never all at once.
 *  - Panels have a 1px inner highlight on the top edge; that is the only
 *    "glass" cue used, and it is what stops a dark panel on a dark
 *    background reading as a hole.
 *  - Nothing uses pure black or pure white. #06060a and #eef0f6.
 */

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { codeColors, type Language, languageForFile, tokenizeBlock } from "./highlight";
import { DISPLAY_FONT, MONO_FONT, MaskedLines, TypeOn } from "./text";
import { EASINGS, mix, oscillate, progress, springProgress, staggerDelay } from "./timing";
import { themed, useTheme } from "./theme";

/**
 * Fallbacks only. Every component below reads these from the theme instead,
 * so a theme change restyles the whole film. They exist for the case where a
 * component is mounted outside a ThemeProvider - a unit test, or a
 * Storybook-style preview.
 */
const PANEL_BG = "#0d0f16";
const PANEL_EDGE = "rgb(255 255 255 / 0.07)";
const TEXT = "#eef0f6";
const TEXT_DIM = "#8990a4";


/**
 * Split a multiline prop into lines.
 *
 * Accepts a literal backslash-n as well as a real newline. That is not
 * sloppiness: these props are written into `project.json` by language
 * models, and over-escaping `\n` into `\\n` is the single most common
 * mistake they make when emitting JSON. The alternative to accepting it is a
 * video with `\n` printed across the middle of the frame, which is a much
 * worse failure than being lenient here.
 */
function splitLines(value: string): string[] {
  return String(value)
    .replace(/\\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

/** The panel treatment shared by CodeBlock, Terminal and FileTree. */
function panelStyle(
  radius = 14,
  theme?: { panel: string; panelEdge: string; isLight?: boolean; glass?: boolean },
): React.CSSProperties {
  // A frosted panel needs a real backdrop blur and a much softer, wider
  // shadow. The dark treatment's near-opaque fill and hard 0.75 shadow read
  // as a floating black rectangle on a light ground.
  if (theme?.glass) {
    return {
      background: theme.panel,
      borderRadius: radius * 1.8,
      backdropFilter: "blur(40px) saturate(180%)",
      WebkitBackdropFilter: "blur(40px) saturate(180%)",
      boxShadow: [
        `inset 0 1px 0 0 ${theme.panelEdge}`,
        "inset 0 0 0 1px rgb(255 255 255 / 0.5)",
        "0 2px 8px -2px rgb(0 0 0 / 0.06)",
        "0 24px 60px -18px rgb(0 0 0 / 0.16)",
      ].join(", "),
      overflow: "hidden",
    };
  }

  return {
    background: theme?.panel ?? PANEL_BG,
    borderRadius: radius,
    boxShadow: [
      `inset 0 1px 0 0 rgb(255 255 255 / ${theme?.isLight ? 0.9 : 0.08})`,
      `inset 0 0 0 1px ${theme?.panelEdge ?? PANEL_EDGE}`,
      theme?.isLight
        ? "0 20px 50px -18px rgb(0 0 0 / 0.18)"
        : "0 40px 90px -24px rgb(0 0 0 / 0.75)",
    ].join(", "),
    overflow: "hidden",
  };
}

/** Traffic-light dots. Signals "this is a window" in three small circles. */
const WindowDots: React.FC = () => (
  <div style={{ display: "flex", gap: 7 }}>
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.9 }} />
    ))}
  </div>
);

/* ------------------------------------------------------------------ *
 * CodeBlock
 * ------------------------------------------------------------------ */

export interface CodeBlockProps {
  code?: string;
  /** Sets both the window title and, unless overridden, the language. */
  filename?: string;
  language?: Language | "auto";
  fontSize?: number;
  /** Frames between consecutive lines appearing. 0 shows the block at once. */
  lineStagger?: number;
  delay?: number;
  showLineNumbers?: boolean;
  /**
   * 1-based lines to emphasise, as "12" or "12-18" or "3,12-18". Everything
   * else dims. This is the single most useful thing a code component can do
   * in a video: it directs the eye instead of asking the viewer to scan.
   */
  focusLines?: string;
  /** Frame at which the focus dim animates in. */
  focusAt?: number;
  width?: number;
  maxLines?: number;
}

/**
 * A code window.
 *
 * Two devices carry the explanation: lines arrive on a stagger so the reader
 * follows the code being written rather than meeting a wall of it, and
 * `focusLines` dims everything else so attention lands where the narration
 * is. Both are timing-driven, so an agent can sequence "show the file, then
 * highlight the important part" from props alone.
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code = "",
  filename = "",
  language = "auto",
  fontSize = 22,
  lineStagger = 1.4,
  delay = 0,
  showLineNumbers = true,
  focusLines = "",
  focusAt = 0,
  width = 900,
  maxLines = 0,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();

  const palette = codeColors(theme.isLight);

  const resolved: Language =
    language === "auto" ? (filename ? languageForFile(filename) : "ts") : language;

  const lines = useMemo(() => {
    const all = tokenizeBlock(String(code).replace(/\\n/g, "\n"), resolved);
    return maxLines > 0 ? all.slice(0, maxLines) : all;
  }, [code, resolved, maxLines]);

  const focus = useMemo(() => parseLineSpec(focusLines), [focusLines]);
  const focusT = focus.size ? progress(frame, focusAt, 20, EASINGS.outExpo) : 0;

  const lineHeight = fontSize * 1.62;
  const gutter = showLineNumbers ? fontSize * 2.4 : 0;

  return (
    <div style={{ ...panelStyle(14, theme), width, fontFamily: MONO_FONT }}>
      {filename ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: `${fontSize * 0.62}px ${fontSize * 0.8}px`,
            background: theme.surface,
            boxShadow: `inset 0 -1px 0 0 ${theme.panelEdge}`,
          }}
        >
          <WindowDots />
          <span style={{ fontSize: fontSize * 0.74, color: theme.textDim, letterSpacing: "0.01em" }}>
            {filename}
          </span>
        </div>
      ) : null}

      {/* A line longer than the panel is clipped by the panel's overflow,
          which cuts a glyph in half and reads as a rendering fault. Fading
          the last 56px makes the clip deliberate - the standard treatment
          for truncated code. */}
      <div
        style={{
          padding: `${fontSize * 0.9}px ${fontSize * 0.8}px`,
          maskImage: "linear-gradient(to right, black calc(100% - 56px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black calc(100% - 56px), transparent 100%)",
        }}
      >
        {lines.map((tokens, i) => {
          const start = delay + i * lineStagger;
          const t = lineStagger > 0 ? progress(frame, start, 16, EASINGS.outExpo) : 1;

          // Dim non-focused lines rather than hiding them: the shape of the
          // surrounding code is context the reader needs.
          const dim = focus.size && !focus.has(i + 1) ? mix(focusT, 1, 0.26) : 1;
          const lift = focus.size && focus.has(i + 1) ? focusT : 0;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                minHeight: lineHeight,
                lineHeight: `${lineHeight}px`,
                opacity: t * dim,
                transform: `translateX(${mix(t, -8, 0)}px)`,
                background: lift
                  ? `rgb(139 155 255 / ${(0.07 * lift).toFixed(3)})`
                  : undefined,
                marginLeft: -fontSize * 0.8,
                marginRight: -fontSize * 0.8,
                paddingLeft: fontSize * 0.8,
                paddingRight: fontSize * 0.8,
              }}
            >
              {showLineNumbers ? (
                <span
                  style={{
                    width: gutter,
                    flexShrink: 0,
                    color: theme.textFaint,
                    fontSize: fontSize * 0.85,
                    textAlign: "right",
                    paddingRight: fontSize * 0.7,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i + 1}
                </span>
              ) : null}

              <span style={{ fontSize, whiteSpace: "pre", color: palette.plain }}>
                {tokens.map((token, j) => (
                  <span key={j} style={{ color: palette[token.kind] }}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Parse "3,12-18" into a set of 1-based line numbers. */
function parseLineSpec(spec: string): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;

  for (const part of spec.split(",")) {
    const range = part.trim().split("-").map((n) => Number(n.trim()));
    if (range.length === 2 && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
      for (let i = range[0]; i <= range[1]; i += 1) out.add(i);
    } else if (Number.isFinite(range[0])) {
      out.add(range[0]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Terminal
 * ------------------------------------------------------------------ */

export interface TerminalProps {
  command?: string;
  /** Printed after the command finishes typing. One line per newline. */
  output?: string;
  prompt?: string;
  fontSize?: number;
  width?: number;
  delay?: number;
  /** Characters per second. */
  typeSpeed?: number;
  title?: string;
}

/**
 * A terminal typing a command, then printing its output.
 *
 * Output timing is derived from the command's length rather than configured
 * separately, so changing the command cannot leave the output appearing
 * before the command has finished being typed.
 */
export const Terminal: React.FC<TerminalProps> = ({
  command = "npm run render",
  output = "",
  prompt = "$",
  fontSize = 22,
  width = 860,
  delay = 0,
  typeSpeed = 30,
  title = "zsh",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const typingFrames = (command.length / typeSpeed) * fps;
  const outputStart = delay + typingFrames + fps * 0.35;
  const outputLines = output ? String(output).replace(/\\n/g, "\n").split("\n") : [];

  return (
    <div style={{ ...panelStyle(14, theme), width, fontFamily: MONO_FONT }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: `${fontSize * 0.62}px ${fontSize * 0.8}px`,
          background: theme.surface,
          boxShadow: `inset 0 -1px 0 0 ${theme.panelEdge}`,
        }}
      >
        <WindowDots />
        <span style={{ fontSize: fontSize * 0.74, color: theme.textDim }}>{title}</span>
      </div>

      <div style={{ padding: fontSize, fontSize, lineHeight: 1.65 }}>
        <div style={{ display: "flex", gap: "0.6em", color: theme.text }}>
          <span style={{ color: theme.accent }}>{prompt}</span>
          <TypeOn text={command} delay={delay} speed={typeSpeed} style={{ color: theme.text }} />
        </div>

        {outputLines.map((line, i) => {
          const start = outputStart + i * 2.5;
          const t = progress(frame, start, 10, EASINGS.outExpo);
          return (
            <div
              key={i}
              style={{
                color: theme.textDim,
                opacity: t,
                transform: `translateY(${mix(t, 4, 0)}px)`,
                whiteSpace: "pre-wrap",
              }}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * FileTree
 * ------------------------------------------------------------------ */

export interface FileTreeProps {
  /**
   * One entry per line. Leading spaces set depth (two per level). A trailing
   * `/` marks a directory. Append ` *` to highlight the entry.
   *
   *   src/
   *     motion/
   *       timing.ts *
   */
  tree?: string;
  fontSize?: number;
  delay?: number;
  stagger?: number;
  accent?: string;
  width?: number;
  title?: string;
}

/**
 * An indented project tree.
 *
 * The plain-text format is the point: an agent writes the tree the way it
 * would type it, and a human editing it later in the inspector sees the same
 * thing. A nested JSON structure would be more "correct" and much worse to
 * author from either side.
 */
export const FileTree: React.FC<FileTreeProps> = ({
  tree = "src/\n  motion/\n    timing.ts *\n  shared/\n    project.js",
  fontSize = 24,
  delay = 0,
  stagger = 2.5,
  accent,
  width = 520,
  title = "",
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  const rows = useMemo(
    () =>
      splitLines(tree)
        .map((line) => {
          const depth = Math.floor((line.length - line.trimStart().length) / 2);
          let name = line.trim();
          const highlighted = name.endsWith("*");
          if (highlighted) name = name.slice(0, -1).trim();
          return { depth, name, highlighted, isDir: name.endsWith("/") };
        }),
    [tree],
  );

  return (
    <div style={{ ...panelStyle(14, theme), width, fontFamily: MONO_FONT, padding: fontSize * 0.9 }}>
      {title ? (
        <div
          style={{
            fontSize: fontSize * 0.68,
            color: theme.textDim,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: fontSize * 0.7,
          }}
        >
          {title}
        </div>
      ) : null}

      {rows.map((row, i) => {
        const start = delay + staggerDelay(i, rows.length, stagger, stagger * 8);
        const t = progress(frame, start, 18, EASINGS.outExpo);

        return (
          <div
            key={`${row.name}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: fontSize * 0.4,
              paddingLeft: row.depth * fontSize * 1.05,
              minHeight: fontSize * 1.7,
              opacity: t,
              transform: `translateX(${mix(t, -10, 0)}px)`,
            }}
          >
            <span
              style={{
                width: fontSize * 0.42,
                height: fontSize * 0.42,
                borderRadius: row.isDir ? 3 : "50%",
                background: row.highlighted ? tint : theme.textFaint,
                boxShadow: row.highlighted ? `0 0 ${fontSize * 0.7}px ${tint}` : undefined,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize,
                color: row.highlighted ? theme.text : row.isDir ? theme.text : theme.textDim,
              }}
            >
              {row.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * DiagramFlow
 * ------------------------------------------------------------------ */

export interface DiagramFlowProps {
  /** One node per line. `>` at the start marks it as the emphasised node. */
  nodes?: string;
  direction?: "vertical" | "horizontal";
  accent?: string;
  fontSize?: number;
  delay?: number;
  nodeWidth?: number;
  gap?: number;
  /** Node silhouette. */
  shape?: "rounded" | "pill" | "square";
  /** Connector treatment. */
  connector?: "line" | "arrow" | "dotted";
  /** Node surface treatment. */
  tone?: "frosted" | "filled" | "outline";
  /** Frames per build step - lower is snappier. */
  beat?: number;
  /** Light pulse travelling the connectors after the build settles. Accepts "on"/"off". */
  pulse?: boolean | string;
}

/**
 * A chain of nodes joined by connectors that draw themselves.
 *
 * The build is traced in reading order - node, connector, node - with each
 * node settling on a spring as its connector arrives, so the diagram reads
 * as a process being followed rather than a picture appearing. After the
 * build, a soft light pulse travels the connectors and the emphasised node
 * breathes; a diagram on screen for ten seconds must not be a freeze-frame.
 *
 * Surfaces follow the panel language: frosted on light themes, quiet fills
 * on dark ones, and *no drop shadows* - depth belongs to the backdrop.
 */
export const DiagramFlow: React.FC<DiagramFlowProps> = ({
  nodes = "Prompt\nProject model\nComposition\nMP4",
  direction = "vertical",
  accent,
  fontSize = 26,
  delay = 0,
  nodeWidth = 340,
  gap = 40,
  shape = "rounded",
  connector = "line",
  tone = "frosted",
  beat = 12,
  pulse = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const light = Boolean(theme.isLight || theme.glass);

  const items = useMemo(
    () =>
      splitLines(nodes)
        .map((line) => {
          const emphasised = line.trimStart().startsWith(">");
          return { label: line.replace(/^\s*>\s*/, "").trim(), emphasised };
        }),
    [nodes],
  );

  const vertical = direction === "vertical";
  const stepBeat = Math.max(4, beat);
  const radius = shape === "pill" ? 999 : shape === "square" ? 8 : 14;
  const builtAt = delay + items.length * stepBeat * 2;

  const surfaceFor = (emphasised: boolean): React.CSSProperties => {
    if (emphasised && tone !== "outline") {
      return {
        color: light ? theme.text : theme.text,
        background: `linear-gradient(160deg, ${tint}${light ? "2e" : "38"}, ${tint}12)`,
        boxShadow: `inset 0 0 0 1.5px ${tint}${light ? "55" : "66"}`,
      };
    }
    switch (tone) {
      case "filled":
        return {
          color: theme.textDim,
          background: theme.panel,
          boxShadow: `inset 0 0 0 1px ${theme.panelEdge}`,
        };
      case "outline":
        return {
          color: emphasised ? theme.text : theme.textDim,
          background: "transparent",
          boxShadow: `inset 0 0 0 1.5px ${emphasised ? tint : theme.panelEdge}`,
        };
      default:
        // Frosted: the Callout pane language, scaled down to a node.
        return light
          ? {
              color: theme.textDim,
              background: "linear-gradient(180deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.58))",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.95)",
              backdropFilter: "blur(24px) saturate(150%)",
              WebkitBackdropFilter: "blur(24px) saturate(150%)",
            }
          : {
              color: theme.textDim,
              background: `linear-gradient(180deg, ${theme.surface}, rgb(255 255 255 / 0.02))`,
              boxShadow: `inset 0 0 0 1px ${theme.panelEdge}`,
            };
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        gap: 0,
        fontFamily: DISPLAY_FONT,
      }}
    >
      {items.map((item, i) => {
        const nodeStart = delay + i * stepBeat * 2;
        const t = progress(frame, nodeStart, 18, EASINGS.outExpo);
        const s = springProgress(frame, fps, nodeStart, "crisp");
        const connectorT = progress(frame, nodeStart + stepBeat, stepBeat + 4, EASINGS.outExpo);

        // The emphasised node breathes once built - a slow, small ring
        // swell, never a shadow.
        const breathe =
          item.emphasised && frame > builtAt
            ? 1 + oscillate(frame - builtAt, fps * 3.2) * 0.015
            : 1;

        // A pulse of light glides along each connector on a shared period,
        // offset per segment so the energy visibly travels the chain.
        const period = fps * 2.6;
        const doPulse = pulse !== false && pulse !== "off";
        const pulseT = doPulse && frame > builtAt
          ? ((frame - builtAt + i * (period / Math.max(1, items.length - 1))) % period) / period
          : -1;

        return (
          <React.Fragment key={`${item.label}-${i}`}>
            <div
              style={{
                // Both orientations use the full nodeWidth. Letting
                // horizontal nodes shrink to their text produced a diagram
                // that occupied a third of the frame and read as an
                // afterthought.
                width: nodeWidth,
                padding: `${fontSize * 0.72}px ${fontSize}px`,
                borderRadius: radius,
                textAlign: "center",
                fontSize,
                letterSpacing: "-0.01em",
                fontWeight: item.emphasised ? 600 : 500,
                ...surfaceFor(item.emphasised),
                opacity: t,
                transform: `translateY(${mix(s, 16, 0)}px) scale(${mix(s, 0.94, 1) * breathe})`,
              }}
            >
              {item.label}
            </div>

            {i < items.length - 1 ? (
              <Connector
                vertical={vertical}
                gap={gap}
                tint={tint}
                kind={connector}
                t={connectorT}
                pulseT={pulseT}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** A connector segment: drawn line, optional arrowhead, travelling pulse. */
const Connector: React.FC<{
  vertical: boolean;
  gap: number;
  tint: string;
  kind: "line" | "arrow" | "dotted";
  t: number;
  /** 0..1 position of the light pulse, or negative for none. */
  pulseT: number;
}> = ({ vertical, gap, tint, kind, t, pulseT }) => {
  const along = vertical ? gap : gap;
  const arrow = kind === "arrow" ? Math.min(8, gap * 0.25) : 0;

  const lineStyle: React.CSSProperties = {
    position: "absolute",
    ...(vertical
      ? { left: "50%", top: 0, width: 2, height: along - arrow, transform: `translateX(-50%) scaleY(${t})`, transformOrigin: "top center" }
      : { top: "50%", left: 0, height: 2, width: along - arrow, transform: `translateY(-50%) scaleX(${t})`, transformOrigin: "left center" }),
    background:
      kind === "dotted"
        ? `repeating-linear-gradient(${vertical ? "to bottom" : "to right"}, ${tint}aa 0 4px, transparent 4px 10px)`
        : `linear-gradient(${vertical ? "to bottom" : "to right"}, ${tint}88, ${tint}44)`,
    borderRadius: 2,
  };

  return (
    <div
      style={{
        position: "relative",
        width: vertical ? 16 : along,
        height: vertical ? along : 16,
        flexShrink: 0,
      }}
    >
      <div style={lineStyle} />

      {arrow > 0 && t > 0.85 ? (
        <div
          style={{
            position: "absolute",
            ...(vertical
              ? { left: "50%", bottom: 0, transform: "translateX(-50%)" }
              : { top: "50%", right: 0, transform: "translateY(-50%) rotate(-90deg)" }),
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `${arrow}px solid ${tint}aa`,
            opacity: progress(t, 0.85, 0.15, "linear"),
          }}
        />
      ) : null}

      {pulseT >= 0 && pulseT <= 1 ? (
        <div
          style={{
            position: "absolute",
            ...(vertical
              ? { left: "50%", top: `${pulseT * 100}%`, transform: "translate(-50%, -50%)" }
              : { top: "50%", left: `${pulseT * 100}%`, transform: "translate(-50%, -50%)" }),
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: tint,
            opacity: 0.8 * Math.sin(Math.PI * pulseT),
            filter: "blur(1px)",
          }}
        />
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Chapter
 * ------------------------------------------------------------------ */

export interface ChapterProps {
  number?: string;
  title?: string;
  subtitle?: string;
  accent?: string;
  size?: number;
}

/**
 * A section card: index, rule, title, subtitle.
 *
 * Chapter cards are what give a long explainer structure. Without them a
 * six-minute video is an undifferentiated stream; with them the viewer knows
 * where they are and that there is an end.
 */
export const Chapter: React.FC<ChapterProps> = ({
  number = "01",
  title = "Architecture",
  subtitle = "",
  accent,
  size = 96,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const rule = progress(frame, 6, 34, EASINGS.outExpo);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.22, fontFamily: DISPLAY_FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.26 }}>
        <span
          style={{
            fontSize: size * 0.3,
            fontWeight: 500,
            letterSpacing: "0.2em",
            color: tint,
            fontVariantNumeric: "tabular-nums",
            opacity: progress(frame, 0, 20, EASINGS.outExpo),
          }}
        >
          {number}
        </span>
        <div
          style={{
            height: 1,
            width: size * 1.6,
            background: `linear-gradient(to right, ${tint}, transparent)`,
            transform: `scaleX(${rule})`,
            transformOrigin: "left center",
          }}
        />
      </div>

      <MaskedLines
        text={title}
        delay={8}
        duration={30}
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.04,
          color: theme.text,
        }}
      />

      {subtitle ? (
        <MaskedLines
          text={subtitle}
          delay={18}
          duration={26}
          style={{
            fontSize: size * 0.24,
            fontWeight: 400,
            lineHeight: 1.45,
            color: theme.textDim,
          }}
        />
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Callout
 * ------------------------------------------------------------------ */

export interface CalloutProps {
  label?: string;
  text?: string;
  accent?: string;
  fontSize?: number;
  width?: number;
}

/** A labelled note. For the one sentence that must not be missed. */
export const Callout: React.FC<CalloutProps> = ({
  label = "NOTE",
  text = "",
  accent,
  fontSize = 26,
  width = 720,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const t = progress(frame, 0, 26, EASINGS.outExpo);
  const chip = progress(frame, 6, 30, EASINGS.outExpo);

  const light = Boolean(theme.isLight || theme.glass);
  const pane = light
    ? "linear-gradient(150deg, rgb(255 255 255 / 0.82) 0%, rgb(255 255 255 / 0.6) 100%)"
    : `linear-gradient(150deg, ${theme.panel}, ${theme.surface})`;

  return (
    <div
      style={{
        width,
        padding: `${fontSize * 0.95}px ${fontSize * 1.15}px`,
        borderRadius: fontSize * 0.95,
        background: pane,
        backdropFilter: "blur(36px) saturate(160%)",
        WebkitBackdropFilter: "blur(36px) saturate(160%)",
        boxShadow: [
          // Top bevel catching the light - lighting, not a border.
          light
            ? "inset 0 1.5px 0 0 rgb(255 255 255 / 0.9)"
            : "inset 0 1px 0 0 rgb(255 255 255 / 0.07)",
          // Contact shadow, then the wide one that lifts it off the ground.
          "0 2px 10px -2px rgb(0 0 0 / 0.08)",
          light ? "0 30px 70px -22px rgb(0 0 0 / 0.18)" : "0 30px 70px -22px rgb(0 0 0 / 0.55)",
        ].join(", "),
        fontFamily: DISPLAY_FONT,
        opacity: t,
        transform: `translateY(${mix(t, 16, 0)}px) scale(${mix(t, 0.97, 1)})`,
      }}
    >
      {label ? (
        <div
          style={{
            display: "inline-flex",
            padding: `${fontSize * 0.28}px ${fontSize * 0.6}px`,
            borderRadius: 999,
            background: `${tint}1c`,
            color: tint,
            fontSize: fontSize * 0.5,
            fontWeight: 640,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: fontSize * 0.55,
            opacity: chip,
            transform: `translateY(${mix(chip, 6, 0)}px)`,
          }}
        >
          {label}
        </div>
      ) : null}
      <div style={{ fontSize, lineHeight: 1.45, color: theme.text, letterSpacing: "-0.01em" }}>
        {text}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * BrowserFrame
 * ------------------------------------------------------------------ */

export interface BrowserFrameProps {
  url?: string;
  /** Project-relative image path to show inside the frame. */
  src?: string;
  width?: number;
  height?: number;
  /** Degrees of slow 3D sway. */
  sway?: number;
}

/**
 * A browser window.
 *
 * Product footage inside a window frame reads as a real application; the
 * same footage full-bleed reads as a screenshot. When no image is supplied
 * it renders an empty lit surface rather than a broken-image box, so it is
 * still usable as a compositional element.
 */
export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  url = "rawmotion.app",
  src = "",
  width = 1080,
  height = 660,
  sway = 1.6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const enter = springProgress(frame, fps, 0, "cinematic");
  const rotY = (oscillate(frame, 240) - 0.5) * 2 * sway;
  const float = (oscillate(frame, 300, 0.3) - 0.5) * 10;
  const chrome = 46;

  return (
    <div style={{ perspective: 2200 }}>
      <div
        style={{
          ...panelStyle(16, theme),
          width,
          height,
          transform: `translateY(${mix(enter, 50, 0) + float}px) rotateY(${rotY}deg) scale(${mix(enter, 0.95, 1)})`,
          opacity: progress(frame, 0, 22, EASINGS.outExpo),
        }}
      >
        <div
          style={{
            height: chrome,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "0 18px",
            background: "rgb(255 255 255 / 0.03)",
            boxShadow: `inset 0 -1px 0 0 ${theme.panelEdge}`,
          }}
        >
          <WindowDots />
          <div
            style={{
              flex: 1,
              height: 26,
              borderRadius: 999,
              background: "rgb(255 255 255 / 0.05)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              fontFamily: MONO_FONT,
              fontSize: 14,
              color: theme.textDim,
            }}
          >
            {url}
          </div>
        </div>

        <div style={{ height: height - chrome, position: "relative", background: "#05060a" }}>
          {src ? (
            <img
              src={src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(120% 90% at 50% 0%, rgb(139 155 255 / 0.12) 0%, transparent 60%)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Captions
 * ------------------------------------------------------------------ */

export interface CaptionProps {
  text?: string;
  fontSize?: number;
  maxWidth?: number;
}

/**
 * A subtitle plate.
 *
 * Sits on a translucent slab rather than using a text shadow: over a moving
 * background, shadowed text becomes unreadable exactly when the background
 * is busiest, whereas a slab holds contrast constant.
 */
export const Caption: React.FC<CaptionProps> = ({
  text = "",
  fontSize = 30,
  maxWidth = 1200,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const t = progress(frame, 0, 14, EASINGS.outExpo);

  if (!text) return null;

  return (
    <div
      style={{
        maxWidth,
        padding: `${fontSize * 0.45}px ${fontSize * 0.8}px`,
        borderRadius: 10,
        background: theme.isLight ? "rgb(255 255 255 / 0.82)" : "rgb(6 6 10 / 0.62)",
        boxShadow: `inset 0 0 0 1px ${theme.panelEdge}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        fontFamily: DISPLAY_FONT,
        fontSize,
        lineHeight: 1.35,
        color: theme.text,
        textAlign: "center",
        letterSpacing: "-0.01em",
        opacity: t,
        transform: `translateY(${mix(t, 8, 0)}px)`,
      }}
    >
      {text}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * StatGrid
 * ------------------------------------------------------------------ */

/**
 * Split a stat value into countable number and decoration, so "$4.9k+"
 * counts 0 -> 4.9 while keeping its dollar and its k+. A value with no
 * number ("∞", "GPU") simply doesn't count.
 */
function parseStat(value: string): {
  numeric: number | null;
  prefix: string;
  suffix: string;
  decimals: number;
  group: boolean;
} {
  const none = { numeric: null, prefix: "", suffix: "", decimals: 0, group: false };
  const m = /^([^0-9-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(value);
  if (!m) return none;
  const raw = m[2].replace(/,/g, "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return none;
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  // Group thousands only if the author did - "1,204" counts grouped, a year
  // like "2024" stays a year.
  return { numeric, prefix: m[1], suffix: m[3], decimals, group: m[2].includes(",") };
}

function formatCounted(value: number, decimals: number, group: boolean): string {
  const fixed = value.toFixed(decimals);
  if (!group) return fixed;
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

export interface StatGridProps {
  /** One per line: `value | label`. */
  stats?: string;
  accent?: string;
  size?: number;
  columns?: number;
  /** Animate numeric values counting up to their target. Accepts "on"/"off". */
  countUp?: boolean | string;
  /** Sit each figure on its own frosted tile. Accepts "on"/"off". */
  tile?: boolean | string;
}

/**
 * Headline figures.
 *
 * Values that parse as numbers count up on a hard deceleration - most of the
 * distance in the first third, single digits at the end - which is what makes
 * a figure feel *measured* rather than typeset. Prefixes and suffixes
 * (`$`, `%`, `k+`, `★`) survive the count. A short accent rule under the value
 * ties the figure to its label and gives the band structure without a box;
 * `tile` adds the frosted pane when the figures need their own ground.
 */
export const StatGrid: React.FC<StatGridProps> = ({
  stats = "161 | tests passing\n644 | frames rendered\n0 | duration limits",
  accent,
  size = 72,
  columns = 3,
  countUp = true,
  tile = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);
  const light = Boolean(theme.isLight || theme.glass);
  const doCount = countUp !== false && countUp !== "off";
  const doTile = tile === true || tile === "on";

  const items = useMemo(
    () =>
      splitLines(stats)
        .map((line) => {
          const [value, label = ""] = line.split("|");
          return { value: value.trim(), label: label.trim(), ...parseStat(value.trim()) };
        }),
    [stats],
  );

  // Never leave an empty column: three columns holding two stats pushes the
  // pair off-centre inside their own cell, which reads as a mistake.
  const columnCount = Math.max(1, Math.min(Math.round(columns), items.length));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        // Full width, not shrink-to-fit. `1fr` measures the *container*, and
        // a grid sitting in a centred flex box has no width of its own - so
        // the columns collapse to their content and the figures huddle in
        // the middle of an otherwise empty band, with none of the presence a
        // headline number is there to have. Filling the cell is what makes
        // them span the frame and land on the grid's own column edges.
        width: "100%",
        gap: size * 0.7,
        // Values sit on a shared top edge even when one label wraps to two
        // lines and its neighbours do not.
        alignItems: "start",
        fontFamily: DISPLAY_FONT,
      }}
    >
      {items.map((item, i) => {
        const start = staggerDelay(i, items.length, 6, 30);
        const s = springProgress(frame, fps, start, "smooth");
        const t = progress(frame, start, 22, EASINGS.outExpo);

        // The count rides its own longer deceleration, so digits are still
        // settling after the tile has landed - measured, not typeset.
        const count = progress(frame, start + 4, 42, EASINGS.outExpo);
        const shown =
          doCount && item.numeric !== null
            ? `${item.prefix}${formatCounted(item.numeric * count, item.decimals, item.group)}${item.suffix}`
            : item.value;

        const rule = progress(frame, start + 10, 24, EASINGS.outExpo);

        return (
          <div
            key={`${item.value}-${i}`}
            style={{
              opacity: t,
              transform: `translateY(${mix(s, 22, 0)}px) scale(${mix(s, 0.96, 1)})`,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              ...(doTile
                ? {
                    padding: `${size * 0.42}px ${size * 0.3}px ${size * 0.38}px`,
                    borderRadius: size * 0.32,
                    background: light
                      ? "linear-gradient(180deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.56))"
                      : `linear-gradient(180deg, ${theme.surface}, rgb(255 255 255 / 0.02))`,
                    boxShadow: light
                      ? "inset 0 0 0 1px rgb(255 255 255 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.95)"
                      : `inset 0 0 0 1px ${theme.panelEdge}`,
                    ...(light
                      ? { backdropFilter: "blur(24px) saturate(150%)", WebkitBackdropFilter: "blur(24px) saturate(150%)" }
                      : {}),
                  }
                : {}),
            }}
          >
            <div
              style={{
                fontSize: size,
                fontWeight: 650,
                letterSpacing: "-0.04em",
                color: tint,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {shown}
            </div>
            <div
              style={{
                width: size * 0.5,
                height: Math.max(2, size * 0.045),
                borderRadius: 99,
                margin: `${size * 0.2}px 0 ${size * 0.16}px`,
                background: `linear-gradient(to right, ${tint}, ${tint}44)`,
                transform: `scaleX(${rule})`,
                transformOrigin: "center",
              }}
            />
            <div
              style={{
                fontSize: size * 0.24,
                fontWeight: 500,
                color: theme.textDim,
                letterSpacing: "0.01em",
                lineHeight: 1.3,
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
