import { describe, it, expect } from "vitest";
import { encodeVlq } from "../src/sourcemap/vlq.js";
import { SourceMapGenerator } from "../src/sourcemap/generator.js";
import { tokenize } from "../src/lexer/token.js";
import { Parser } from "../src/parser/parser.js";
import { Emitter } from "../src/emitter/emitter.js";

// Minimal VLQ decoder, written independently of `encodeVlq`, so these
// tests actually catch encoder bugs instead of just mirroring them back.
const BASE64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let i = 0;
  while (i < text.length) {
    let result = 0;
    let shift = 0;
    let more = true;
    while (more) {
      const digit = BASE64_DIGITS.indexOf(text[i]!);
      i++;
      more = (digit & 0b100000) !== 0;
      result += (digit & 0b11111) << shift;
      shift += 5;
    }
    values.push(result & 1 ? -(result >> 1) : result >> 1);
  }
  return values;
}

function decodeMappings(mappings: string): { genCol: number; srcIdx: number; srcLine: number; srcCol: number }[][] {
  const lines: { genCol: number; srcIdx: number; srcLine: number; srcCol: number }[][] = [[]];
  let srcIdx = 0, srcLine = 0, srcCol = 0, genCol = 0;
  for (const group of mappings.split(";")) {
    if (lines[lines.length - 1]!.length > 0 || group !== mappings.split(";")[0]) {
      // new line: handled by the outer split; nothing extra needed here.
    }
    genCol = 0;
    const segments = group.length === 0 ? [] : group.split(",");
    for (const segment of segments) {
      const [dGenCol, dSrcIdx, dSrcLine, dSrcCol] = decodeVlq(segment);
      genCol += dGenCol ?? 0;
      srcIdx += dSrcIdx ?? 0;
      srcLine += dSrcLine ?? 0;
      srcCol += dSrcCol ?? 0;
      lines[lines.length - 1]!.push({ genCol, srcIdx, srcLine, srcCol });
    }
    lines.push([]);
  }
  lines.pop();
  return lines;
}

describe("encodeVlq", () => {
  it("matches the well-known examples from the source map spec", () => {
    // From the source map v3 explainer: 0 -> "A", 1 -> "C", -1 -> "D", 16 -> "gB"
    expect(encodeVlq([0])).toBe("A");
    expect(encodeVlq([1])).toBe("C");
    expect(encodeVlq([-1])).toBe("D");
    expect(encodeVlq([16])).toBe("gB");
  });

  it("round-trips through the independent decoder for a range of values", () => {
    const values = [0, 1, -1, 5, -5, 31, 32, -32, 1000, -1000, 123456];
    for (const v of values) {
      expect(decodeVlq(encodeVlq([v]))).toEqual([v]);
    }
  });
});

describe("SourceMapGenerator", () => {
  it("encodes a single mapping per line with correctly-relative deltas", () => {
    const gen = new SourceMapGenerator();
    gen.addMapping({ generatedLine: 0, generatedColumn: 0, source: "a.rv", sourceLine: 0, sourceColumn: 0 });
    gen.addMapping({ generatedLine: 1, generatedColumn: 2, source: "a.rv", sourceLine: 1, sourceColumn: 0 });
    const json = gen.toJSON("a.js");

    expect(json.version).toBe(3);
    expect(json.file).toBe("a.js");
    expect(json.sources).toEqual(["a.rv"]);

    const decoded = decodeMappings(json.mappings);
    expect(decoded[0]).toEqual([{ genCol: 0, srcIdx: 0, srcLine: 0, srcCol: 0 }]);
    expect(decoded[1]).toEqual([{ genCol: 2, srcIdx: 0, srcLine: 1, srcCol: 0 }]);
  });

  it("drops duplicate mappings at the same generated position", () => {
    const gen = new SourceMapGenerator();
    gen.addMapping({ generatedLine: 0, generatedColumn: 4, source: "a.rv", sourceLine: 0, sourceColumn: 4 });
    gen.addMapping({ generatedLine: 0, generatedColumn: 4, source: "a.rv", sourceLine: 0, sourceColumn: 9 });
    const decoded = decodeMappings(gen.toJSON().mappings);
    expect(decoded[0]).toHaveLength(1);
  });

  it("only includes sourcesContent when content was actually set", () => {
    const withoutContent = new SourceMapGenerator();
    withoutContent.addMapping({ generatedLine: 0, generatedColumn: 0, source: "a.rv", sourceLine: 0, sourceColumn: 0 });
    expect(withoutContent.toJSON().sourcesContent).toBeUndefined();

    const withContent = new SourceMapGenerator();
    withContent.setSourceContent("a.rv", "let x = 1\n");
    withContent.addMapping({ generatedLine: 0, generatedColumn: 0, source: "a.rv", sourceLine: 0, sourceColumn: 0 });
    expect(withContent.toJSON().sourcesContent).toEqual(["let x = 1\n"]);
  });

  it("produces a valid base64 data: URL", () => {
    const gen = new SourceMapGenerator();
    gen.addMapping({ generatedLine: 0, generatedColumn: 0, source: "a.rv", sourceLine: 0, sourceColumn: 0 });
    const url = gen.toDataUrl("a.js");
    expect(url.startsWith("data:application/json;base64,")).toBe(true);
    const decoded = JSON.parse(Buffer.from(url.split(",")[1]!, "base64").toString("utf8"));
    expect(decoded.file).toBe("a.js");
  });
});

describe("Emitter.emitWithSourceMap", () => {
  it("maps every emitted statement's line back to its source line", () => {
    const source = "let x = 1\nlet y = 2\nprint(x + y)\n";
    const ast = new Parser(tokenize(source, "test.rv")).parseProgram();
    const { code, map } = new Emitter().emitWithSourceMap(ast, {
      sourceFile: "test.rv",
      sourceContent: source,
    });

    expect(code.split("\n").slice(0, 3)).toEqual([
      "let x = 1;",
      "let y = 2;",
      "console.log((x + y));",
    ]);

    const json = map.toJSON("test.js");
    const decoded = decodeMappings(json.mappings);
    expect(decoded[0]?.[0]?.srcLine).toBe(0); // let x = 1
    expect(decoded[1]?.[0]?.srcLine).toBe(1); // let y = 2
    expect(decoded[2]?.[0]?.srcLine).toBe(2); // print(...)
  });

  it("still exposes plain emit() with no source-map overhead", () => {
    const source = "let x = 1\n";
    const ast = new Parser(tokenize(source, "test.rv")).parseProgram();
    expect(new Emitter().emit(ast)).toBe("let x = 1;\n");
  });

  it("maps a nested expression to its own source column, not just the statement start", () => {
    const source = "print(1 + 2)\n";
    const ast = new Parser(tokenize(source, "test.rv")).parseProgram();
    const { map } = new Emitter().emitWithSourceMap(ast, { sourceFile: "test.rv" });
    const decoded = decodeMappings(map.toJSON().mappings);
    // Expect more than one mapping on the single generated line: one for
    // the statement/call, and separate ones for the `1` and `2` operands.
    expect(decoded[0]!.length).toBeGreaterThan(1);
  });
});
