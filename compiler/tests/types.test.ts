import { describe, expect, it } from "vitest";
import { formatType, isAssignableTo, sameType, unionType } from "../src/typechecker/types.js";
import type { TypeAnnotation } from "../src/ast/index.js";

describe("type engine", () => {
  it("normalizes and compares unions without caring about variant order", () => {
    expect(sameType(
      { kind: "union", variants: ["number", "string"] },
      { kind: "union", variants: ["string", "number"] },
    )).toBe(true);
  });

  it("assigns values into optional and union targets", () => {
    expect(isAssignableTo("number", { kind: "optional", inner: "number" })).toBe(true);
    expect(isAssignableTo({ kind: "optional", inner: "number" }, "number")).toBe(false);
    expect(isAssignableTo("string", { kind: "union", variants: ["number", "string"] })).toBe(true);
  });

  it("allows missing optional record fields but rejects missing required fields", () => {
    const source: TypeAnnotation = { kind: "record", fields: { name: "string" } };
    const optionalAge: TypeAnnotation = {
      kind: "record",
      fields: { name: "string", age: { kind: "optional", inner: "number" } },
    };
    const requiredAge: TypeAnnotation = {
      kind: "record",
      fields: { name: "string", age: "number" },
    };

    expect(isAssignableTo(source, optionalAge)).toBe(true);
    expect(isAssignableTo(source, requiredAge)).toBe(false);
  });

  it("formats compiler-derived optional and union types", () => {
    expect(formatType({ kind: "optional", inner: "number" })).toBe("number?");
    expect(formatType(unionType(["number", "string", "number"]))).toBe("number | string");
  });
});
