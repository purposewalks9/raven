// Phase 3 differential harness — OLD side.
//
// Companion to `run.sh`'s Phase 1 harness, but for optimizer/emitter
// instead of the typechecker. Must be run against a checkout of the
// pre-Phase-3 TS optimizer/emitter (i.e. before optimizer/index.ts and
// emitter/emitter.ts were swapped to native delegates) — e.g.
// `git show <pre-phase-3-commit>:compiler/src/...` restored to a temp
// checkout, since once the swap lands this file's own imports would just
// call back into native and stop being an independent reference.
//
// Usage: node --import tsx benchmarks/differential/phase3-old.mts <files...>
// Writes JSON results to the path in OUT_PATH (default: stdout).
import { readFileSync, writeFileSync } from "node:fs";
import { tokenize } from "../../compiler/src/lexer/token.js";
import { Parser } from "../../compiler/src/parser/parser.js";
import { optimize } from "../../compiler/src/optimizer/index.js";
import { Emitter } from "../../compiler/src/emitter/emitter.js";

interface FileResult {
  optimizedJs: string;
  unoptimizedJs: string;
  error?: string;
}

const files = process.argv.slice(2);
const results: Record<string, FileResult> = {};

for (const file of files) {
  try {
    const source = readFileSync(file, "utf8");
    const ast = new Parser(tokenize(source, file)).parseProgram();
    const optimizedJs = new Emitter().emit(optimize(ast));
    const unoptimizedJs = new Emitter().emit(ast);
    results[file] = { optimizedJs, unoptimizedJs };
  } catch (e) {
    results[file] = { optimizedJs: "", unoptimizedJs: "", error: String(e) };
  }
}

const outPath = process.env.OUT_PATH ?? "/tmp/raven-phase3-old.json";
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.error(`Processed ${files.length} files (old TS pipeline) -> ${outPath}`);
