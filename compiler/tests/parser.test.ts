import { describe, it, expect } from "vitest";
import { tokenize } from "../src/lexer/token.js";
import { Parser } from "../src/parser/parser.js";

describe("parser", () => {
  it("parses a print statement into correct AST shape", () => {
    const ast = new Parser(tokenize(`print("hi")`)).parseProgram();
    expect(ast.type).toBe("Program");
    expect(ast.body.length).toBe(1);
    expect(ast.body[0]!.type).toBe("PrintStatement");
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

  it("parses an if/then/end statement", () => {
  const ast = new Parser(tokenize(`if 5 > 3 then print("yes") end`)).parseProgram();
 expect(ast.body[0]!.type).toBe("IfStatement");
  expect((ast.body[0] as any).consequent.length).toBe(1);
  expect((ast.body[0] as any).alternate).toBeUndefined();
});

it("parses an if/then/else/end statement", () => {
  const ast = new Parser(tokenize(`if 5 > 3 then print("yes") else print("no") end`)).parseProgram();
  expect((ast.body[0] as any).alternate.length).toBe(1);
});

  it("parses a reassignment", () => {
    const ast = new Parser(tokenize(`age = 6`)).parseProgram();
    expect(ast.body[0]).toEqual({
      type: "Assignment",
      name: "age",
      value: { type: "NumberLiteral", value: 6 },
    });
  });

  it("parses a val declaration with a boolean", () => {
    const ast = new Parser(tokenize(`val isReady = true`)).parseProgram();
    expect(ast.body[0]).toEqual({
      type: "VariableDeclaration",
      name: "isReady",
      value: { type: "BooleanLiteral", value: true },
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

  it("parses simple addition", () => {
    const ast = new Parser(tokenize(`val x = 2 + 3`)).parseProgram();
    expect((ast.body[0] as any).value).toEqual({
      type: "BinaryExpression",
      operator: "+",
      left: { type: "NumberLiteral", value: 2 },
      right: { type: "NumberLiteral", value: 3 },
    });
  });

  it("respects operator precedence (* before +)", () => {
    const ast = new Parser(tokenize(`val x = 2 + 3 * 4`)).parseProgram();
    const value = (ast.body[0] as any).value;
    expect(value.operator).toBe("+");
    expect(value.left).toEqual({ type: "NumberLiteral", value: 2 });
    expect(value.right).toEqual({
      type: "BinaryExpression",
      operator: "*",
      left: { type: "NumberLiteral", value: 3 },
      right: { type: "NumberLiteral", value: 4 },
    });
  });

  it("parses a comparison", () => {
    const ast = new Parser(tokenize(`val x = 5 > 3`)).parseProgram();
    expect((ast.body[0] as any).value).toEqual({
      type: "BinaryExpression",
      operator: ">",
      left: { type: "NumberLiteral", value: 5 },
      right: { type: "NumberLiteral", value: 3 },
    });
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