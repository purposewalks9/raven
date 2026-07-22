// lexer/token.ts
export enum TokenKind {
  Keyword = "Keyword",
  Identifier = "Identifier",
  String = "String",
  Punctuation = "Punctuation",
  EOF = "EOF",
}

export const KEYWORDS = new Set([
  "print", "val","rave"
]);

export interface Token {
  kind: TokenKind;
  value: string;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < source.length) {
    const c = source[pos];

    // Skip spaces
    if (c === " " || c === "\n" || c === "\t") {
      pos++;
      continue;
    }
    
    if (c === "=") {
  tokens.push({ kind: TokenKind.Punctuation, value: "=" });
  pos++;
  continue;
}

if (c === ":") {                                        // NEW
  tokens.push({ kind: TokenKind.Punctuation, value: ":" });
  pos++;
  continue;
}
    // ( and )
    if (c === "(") {
      tokens.push({ kind: TokenKind.Punctuation, value: "(" });
      pos++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: TokenKind.Punctuation, value: ")" });
      pos++;
      continue;
    }

    // "Hello" (strings)
    if (c === '"') {
      pos++;
      let value = "";
      while (source[pos] !== '"') {
        value += source[pos];
        pos++;
      }
      pos++; // skip closing quote
      tokens.push({ kind: TokenKind.String, value });
      continue;
    }

    if (c === "=") {
      tokens.push({ kind: TokenKind.Punctuation, value: "=" });
      pos++;
      continue;
    }

    // === ADD THIS BLOCK ===
    // Keywords / identifiers
    if (/[a-zA-Z_]/.test(c)) {
      let value = "";
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) {
        value += source[pos];
        pos++;
      }
      tokens.push({
        kind: KEYWORDS.has(value) ? TokenKind.Keyword : TokenKind.Identifier,
        value
      });
      continue;
    }
    // ======================

    throw new Error("Unknown character: " + c);
  }

  tokens.push({ kind: TokenKind.EOF, value: "" });
  return tokens;
}