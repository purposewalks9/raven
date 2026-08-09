import { describe, it, expect } from "vitest";
import { tokenize, TokenKind } from "../src/lexer/token.js";
import { Parser } from "../src/parser/parser.js";

function stripLocations<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripLocations) as T;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "location")
      .map(([key, nested]) => [key, stripLocations(nested)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

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

  it("parses a let declaration", () => {
    const ast = new Parser(tokenize(`let x = "hi"`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "VariableDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
    });
  });

  it("parses a const declaration", () => {
    const ast = new Parser(tokenize(`const x = "hi"`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "ConstantDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
    });
  });

  it("parses a let declaration with a type annotation", () => {
    const ast = new Parser(tokenize(`let x: string = "hi"`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "VariableDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
      typeAnnotation: "string",
    });
  });

  it("parses a const declaration with a type annotation", () => {
    const ast = new Parser(tokenize(`const x: string = "hi"`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "ConstantDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
      typeAnnotation: "string",
    });
  });

  it("parses a let declaration without a type annotation", () => {
    const ast = new Parser(tokenize(`let x = "hi"`)).parseProgram();
    expect((ast.body[0] as any).typeAnnotation).toBeUndefined();
  });

  it("parses a let declaration with a boolean", () => {
    const ast = new Parser(tokenize(`let isReady = true`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "VariableDeclaration",
      name: "isReady",
      value: { type: "BooleanLiteral", value: true },
    });
  });

  it("parses a const declaration with a boolean", () => {
    const ast = new Parser(tokenize(`const isReady = true`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "ConstantDeclaration",
      name: "isReady",
      value: { type: "BooleanLiteral", value: true },
    });
  });

  it("parses a let declaration with a number", () => {
    const ast = new Parser(tokenize(`let age = 5`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "VariableDeclaration",
      name: "age",
      value: { type: "NumberLiteral", value: 5 },
    });
  });

  it("parses a const declaration with a number", () => {
    const ast = new Parser(tokenize(`const age = 5`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "ConstantDeclaration",
      name: "age",
      value: { type: "NumberLiteral", value: 5 },
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

  it("parses a function declaration", () => {
    const source = `fn add(a: number, b: number): number return a + b end`;
    const ast = new Parser(tokenize(source)).parseProgram();
    expect(ast.body[0]!.type).toBe("FunctionDeclaration");
    expect((ast.body[0] as any).parameters).toMatchObject([
      { name: "a", typeAnnotation: "number" },
      { name: "b", typeAnnotation: "number" },
    ]);
    expect((ast.body[0] as any).returnType).toBe("number");
  });

  it("parses a function call", () => {
    const ast = new Parser(tokenize(`let x = add(2, 3)`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "CallExpression",
      callee: "add",
      arguments: [{ type: "NumberLiteral", value: 2 }, { type: "NumberLiteral", value: 3 }],
    });
  });

  it("parses a while loop", () => {
    const ast = new Parser(tokenize(`while x < 10 do print(x) end`)).parseProgram();
    expect(ast.body[0]!.type).toBe("WhileStatement");
    expect((ast.body[0] as any).body.length).toBe(1);
  });

  it("parses a logical and expression", () => {
    const ast = new Parser(tokenize(`let x = true and false`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "BinaryExpression",
      operator: "and",
      left: { type: "BooleanLiteral", value: true },
      right: { type: "BooleanLiteral", value: false },
    });
  });

  it("parses a not expression", () => {
    const ast = new Parser(tokenize(`let x = not true`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "UnaryExpression",
      operator: "not",
      argument: { type: "BooleanLiteral", value: true },
    });
  });

  it("parses a reassignment", () => {
    const ast = new Parser(tokenize(`age = 6`)).parseProgram();
    expect(stripLocations(ast.body[0])).toEqual({
      type: "Assignment",
      name: "age",
      value: { type: "NumberLiteral", value: 6 },
    });
  });

  it("parses print with an identifier argument", () => {
    const ast = new Parser(tokenize(`print(x)`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).argument)).toEqual({ type: "Identifier", name: "x" });
  });

  it("parses simple addition", () => {
    const ast = new Parser(tokenize(`let x = 2 + 3`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "BinaryExpression",
      operator: "+",
      left: { type: "NumberLiteral", value: 2 },
      right: { type: "NumberLiteral", value: 3 },
    });
  });

  it("respects operator precedence (* before +)", () => {
    const ast = new Parser(tokenize(`let x = 2 + 3 * 4`)).parseProgram();
    const value = (ast.body[0] as any).value;
    expect(value.operator).toBe("+");
    expect(stripLocations(value.left)).toEqual({ type: "NumberLiteral", value: 2 });
    expect(stripLocations(value.right)).toEqual({
      type: "BinaryExpression",
      operator: "*",
      left: { type: "NumberLiteral", value: 3 },
      right: { type: "NumberLiteral", value: 4 },
    });
  });

  it("parses a comparison", () => {
    const ast = new Parser(tokenize(`let x = 5 > 3`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "BinaryExpression",
      operator: ">",
      left: { type: "NumberLiteral", value: 5 },
      right: { type: "NumberLiteral", value: 3 },
    });
  });

  it("parses an array literal", () => {
    const ast = new Parser(tokenize(`let nums = [1, 2, 3]`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "ArrayLiteral",
      elements: [
        { type: "NumberLiteral", value: 1 },
        { type: "NumberLiteral", value: 2 },
        { type: "NumberLiteral", value: 3 },
      ],
    });
  });

  it("parses array indexing", () => {
    const ast = new Parser(tokenize(`let x = nums[0]`)).parseProgram();
    expect(stripLocations((ast.body[0] as any).value)).toEqual({
      type: "IndexExpression",
      array: { type: "Identifier", name: "nums" },
      index: { type: "NumberLiteral", value: 0 },
    });
  });

  it("throws on unknown statement", () => {
    expect(() => new Parser(tokenize(`foo`)).parseProgram()).toThrow();
  });
});

// Lexer tests for let and const
describe("lexer - let and const", () => {
  it("tokenizes a let statement", () => {
    const tokens = tokenize(`let x = "hi"`);
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.Keyword,  // let
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.String,
      TokenKind.EOF,
    ]);
    expect(tokens[0]!.value).toBe("let");
  });

  it("tokenizes a const statement", () => {
    const tokens = tokenize(`const x = "hi"`);
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.Keyword,  // const
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.String,
      TokenKind.EOF,
    ]);
    expect(tokens[0]!.value).toBe("const");
  });

  it("tokenizes a let statement with type annotation", () => {
    const tokens = tokenize(`let x: string = "hi"`);
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.Keyword,
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.String,
      TokenKind.EOF,
    ]);
  });

  it("tokenizes a const statement with type annotation", () => {
    const tokens = tokenize(`const x: string = "hi"`);
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.Keyword,
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.Identifier,
      TokenKind.Punctuation,
      TokenKind.String,
      TokenKind.EOF,
    ]);
  });
});