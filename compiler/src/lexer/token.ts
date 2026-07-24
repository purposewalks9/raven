export enum TokenKind {
  Keyword = "Keyword",
  Identifier = "Identifier",
  String = "String",
  Number = "Number",
  Punctuation = "Punctuation",
  EOF = "EOF",
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface Token {
  kind: TokenKind;
  value: string;
  location: SourceLocation;
}

export const KEYWORDS = new Set([
  "print",
  "val",
  "rave",
  "let",
  "const",
  "true",
  "false",
  "if",
  "then",
  "else",
  "end",
  "and",
  "or",
  "not",
  "while",
  "do",
  "fn",
  "return",
  "break",
  "continue",
]);

const TWO_CHARACTER_OPERATORS = new Set(["==", "!=", "<=", ">="]);
const SINGLE_CHARACTER_PUNCTUATION = new Set([
  "+", "-", "*", "/", "%", "=", "<", ">", "!", ":", ",", ".", ";", "(", ")", "{", "}", "[", "]",
]);

export function tokenize(source: string, file = "<anonymous>"): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  const location = (start = pos, end = pos): SourceLocation => ({ file, line, column, start, end });
  const advance = (): string => {
    const char = source[pos++] ?? "";
    if (char === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    return char;
  };
  const add = (kind: TokenKind, value: string, start: SourceLocation, end = pos): void => {
    tokens.push({ kind, value, location: { ...start, end } });
  };

  while (pos < source.length) {
    const char = source[pos] ?? "";

    if (/\s/.test(char)) {
      advance();
      continue;
    }

    if (char === "/" && source[pos + 1] === "/") {
      while (pos < source.length && source[pos] !== "\n") advance();
      continue;
    }

    if (char === "/" && source[pos + 1] === "*") {
      const start = location(pos, pos);
      advance();
      advance();
      while (pos < source.length && !(source[pos] === "*" && source[pos + 1] === "/")) advance();
      if (pos >= source.length) throw new Error(`${start.line}:${start.column} Unterminated block comment`);
      advance();
      advance();
      continue;
    }

    const start = location(pos, pos);
    const pair = source.slice(pos, pos + 2);
    if (TWO_CHARACTER_OPERATORS.has(pair)) {
      advance();
      advance();
      add(TokenKind.Punctuation, pair, start);
      continue;
    }

    if (SINGLE_CHARACTER_PUNCTUATION.has(char)) {
      advance();
      add(TokenKind.Punctuation, char, start);
      continue;
    }

    if (char === '"') {
      advance();
      let value = "";
      while (pos < source.length && source[pos] !== '"') {
        if (source[pos] === "\n") throw new Error(`${start.line}:${start.column} Unterminated string`);
        value += advance();
      }
      if (source[pos] !== '"') throw new Error(`${start.line}:${start.column} Unterminated string`);
      advance();
      add(TokenKind.String, value, start);
      continue;
    }

    if (/[0-9]/.test(char)) {
      let value = "";
      while (pos < source.length && /[0-9]/.test(source[pos] ?? "")) value += advance();
      if (source[pos] === "." && /[0-9]/.test(source[pos + 1] ?? "")) {
        value += advance();
        while (pos < source.length && /[0-9]/.test(source[pos] ?? "")) value += advance();
      }
      add(TokenKind.Number, value, start);
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = "";
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos] ?? "")) value += advance();
      add(KEYWORDS.has(value) ? TokenKind.Keyword : TokenKind.Identifier, value, start);
      continue;
    }

    throw new Error(`${start.line}:${start.column} Unexpected character '${char}'`);
  }

  tokens.push({ kind: TokenKind.EOF, value: "", location: location(pos, pos) });
  return tokens;
}
