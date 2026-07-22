import { describe, it, expect } from "vitest";
import { Emitter } from "../src/emitter/emitter.js";
import type { Program } from "../src/ast/index.js";

describe("emitter", () => {
  it("emits console.log for a print statement", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "PrintStatement",
        argument: { type: "StringLiteral", value: "hi" },
      }],
    };
    const js = new Emitter().emit(ast);
    expect(js.replace(/\s+/g, " ").trim()).toBe('console.log( "hi" );');
  });
  it("emits console.log for a print statement", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "PrintStatement",
        argument: { type: "StringLiteral", value: "hi" },
      }],
    }
    const js = new Emitter().emit(ast);
    expect(js).toContain("console.log(");
    expect(js).toContain('"hi"');
  });
  it("emits a boolean literal", () => {
  const ast: Program = {
    type: "Program",
    body: [{
      type: "VariableDeclaration",
      name: "isReady",
      value: { type: "BooleanLiteral", value: true },
    }],
  };
  const js = new Emitter().emit(ast);
  expect(js).toContain("true");
});


it("emits a binary expression", () => {
  const ast: Program = {
    type: "Program",
    body: [{
      type: "VariableDeclaration",
      name: "x",
      value: {
        type: "BinaryExpression",
        operator: "+",
        left: { type: "NumberLiteral", value: 2 },
        right: { type: "NumberLiteral", value: 3 },
      },
    }],
  };
  const js = new Emitter().emit(ast);
  expect(js.replace(/\s+/g, " ").trim()).toContain("(2 + 3)");
});
  it("emits a variable declaration", () => {
  const ast: Program = {
    type: "Program",
    body: [{
      type: "VariableDeclaration",
      name: "x",
      value: { type: "StringLiteral", value: "hi" },
    }],
  };
  const js = new Emitter().emit(ast);
  expect(js.replace(/\s+/g, " ").trim()).toContain('let x = "hi"');
});
});