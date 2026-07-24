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
  it("emits an if statement", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "IfStatement",
        condition: { type: "BooleanLiteral", value: true },
        consequent: [{ type: "PrintStatement", argument: { type: "StringLiteral", value: "yes" } }],
      }],
    };
    const js = new Emitter().emit(ast);
    expect(js).toContain("if (");
    expect(js).toContain("console.log(");
  });
  it("emits a reassignment", () => {
    const ast: Program = {
      type: "Program",
      body: [{ type: "Assignment", name: "age", value: { type: "NumberLiteral", value: 6 } }],
    };
    const js = new Emitter().emit(ast);
    expect(js.replace(/\s+/g, " ").trim()).toContain("age = 6");
  });
});