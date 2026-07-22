import { describe, it, expect } from "vitest";
import { TypeChecker } from "../src/typechecker/checker.js";
import type { Program } from "../src/ast/index.js";

describe("TypeChecker", () => {
  it("passes when annotation matches the value's type", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "VariableDeclaration",
        name: "name",
        value: { type: "StringLiteral", value: "World" },
        typeAnnotation: "string",
      }],
    };
    const errors = new TypeChecker().check(ast);
    expect(errors).toEqual([]);
  });

  it("passes when there is no annotation (inferred)", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "VariableDeclaration",
        name: "name",
        value: { type: "StringLiteral", value: "World" },
      }],
    };
    const errors = new TypeChecker().check(ast);
    expect(errors).toEqual([]);
  });

  it("reports an undeclared variable used in print", () => {
    const ast: Program = {
      type: "Program",
      body: [{
        type: "PrintStatement",
        argument: { type: "Identifier", name: "ghost" },
      }],
    };
    const errors = new TypeChecker().check(ast);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Undeclared variable");
    expect(errors[0]).toContain("ghost");
  });

  it("allows a declared variable to be printed without error", () => {
    const ast: Program = {
      type: "Program",
      body: [
        {
          type: "VariableDeclaration",
          name: "name",
          value: { type: "StringLiteral", value: "World" },
        },
        {
          type: "PrintStatement",
          argument: { type: "Identifier", name: "name" },
        },
      ],
    };
    const errors = new TypeChecker().check(ast);
    expect(errors).toEqual([]);
  });
});