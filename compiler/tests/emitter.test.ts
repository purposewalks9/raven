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
});