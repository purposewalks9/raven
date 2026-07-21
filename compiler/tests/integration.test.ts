import { describe, it, expect } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tokenize } from "../src/lexer/token.js";
import { Parser } from "../src/parser/parser.js";
import { Emitter } from "../src/emitter/emitter.js";

describe("integration", () => {
  it("runs source through the full pipeline to real output", () => {
    const source = `print("Hello, World!")`;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-integration-output.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("Hello, World!");
  });
});