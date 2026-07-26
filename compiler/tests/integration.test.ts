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

  it("declares and prints a variable with let", () => {
    const source = `
      let name = "World"
      print(name)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-let-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("World");
  });

  it("declares and prints a variable with const", () => {
    const source = `
      const name = "World"
      print(name)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-const-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("World");
  });

  it("reassigns a let variable", () => {
    const source = `
      let name = "Hello"
      name = "World"
      print(name)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-reassign-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("World");
  });

  it("handles multiple statements", () => {
    const source = `
      let x = 5
      let y = 10
      let z = x + y
      print(z)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-multi-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("15");
  });

  it("handles if statements", () => {
    const source = `
      let age = 20
      if age > 18 then
        print("Adult")
      else
        print("Minor")
      end
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-if-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("Adult");
  });

  it("handles while loops", () => {
    const source = `
      let i = 0
      let sum = 0
      while i < 5 do
        sum = sum + i
        i = i + 1
      end
      print(sum)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-while-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("10");
  });

  it("handles functions", () => {
    const source = `
      fn add(a: number, b: number): number
        return a + b
      end
      
      let result = add(5, 3)
      print(result)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-fn-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("8");
  });

  it("handles arrays", () => {
    const source = `
      let nums = [1, 2, 3, 4, 5]
      let sum = 0
      let i = 0
      while i < 5 do
        sum = sum + nums[i]
        i = i + 1
      end
      print(sum)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-array-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("15");
  });

  it("handles string concatenation", () => {
    const source = `
      let greeting = "Hello"
      let name = "World"
      let message = greeting + " " + name
      print(message)
    `;
    const tokens = tokenize(source);
    const ast = new Parser(tokens).parseProgram();
    const js = new Emitter().emit(ast);

    const tmpFile = "./tmp-string-test.js";
    writeFileSync(tmpFile, js);
    const output = execSync(`node ${tmpFile}`).toString().trim();
    unlinkSync(tmpFile);

    expect(output).toBe("Hello World");
  });
});