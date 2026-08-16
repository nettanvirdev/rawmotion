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
import { CODE_COLORS, type Language, languageForFile, tokenizeBlock } from "./highlight";
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
  theme?: { panel: string; panelEdge: string },
): React.CSSProperties {
  return {
    background: theme?.panel ?? PANEL_BG,
    borderRadius: radius,
    boxShadow: [
      `inset 0 1px 0 0 rgb(255 255 255 / 0.08)`,
      `inset 0 0 0 1px ${theme?.panelEdge ?? PANEL_EDGE}`,
      "0 40px 90px -24px rgb(0 0 0 / 0.75)",
    ].join(", "),
    overflow: "hidden",
  };
}

/** Traffic-light dots. Signals "this is a window" in three small circles. */
const WindowDots: React.FC = () => (
  <div style={{ display: "flex", gap: 7 }}>
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
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
                    color: "#4c5265",
                    fontSize: fontSize * 0.85,
                    textAlign: "right",
                    paddingRight: fontSize * 0.7,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i + 1}
                </span>
              ) : null}

              <span style={{ fontSize, whiteSpace: "pre", color: CODE_COLORS.plain }}>
                {tokens.map((token, j) => (
                  <span key={j} style={{ color: CODE_COLORS[token.kind] }}>
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
}

/**
 * A chain of boxes joined by connectors that draw themselves.
 *
 * Nodes and connectors alternate in time - box, line, box, line - so the
 * diagram builds in the order it is read. Revealing all the boxes and then
 * all the lines is faster to write and reads as a diagram appearing rather
 * than a process being traced.
 */
export const DiagramFlow: React.FC<DiagramFlowProps> = ({
  nodes = "Prompt\nProject model\nComposition\nMP4",
  direction = "vertical",
  accent,
  fontSize = 26,
  delay = 0,
  nodeWidth = 340,
  gap = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

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
  // Each node plus its outgoing connector occupies one beat.
  const beat = 12;

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
        const nodeStart = delay + i * beat * 2;
        const t = progress(frame, nodeStart, 20, EASINGS.outExpo);
        const s = springProgress(frame, fps, nodeStart, "smooth");
        const connectorT = progress(frame, nodeStart + beat, beat + 4, EASINGS.outExpo);

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
                borderRadius: 12,
                textAlign: "center",
                fontSize,
                letterSpacing: "-0.01em",
                color: item.emphasised ? theme.text : theme.textDim,
                background: item.emphasised
                  ? `linear-gradient(160deg, ${tint}38, ${tint}14)`
                  : theme.surface,
                boxShadow: item.emphasised
                  ? `inset 0 0 0 1px ${tint}66, 0 18px 40px -14px ${tint}55`
                  : `inset 0 0 0 1px ${theme.panelEdge}`,
                opacity: t,
                transform: `translateY(${mix(s, 14, 0)}px) scale(${mix(s, 0.96, 1)})`,
              }}
            >
              {item.label}
            </div>

            {i < items.length - 1 ? (
              <div
                style={{
                  width: vertical ? 2 : gap,
                  height: vertical ? gap : 2,
                  flexShrink: 0,
                  background: `linear-gradient(${vertical ? "to bottom" : "to right"}, ${tint}88, ${tint}33)`,
                  transform: vertical ? `scaleY(${connectorT})` : `scaleX(${connectorT})`,
                  transformOrigin: vertical ? "top center" : "left center",
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
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
  const t = progress(frame, 0, 24, EASINGS.outExpo);

  return (
    <div
      style={{
        width,
        display: "flex",
        gap: fontSize * 0.8,
        padding: `${fontSize * 0.85}px ${fontSize}px`,
        borderRadius: 12,
        background: `linear-gradient(150deg, ${tint}1f, ${tint}0a)`,
        boxShadow: `inset 0 0 0 1px ${tint}3d`,
        fontFamily: DISPLAY_FONT,
        opacity: t,
        transform: `translateY(${mix(t, 12, 0)}px)`,
      }}
    >
      <div
        style={{
          width: 3,
          borderRadius: 2,
          background: tint,
          transform: `scaleY(${progress(frame, 4, 26, EASINGS.outExpo)})`,
          transformOrigin: "top center",
          flexShrink: 0,
        }}
      />
      <div>
        {label ? (
          <div
            style={{
              fontSize: fontSize * 0.58,
              letterSpacing: "0.18em",
              color: tint,
              marginBottom: fontSize * 0.3,
            }}
          >
            {label}
          </div>
        ) : null}
        <div style={{ fontSize, lineHeight: 1.45, color: theme.text, letterSpacing: "-0.01em" }}>
          {text}
        </div>
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

export interface StatGridProps {
  /** One per line: `value | label`. */
  stats?: string;
  accent?: string;
  size?: number;
  columns?: number;
}

/** A row of headline figures. */
export const StatGrid: React.FC<StatGridProps> = ({
  stats = "161 | tests passing\n644 | frames rendered\n0 | duration limits",
  accent,
  size = 72,
  columns = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tint = themed(accent, theme.accent);

  const items = useMemo(
    () =>
      splitLines(stats)
        .map((line) => {
          const [value, label = ""] = line.split("|");
          return { value: value.trim(), label: label.trim() };
        }),
    [stats],
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: size * 0.7,
        fontFamily: DISPLAY_FONT,
      }}
    >
      {items.map((item, i) => {
        const start = staggerDelay(i, items.length, 6, 30);
        const s = springProgress(frame, fps, start, "smooth");
        const t = progress(frame, start, 22, EASINGS.outExpo);

        return (
          <div
            key={`${item.value}-${i}`}
            style={{
              opacity: t,
              transform: `translateY(${mix(s, 18, 0)}px)`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: size,
                fontWeight: 600,
                letterSpacing: "-0.04em",
                color: tint,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {item.value}
            </div>
            <div
              style={{
                marginTop: size * 0.16,
                fontSize: size * 0.22,
                color: theme.textDim,
                letterSpacing: "0.02em",
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
