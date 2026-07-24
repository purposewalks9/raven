import { describe, it, expect } from "vitest";
import { SymbolTable } from "../src/typechecker/symbolTable.js";

describe("SymbolTable", () => {
  it("stores and retrieves a variable's type", () => {
    const table = new SymbolTable();
    table.declare("name", { type: "string", constant: false });
    expect(table.lookup("name")?.type).toBe("string");
  });

  it("returns undefined for an unknown variable", () => {
    const table = new SymbolTable();
    expect(table.lookup("ghost")).toBeUndefined();
  });

  it("hides inner-scope variables from outer scope", () => {
    const table = new SymbolTable();
    table.enterScope();
    table.declare("x", { type: "number", constant: false });
    table.exitScope();
    expect(table.lookup("x")).toBeUndefined();
  });

  it("lets inner scopes see outer variables", () => {
    const table = new SymbolTable();
    table.declare("x", { type: "number", constant: false });
    table.enterScope();
    expect(table.lookup("x")?.type).toBe("number");
    table.exitScope();
  });

  it("allows the same name in different scopes", () => {
    const table = new SymbolTable();
    table.declare("x", { type: "number", constant: false });
    table.enterScope();
    const success = table.declare("x", { type: "string", constant: false });
    expect(success).toBe(true); // shadowing allowed
    table.exitScope();
  });
});