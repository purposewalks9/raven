import { describe, it, expect } from "vitest";
import { tokenize } from "../src/lexer/token.js";
import { Parser } from "../src/parser/parser.js";

describe("parser", () => {
  it("parses a print statement into correct AST shape", () => {
    const ast = new Parser(tokenize(`print("hi")`)).parseProgram();
    expect(ast.type).toBe("Program");
    expect(ast.body.length).toBe(1);
    expect(ast.body[0].type).toBe("PrintStatement");
    expect((ast.body[0] as any).argument.type).toBe("StringLiteral");
    expect((ast.body[0] as any).argument.value).toBe("hi");
  });

  it("throws a clear error on missing closing paren", () => {
    expect(() => new Parser(tokenize(`print("hi"`)).parseProgram()).toThrow();
  });

  it("throws on unknown statement", () => {
    expect(() => new Parser(tokenize(`foo`)).parseProgram()).toThrow();
  });
});