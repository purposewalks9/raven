import { describe, expect, it } from "vitest";
import { formatType, isAssignableTo, sameType, unionType, makeUnion, normalizeType } from "../src/typechecker/types.js";
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
it("compares tuples positionally, order and length both matter", () => {
  const a: TypeAnnotation = { kind: "tuple", elements: ["number", "string"] };
  const b: TypeAnnotation = { kind: "tuple", elements: ["number", "string"] };
  const reordered: TypeAnnotation = { kind: "tuple", elements: ["string", "number"] };
  const shorter: TypeAnnotation = { kind: "tuple", elements: ["number"] };

  expect(sameType(a, b)).toBe(true);
  expect(sameType(a, reordered)).toBe(false); // tuples care about order, unlike unions
  expect(sameType(a, shorter)).toBe(false);
});

it("assigns tuples positionally and rejects arity mismatches", () => {
  const numberString: TypeAnnotation = { kind: "tuple", elements: ["number", "string"] };
  const numberAny: TypeAnnotation = { kind: "tuple", elements: ["number", "any"] };
  const threeMember: TypeAnnotation = { kind: "tuple", elements: ["number", "string", "boolean"] };

  expect(isAssignableTo(numberString, numberString)).toBe(true);
  expect(isAssignableTo(numberString, numberAny)).toBe(true);   // any absorbs, same as elsewhere
  expect(isAssignableTo(numberString, threeMember)).toBe(false); // no width subtyping
  expect(isAssignableTo(threeMember, numberString)).toBe(false);
});

it("formats tuple types with bracket notation", () => {
  expect(formatType({ kind: "tuple", elements: ["number", "string"] })).toBe("[number, string]");
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


  it("produces the same shape as unionType (regression: wrong 'types' property)", () => {
    const built = makeUnion(["number", "string"]);
    expect(built).toEqual({ kind: "union", variants: ["number", "string"] });
    expect(formatType(built)).toBe("number | string");
  });

  it("assigns a union into a union when every source variant is covered", () => {
    const numberOrString: TypeAnnotation = { kind: "union", variants: ["number", "string"] };
    expect(isAssignableTo(numberOrString, numberOrString)).toBe(true);
    expect(isAssignableTo({ kind: "union", variants: ["number", "string"] }, { kind: "union", variants: ["string", "number", "boolean"] })).toBe(true);
    expect(isAssignableTo({ kind: "union", variants: ["number", "boolean"] }, { kind: "union", variants: ["number", "string"] })).toBe(false);
  });

  describe("literal types", () => {
    it("treats identical literal values as the same type", () => {
      expect(sameType({ kind: "literal", value: "admin" }, { kind: "literal", value: "admin" })).toBe(true);
      expect(sameType({ kind: "literal", value: "admin" }, { kind: "literal", value: "user" })).toBe(false);
      // A literal is a narrower thing than its base primitive, not the same type as it.
      expect(sameType({ kind: "literal", value: "admin" }, "string")).toBe(false);
    });

    it("widens a literal into its base primitive, but not the reverse", () => {
      expect(isAssignableTo({ kind: "literal", value: "admin" }, "string")).toBe(true);
      expect(isAssignableTo({ kind: "literal", value: 42 }, "number")).toBe(true);
      expect(isAssignableTo({ kind: "literal", value: true }, "boolean")).toBe(true);
      // Narrowing the other direction requires the exact value.
      expect(isAssignableTo("string", { kind: "literal", value: "admin" })).toBe(false);
    });

    it("only assigns a literal into a literal target with the same value", () => {
      expect(isAssignableTo({ kind: "literal", value: "admin" }, { kind: "literal", value: "admin" })).toBe(true);
      expect(isAssignableTo({ kind: "literal", value: "admin" }, { kind: "literal", value: "user" })).toBe(false);
    });

    it("assigns a literal into a union of literals it belongs to", () => {
      const roles: TypeAnnotation = { kind: "union", variants: [{ kind: "literal", value: "admin" }, { kind: "literal", value: "user" }] };
      expect(isAssignableTo({ kind: "literal", value: "admin" }, roles)).toBe(true);
      expect(isAssignableTo({ kind: "literal", value: "guest" }, roles)).toBe(false);
      // The bare base primitive doesn't satisfy a union of literals either.
      expect(isAssignableTo("string", roles)).toBe(false);
    });

    it("rejects a literal target for a non-literal, non-matching-primitive source", () => {
      expect(isAssignableTo({ kind: "array", elementType: "string" }, { kind: "literal", value: "admin" })).toBe(false);
      expect(isAssignableTo({ kind: "literal", value: 1 }, { kind: "literal", value: "1" })).toBe(false);
    });

    it("normalizes a literal type to itself", () => {
      expect(normalizeType({ kind: "literal", value: "admin" })).toEqual({ kind: "literal", value: "admin" });
    });

    it("formats string, number, and boolean literal types", () => {
      expect(formatType({ kind: "literal", value: "admin" })).toBe('"admin"');
      expect(formatType({ kind: "literal", value: 42 })).toBe("42");
      expect(formatType({ kind: "literal", value: true })).toBe("true");
      expect(formatType(unionType([{ kind: "literal", value: "admin" }, { kind: "literal", value: "user" }])))
        .toBe('"admin" | "user"');
    });

    it("any still absorbs literal types in both directions", () => {
      expect(isAssignableTo({ kind: "literal", value: "admin" }, "any")).toBe(true);
      expect(isAssignableTo("any", { kind: "literal", value: "admin" })).toBe(true);
    });
  });
});
