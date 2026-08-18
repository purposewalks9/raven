// compiler/tests/recursive.test.ts
import { describe, expect, it } from "vitest";
import { isDirectSelfAlias } from "../src/typechecker/recursive.js";
import type { TypeAnnotation } from "../src/ast/index.js";

describe("recursive types", () => {
  describe("isDirectSelfAlias", () => {
    it("flags a model that is a bare, unwrapped self-reference", () => {
      // model X: X = ... — this can never hold a real value, it's the one
      // truly broken case.
      const selfRef: TypeAnnotation = { kind: "ref", name: "Node" };
      expect(isDirectSelfAlias(selfRef, "Node")).toBe(true);
    });

    it("does not flag a self-reference wrapped in optional", () => {
      // next: Node? — this is the whole point of recursive types (a tree,
      // a linked list). It must NOT be flagged, or the feature is useless.
      const wrapped: TypeAnnotation = { kind: "optional", inner: { kind: "ref", name: "Node" } };
      expect(isDirectSelfAlias(wrapped, "Node")).toBe(false);
    });

    it("does not flag a self-reference wrapped in array", () => {
      // children: array<Node> — same reasoning, this is a normal, valid
      // recursive shape (a tree with multiple children).
      const wrapped: TypeAnnotation = { kind: "array", elementType: { kind: "ref", name: "Node" } };
      expect(isDirectSelfAlias(wrapped, "Node")).toBe(false);
    });

    it("does not flag a ref to a different name", () => {
      const otherRef: TypeAnnotation = { kind: "ref", name: "Leaf" };
      expect(isDirectSelfAlias(otherRef, "Node")).toBe(false);
    });

    it("does not flag a plain primitive or structural type", () => {
      expect(isDirectSelfAlias("string", "Node")).toBe(false);
      expect(isDirectSelfAlias({ kind: "record", fields: { id: "number" } }, "Node")).toBe(false);
    });
  });
});