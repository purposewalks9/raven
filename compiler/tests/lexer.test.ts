import { describe, it, expect } from "vitest";
import { tokenize, TokenKind } from "../src/lexer/token.js";

describe("lexer", () => {
  it("tokenizes a print statement", () => {
    const tokens = tokenize(`print("hi")`);
    const kinds = tokens.map(t => t.kind);
    expect(kinds).toEqual([
      TokenKind.Keyword,
      TokenKind.Punctuation,
      TokenKind.String,
      TokenKind.Punctuation,
      TokenKind.EOF,
    ]);
  });

  it("tokenizes a val statement", () => {
  const tokens = tokenize(`val x = "hi"`);
  expect(tokens.map(t => t.kind)).toEqual([
    TokenKind.Keyword,
    TokenKind.Identifier,
    TokenKind.Punctuation,
    TokenKind.String,
    TokenKind.EOF,
  ]);
});
  
  it("tokenizes identifiers separately from keywords", () => {
    const tokens = tokenize(`foo`);
    expect(tokens[0].kind).toBe(TokenKind.Identifier);
    expect(tokens[0].value).toBe("foo");
  });

  it("extracts string values without quotes", () => {
    const tokens = tokenize(`print("Hello, World!")`);
    const str = tokens.find(t => t.kind === TokenKind.String);
    expect(str?.value).toBe("Hello, World!");
  });
  it("tokenizes a typed val statement", () => {
  const tokens = tokenize(`val x: string = "hi"`);
  expect(tokens.map(t => t.kind)).toEqual([
    TokenKind.Keyword,      // val
    TokenKind.Identifier,   // x
    TokenKind.Punctuation,  // :
    TokenKind.Identifier,   // string
    TokenKind.Punctuation,  // =
    TokenKind.String,       // "hi"
    TokenKind.EOF,
  ]);
});

  it("skips whitespace", () => {
    const tokens = tokenize(`  print  (  "hi"  )  `);
    expect(tokens.length).toBe(5);
  });
});

