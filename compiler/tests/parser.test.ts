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
  it("parses a val declaration", () => {
    const ast = new Parser(tokenize(`val x = "hi"`)).parseProgram();
    expect(ast.body[0]).toEqual({
      type: "VariableDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
    });
  });
  it("parses a val declaration with a type annotation", () => {
    const ast = new Parser(tokenize(`val x: string = "hi"`)).parseProgram();
    expect(ast.body[0]).toEqual({
      type: "VariableDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
      typeAnnotation: "string",
    });
  });

  it("parses a val declaration without a type annotation", () => {
    const ast = new Parser(tokenize(`val x = "hi"`)).parseProgram();
    expect((ast.body[0] as any).typeAnnotation).toBeUndefined();
  });
  it("parses print with an identifier argument", () => {
    const ast = new Parser(tokenize(`print(x)`)).parseProgram();
    expect((ast.body[0] as any).argument).toEqual({ type: "Identifier", name: "x" });
  });
  it("parses a val declaration with a number", () => {
    const ast = new Parser(tokenize(`val age = 5`)).parseProgram();
    expect(ast.body[0]).toEqual({
      type: "VariableDeclaration",
      name: "age",
      value: { type: "NumberLiteral", value: 5 },
    });
  });
  it("throws on unknown statement", () => {
    expect(() => new Parser(tokenize(`foo`)).parseProgram()).toThrow();
  });
});