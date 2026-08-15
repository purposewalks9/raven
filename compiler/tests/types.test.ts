import { describe, expect, it } from "vitest";
import { formatType, isAssignableTo, sameType, unionType, makeUnion } from "../src/typechecker/types.js";
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

  it("parenthesizes a union or optional element type inside an array", () => {
    // Without parens `number | string[]` reads as `number | (string[])`.
    expect(formatType({ kind: "array", elementType: { kind: "union", variants: ["number", "string"] } }))
      .toBe("(number | string)[]");
    expect(formatType({ kind: "array", elementType: { kind: "optional", inner: "number" } }))
      .toBe("(number?)[]");
  });

  // Regression: `makeUnion` used to build `{ kind: "union", types: [...] }` —
  // the wrong property name — so every value it produced was invisible to
  // `sameType`/`isAssignableTo`/`formatType`, which all read `.variants`.
  // This broke `T?` and `T | U` annotations parsed straight from Raven source.
  it("produces the same shape as unionType (regression: wrong 'types' property)", () => {
    const built = makeUnion(["number", "string"]);
    expect(built).toEqual({ kind: "union", variants: ["number", "string"] });
    expect(formatType(built)).toBe("number | string");
  });

  // Regression: `isAssignableTo` checked "is the target a union?" before
  // "is the source a union?", so comparing two unions asked "is the whole
  // source assignable to a single variant of the target?" instead of
  // "is every source variant assignable to some target variant?" — which
  // made an identical union type wrongly fail to assign to itself.
  it("assigns a union into a union when every source variant is covered", () => {
    const numberOrString: TypeAnnotation = { kind: "union", variants: ["number", "string"] };
    expect(isAssignableTo(numberOrString, numberOrString)).toBe(true);
    expect(isAssignableTo({ kind: "union", variants: ["number", "string"] }, { kind: "union", variants: ["string", "number", "boolean"] })).toBe(true);
    expect(isAssignableTo({ kind: "union", variants: ["number", "boolean"] }, { kind: "union", variants: ["number", "string"] })).toBe(false);
  });
});
