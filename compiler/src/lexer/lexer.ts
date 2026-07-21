import { KEYWORDS, TokenKind, Token } from "./token.js";

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


    // (
    if (c === "(") {

      tokens.push({
        kind: TokenKind.Punctuation,
        value: "("
      });

      pos++;
      continue;
    }

    // )
    if (c === ")") {

      tokens.push({
        kind: TokenKind.Punctuation,
        value: ")"
      });
      pos++;
      continue;
    }
    
if (c === '"') {
  pos++;
  let value = "";
  while (pos < source.length && source[pos] !== '"') {
    value += source[pos];
    pos++;
  }
  if (pos >= source.length) {
    throw new Error("Unterminated string literal");
  }
  pos++;
  tokens.push({ kind: TokenKind.String, value });
  continue;
}
    throw new Error("Unknown character: " + c);

  }

  tokens.push({

    kind: TokenKind.EOF,

    value: ""

  });

  return tokens;

}