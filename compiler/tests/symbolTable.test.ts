import { describe, it, expect } from "vitest";
import { SymbolTable } from "../src/typechecker/symbolTable.js";

describe("SymbolTable", () => {
  it("stores and retrieves a variable's type", () => {
    const table = new SymbolTable();
    table.declare("name", "string");
    expect(table.lookup("name")).toBe("string");
  });

  it("returns undefined for an unknown variable", () => {
    const table = new SymbolTable();
    expect(table.lookup("ghost")).toBeUndefined();
  });
});