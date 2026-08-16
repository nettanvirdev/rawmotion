/**
 * Syntax highlighting for code shown on screen.
 *
 * A deliberately small hand-written tokenizer rather than Shiki or Prism.
 * The reasons are specific to rendering video:
 *
 *  - **Synchronous.** Shiki loads grammars asynchronously. A Remotion frame
 *    is rendered synchronously; anything that resolves a promise mid-render
 *    produces an unhighlighted frame in the middle of an otherwise
 *    highlighted shot, which is far worse than slightly coarser tokens.
 *  - **Deterministic.** Identical input must give identical output on every
 *    machine and every re-render, forever.
 *  - **Small.** Bundling a full grammar set into every render for what is,
 *    on screen, twenty lines of code at 28px is not a good trade.
 *
 * The cost is honest: this understands enough of each language to colour it
 * convincingly at video resolution, not enough to pass as a real editor.
 * Nested template literals, regex-vs-divide ambiguity and JSX text nodes are
 * approximated.
 */

export type TokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "type"
  | "punctuation"
  | "property"
  | "operator";

export interface Token {
  text: string;
  kind: TokenKind;
}

export type Language = "ts" | "tsx" | "js" | "jsx" | "json" | "bash" | "text";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "of", "in", "new", "class", "extends", "import", "from", "export", "default",
  "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof",
  "interface", "type", "enum", "implements", "public", "private", "protected",
  "readonly", "static", "as", "is", "keyof", "satisfies", "switch", "case",
  "break", "continue", "do", "yield", "delete", "void", "declare", "namespace",
]);

const LITERALS = new Set(["true", "false", "null", "undefined", "this", "super", "NaN"]);

/**
 * Dark palette. Deliberately low-saturation - saturated code on video
 * vibrates, and at video bitrates the chroma is the first thing to smear.
 */
export const CODE_COLORS: Record<TokenKind, string> = {
  plain: "#c9cddb",
  keyword: "#c4a2ff",
  string: "#9ad4a0",
  comment: "#5f6678",
  number: "#f0b27a",
  function: "#8fb8ff",
  type: "#7fd6d0",
  punctuation: "#828a9e",
  property: "#d6c07a",
  operator: "#a9b0c2",
};

/**
 * Tokenize one line.
 *
 * Line-at-a-time rather than whole-file, because the components render and
 * reveal code by line. The consequence is that a block comment or template
 * literal spanning lines is not tracked across them - see `tokenizeBlock`,
 * which carries that one piece of state.
 */
function tokenizeLine(line: string, language: Language, inBlockComment: boolean): {
  tokens: Token[];
  inBlockComment: boolean;
} {
  if (language === "text") return { tokens: [{ text: line, kind: "plain" }], inBlockComment };
  if (language === "bash") return { tokens: tokenizeBash(line), inBlockComment };
  if (language === "json") return { tokens: tokenizeJson(line), inBlockComment };

  const tokens: Token[] = [];
  let i = 0;
  let block = inBlockComment;

  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    // Merge adjacent same-kind tokens so the DOM stays small - a 40-line
    // block otherwise produces thousands of spans per frame.
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };

  while (i < line.length) {
    if (block) {
      const end = line.indexOf("*/", i);
      if (end === -1) {
        push(line.slice(i), "comment");
        return { tokens, inBlockComment: true };
      }
      push(line.slice(i, end + 2), "comment");
      i = end + 2;
      block = false;
      continue;
    }

    const rest = line.slice(i);

    // Line comment
    if (rest.startsWith("//")) {
      push(rest, "comment");
      break;
    }
    // Block comment
    if (rest.startsWith("/*")) {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        push(rest, "comment");
        return { tokens, inBlockComment: true };
      }
      push(line.slice(i, end + 2), "comment");
      i = end + 2;
      continue;
    }
    // String or template literal. Templates are treated as plain strings;
    // interpolations are not recursed into.
    if (rest[0] === '"' || rest[0] === "'" || rest[0] === "`") {
      const quote = rest[0];
      let j = 1;
      while (j < rest.length) {
        if (rest[j] === "\\") j += 2;
        else if (rest[j] === quote) { j += 1; break; }
        else j += 1;
      }
      push(rest.slice(0, j), "string");
      i += j;
      continue;
    }
    // Number
    const number = /^0[xb][0-9a-f_]+|^\d[\d_]*\.?\d*(e[+-]?\d+)?/i.exec(rest);
    if (number) {
      push(number[0], "number");
      i += number[0].length;
      continue;
    }
    // Identifier
    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      const text = word[0];
      const after = rest.slice(text.length).trimStart();
      const before = line.slice(0, i).trimEnd();

      let kind: TokenKind = "plain";
      if (KEYWORDS.has(text)) kind = "keyword";
      else if (LITERALS.has(text)) kind = "number";
      else if (after.startsWith("(")) kind = "function";
      else if (after.startsWith(":") && !before.endsWith("?")) kind = "property";
      // Capitalised identifiers are types or components far more often than
      // not, and mis-colouring one is invisible at video resolution.
      else if (/^[A-Z]/.test(text)) kind = "type";

      push(text, kind);
      i += text.length;
      continue;
    }
    // Operators and punctuation
    if (/[=+\-*/%<>!&|?^~]/.test(rest[0])) {
      push(rest[0], "operator");
      i += 1;
      continue;
    }
    if (/[{}()[\];,.:]/.test(rest[0])) {
      push(rest[0], "punctuation");
      i += 1;
      continue;
    }

    push(rest[0], "plain");
    i += 1;
  }

  return { tokens, inBlockComment: block };
}

function tokenizeJson(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])|(\s+)|(.)/g;

  for (const m of line.matchAll(pattern)) {
    if (m[1]) tokens.push({ text: m[1], kind: "property" });
    else if (m[2]) tokens.push({ text: m[2], kind: "string" });
    else if (m[3]) tokens.push({ text: m[3], kind: "number" });
    else if (m[4]) tokens.push({ text: m[4], kind: "number" });
    else if (m[5]) tokens.push({ text: m[5], kind: "punctuation" });
    else tokens.push({ text: m[0], kind: "plain" });
  }
  return tokens;
}

function tokenizeBash(line: string): Token[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) return [{ text: line, kind: "comment" }];

  const tokens: Token[] = [];
  const pattern = /("[^"]*"|'[^']*')|(\s+)|(-{1,2}[\w-]+)|([^\s]+)/g;
  let first = true;

  for (const m of line.matchAll(pattern)) {
    if (m[1]) tokens.push({ text: m[1], kind: "string" });
    else if (m[2]) tokens.push({ text: m[2], kind: "plain" });
    else if (m[3]) tokens.push({ text: m[3], kind: "property" });
    else {
      // The first bare word on a line is the command being run.
      tokens.push({ text: m[0], kind: first ? "function" : "plain" });
      first = false;
    }
  }
  return tokens;
}

/**
 * Tokenize a whole block, carrying block-comment state across lines.
 *
 * @returns One token array per line.
 */
export function tokenizeBlock(code: string, language: Language): Token[][] {
  const lines = code.replace(/\t/g, "  ").split("\n");
  const out: Token[][] = [];
  let block = false;

  for (const line of lines) {
    const result = tokenizeLine(line, language, block);
    out.push(result.tokens);
    block = result.inBlockComment;
  }
  return out;
}

/** Guess a language from a filename, for `CodeBlock`'s convenience. */
export function languageForFile(filename: string): Language {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ts") return "ts";
  if (ext === "tsx") return "tsx";
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "js";
  if (ext === "jsx") return "jsx";
  if (ext === "json") return "json";
  if (ext === "sh" || ext === "bash" || ext === "zsh") return "bash";
  return "text";
}

/**
 * Light palette.
 *
 * Not the dark one darkened. Hue relationships that read correctly on a dark
 * field fall apart on white: the dark palette's greens and blues sit at a
 * lightness that vanishes against paper, and its comment grey becomes
 * invisible. These are picked for roughly 7:1 contrast on a white panel,
 * which is what keeps code legible after h264 has had its way with the
 * chroma channels.
 */
export const CODE_COLORS_LIGHT: Record<TokenKind, string> = {
  plain: "#1d1d1f",
  keyword: "#9b2393",
  string: "#0b7a3e",
  comment: "#8a8a8f",
  number: "#b8541b",
  function: "#1f5fbf",
  type: "#0f7b8a",
  punctuation: "#6e6e73",
  property: "#8a6d0b",
  operator: "#5a5a60",
};

/** Pick a palette for the current surface. */
export function codeColors(isLight?: boolean): Record<TokenKind, string> {
  return isLight ? CODE_COLORS_LIGHT : CODE_COLORS;
}
