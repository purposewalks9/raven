import { describe, it, expect } from "vitest";
import { checkProgram, Registry } from "raven-node";

const ast = (body: unknown[]) => ({ type: "Program", body });

function loc(start: number, end: number) {
  return { file: "t.rv", line: 1, column: start, start, end };
}

describe("raven-node FFI", () => {
  describe("checkProgram", () => {
    it("reports type-checking diagnostics on a hand-built AST", () => {
      const program = ast([
        {
          type: "VariableDeclaration",
          name: "x",
          value: { type: "NumberLiteral", value: 42, location: loc(4, 6) },
          typeAnnotation: "number",
          location: loc(0, 11),
        },
        {
          type: "VariableDeclaration",
          name: "y",
          value: { type: "Identifier", name: "x", location: loc(12, 13) },
          typeAnnotation: "string",
          location: loc(12, 13),
        },
      ]);
      const result = JSON.parse(checkProgram(JSON.stringify(program), JSON.stringify({ file: "t.rv" })));
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "RAV2002",
        severity: "error",
        message: "Type mismatch in declaration of 'y': expected 'string', but got 'number'",
      });
    });

    it("returns no diagnostics for a valid program and still binds symbols", () => {
      const program = ast([
        {
          type: "VariableDeclaration",
          name: "x",
          value: { type: "NumberLiteral", value: 7, location: loc(4, 5) },
          typeAnnotation: "number",
          location: loc(0, 11),
        },
      ]);
      const result = JSON.parse(checkProgram(JSON.stringify(program), JSON.stringify({ file: "t.rv" })));
      expect(result.diagnostics).toEqual([]);
      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0]).toMatchObject({
        name: "x",
        kind: "variable",
        type: "number",
        origin: "local",
      });
    });
  });

  describe("Registry", () => {
    it("publishes and looks up a model", () => {
      const registry = new Registry();
      const publish = JSON.parse(
        registry.publish(
          "User",
          JSON.stringify({ kind: "record", fields: { id: "number" } }),
          false,
          "models.rv",
          JSON.stringify(loc(0, 5)),
        ),
      );
      expect(publish.ok).toBe(true);

      const model = JSON.parse(registry.lookup("User")!);
      expect(model.name).toBe("User");
      expect(model.type).toEqual({ kind: "record", fields: { id: "number" } });
      expect(registry.names()).toEqual(["User"]);
      expect(registry.all()).toHaveLength(1);
    });

    it("rejects a conflicting publish with the existing model attached", () => {
      const registry = new Registry();
      registry.publish(
        "User",
        JSON.stringify({ kind: "record", fields: { id: "number" } }),
        false,
        "models.rv",
        JSON.stringify(loc(0, 5)),
      );
      const conflict = JSON.parse(
        registry.publish(
          "User",
          JSON.stringify({ kind: "record", fields: { id: "string" } }),
          false,
          "other.rv",
          JSON.stringify(loc(0, 5)),
        ),
      );
      expect(conflict.ok).toBe(false);
      expect(conflict.message).toContain("already published with a different shape");
      expect(conflict.existing.file).toBe("models.rv");
    });

    it("shares state across successive checkProgram calls", () => {
      const registry = new Registry();
      const models = [
        {
          type: "ModelDeclaration",
          name: "Point",
          external: false,
          value: {
            type: "ObjectLiteral",
            properties: [
              { key: "x", value: { type: "NumberLiteral", value: 1, location: loc(0, 1) } },
              { key: "y", value: { type: "NumberLiteral", value: 2, location: loc(0, 1) } },
            ],
            location: loc(0, 1),
          },
          location: loc(0, 5),
        },
      ];
      checkProgram(JSON.stringify(ast(models)), JSON.stringify({ file: "models.rv" }), registry);
      expect(registry.names()).toContain("Point");
    });
  });
});