import { describe, it, expect } from "vitest";
import { makeUnion, sameType, isAssignableTo, formatType } from "../src/typechecker/types.js";
import type { TypeAnnotation } from "../src/ast/nodes.js";

// Layer 2 (docs/type-intelligence-roadmap.md §5): these are the Category B
// primitives everything else in this layer is built on — one union
// constructor, a strict equality check, and the assignability check that
// TypeScript-style inference needs but `sameType` deliberately doesn't
// provide. Tested directly here since checker.test.ts exercises them only
// indirectly through diagnostics.

describe("makeUnion", () => {
  it("collapses a single member back to a bare type", () => {
    expect(makeUnion(["string"])).toBe("string");
  });

  it("dedupes structurally identical members", () => {
    expect(makeUnion(["string", "string"])).toBe("string");
  });

  it("keeps distinct members, in first-seen order", () => {
    expect(makeUnion(["number", "string", "number"])).toEqual({
      kind: "union",
      types: ["number", "string"],
    });
  });

  it("flattens nested unions instead of nesting them", () => {
    const inner: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(makeUnion([inner, "boolean"])).toEqual({
      kind: "union",
      types: ["string", "number", "boolean"],
    });
  });

  it("dedupes structurally identical records, not just primitives", () => {
    const a: TypeAnnotation = { kind: "record", fields: { id: "number" } };
    const b: TypeAnnotation = { kind: "record", fields: { id: "number" } };
    expect(makeUnion([a, b])).toEqual(a);
  });
});

describe("sameType", () => {
  it("treats two unions with the same members (any order) as the same type", () => {
    const a: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    const b: TypeAnnotation = { kind: "union", types: ["number", "string"] };
    expect(sameType(a, b)).toBe(true);
  });

  it("never treats a union as the same type as one of its bare members", () => {
    const union: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(sameType(union, "string")).toBe(false);
    expect(sameType("string", union)).toBe(false);
  });

  it("treats unions with different member counts as different types", () => {
    const a: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    const b: TypeAnnotation = { kind: "union", types: ["string", "number", "boolean"] };
    expect(sameType(a, b)).toBe(false);
  });
});

describe("isAssignableTo", () => {
  it("allows a bare member into a union that contains it", () => {
    const union: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(isAssignableTo("string", union)).toBe(true);
  });

  it("rejects a bare type that isn't a member of the target union", () => {
    const union: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(isAssignableTo("boolean", union)).toBe(false);
  });

  it("allows a narrower union into a wider one", () => {
    const narrow: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    const wide: TypeAnnotation = { kind: "union", types: ["string", "number", "boolean"] };
    expect(isAssignableTo(narrow, wide)).toBe(true);
  });

  it("rejects a wider union assigned into a narrower one", () => {
    const narrow: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    const wide: TypeAnnotation = { kind: "union", types: ["string", "number", "boolean"] };
    expect(isAssignableTo(wide, narrow)).toBe(false);
  });

  it("allows `none` into an optional (`T?`) type", () => {
    const optional: TypeAnnotation = { kind: "union", types: ["string", "none"] };
    expect(isAssignableTo("none", optional)).toBe(true);
  });

  it("still allows any type into `any`, and `any` into anything", () => {
    const union: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(isAssignableTo(union, "any")).toBe(true);
    expect(isAssignableTo("any", union)).toBe(true);
  });

  it("checks union members recursively inside arrays", () => {
    const from: TypeAnnotation = { kind: "array", elementType: "string" };
    const to: TypeAnnotation = { kind: "array", elementType: { kind: "union", types: ["string", "number"] } };
    expect(isAssignableTo(from, to)).toBe(true);
    expect(isAssignableTo(to, from)).toBe(false);
  });

  it("checks union members recursively inside record fields", () => {
    const from: TypeAnnotation = { kind: "record", fields: { id: "string" } };
    const to: TypeAnnotation = { kind: "record", fields: { id: { kind: "union", types: ["string", "number"] } } };
    expect(isAssignableTo(from, to)).toBe(true);
  });
});

describe("formatType", () => {
  it("formats a union as `A | B`", () => {
    const union: TypeAnnotation = { kind: "union", types: ["string", "number"] };
    expect(formatType(union)).toBe("string | number");
  });

  it("formats a `T | none` union back as the `T?` sugar it desugared from", () => {
    const optional: TypeAnnotation = { kind: "union", types: ["string", "none"] };
    expect(formatType(optional)).toBe("string?");
  });
});
