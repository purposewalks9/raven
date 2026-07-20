import { KEYWORDS, OPERATORS, PUNCTUATION, Token, TokenKind } from "./token.js";

export class LexError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`${message} (line ${line}, column ${column})`);
    this.name = "LexError";
  }
}

const isDigit = (c: string) => c >= "0" && c <= "9";
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);

/**
 * Tokenizes Nova source. Single-pass, hand-written (no generator library) —
 * deliberately simple so it's easy to extend as the grammar grows.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  const advance = (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (source[pos] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      pos++;
    }
  };

  const peek = (offset = 0) => source[pos + offset] ?? "";

  while (pos < source.length) {
    const c = peek();

    // Whitespace
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    // Line comments
    if (c === "/" && peek(1) === "/") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // Block comments
    if (c === "/" && peek(1) === "*") {
      advance(2);
      while (pos < source.length && !(peek() === "*" && peek(1) === "/")) advance();
      advance(2);
      continue;
    }

    const startLine = line;
    const startColumn = column;
    const startPos = pos;

    // String literals (double-quoted; supports \" escape)
    if (c === '"') {
      advance();
      let value = "";
      while (pos < source.length && peek() !== '"') {
        if (peek() === "\\" && peek(1) === '"') {
          value += '"';
          advance(2);
        } else if (peek() === "\\" && peek(1) === "n") {
          value += "\n";
          advance(2);
        } else {
          value += peek();
          advance();
        }
      }
      if (pos >= source.length) {
        throw new LexError("Unterminated string literal", startLine, startColumn);
      }
      advance(); // closing quote
      tokens.push({
        kind: TokenKind.StringLiteral,
        value,
        span: { start: startPos, end: pos, line: startLine, column: startColumn },
      });
      continue;
    }

    // Number literals
    if (isDigit(c)) {
      let value = "";
      while (pos < source.length && isDigit(peek())) {
        value += peek();
        advance();
      }
      if (peek() === "." && isDigit(peek(1))) {
        value += peek();
        advance();
        while (pos < source.length && isDigit(peek())) {
          value += peek();
          advance();
        }
      }
      tokens.push({
        kind: TokenKind.NumberLiteral,
        value,
        span: { start: startPos, end: pos, line: startLine, column: startColumn },
      });
      continue;
    }

    // Identifiers / keywords
    if (isIdentStart(c)) {
      let value = "";
      while (pos < source.length && isIdentPart(peek())) {
        value += peek();
        advance();
      }
      tokens.push({
        kind: KEYWORDS.has(value) ? TokenKind.Keyword : TokenKind.Identifier,
        value,
        span: { start: startPos, end: pos, line: startLine, column: startColumn },
      });
      continue;
    }

    // Operators (longest match first, per OPERATORS ordering)
    const op = OPERATORS.find((o) => source.startsWith(o, pos));
    if (op) {
      advance(op.length);
      tokens.push({
        kind: TokenKind.Operator,
        value: op,
        span: { start: startPos, end: pos, line: startLine, column: startColumn },
      });
      continue;
    }

    // Punctuation
    if (PUNCTUATION.has(c)) {
      advance();
      tokens.push({
        kind: TokenKind.Punctuation,
        value: c,
        span: { start: startPos, end: pos, line: startLine, column: startColumn },
      });
      continue;
    }

    throw new LexError(`Unexpected character '${c}'`, startLine, startColumn);
  }

  tokens.push({
    kind: TokenKind.EOF,
    value: "",
    span: { start: pos, end: pos, line, column },
  });

  return tokens;
}
