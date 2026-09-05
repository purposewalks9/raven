// Extracts every `check(\`...\`)` source snippet from compiler/tests/*.test.ts
// and emits one JSONL record per snippet: { file, source, ast, ts }.
// Usage: node --import tsx benchmarks/differential/from-tests.ts <out>.jsonl
import { Parser } from "../../compiler/src/parser/parser.js";
import { tokenize } from "../../compiler/src/lexer/token.js";
import { TypeChecker } from "../../compiler/src/typechecker/checker.js";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "compiler/tests/checker.test.ts",
  "compiler/tests/recursive.test.ts",
  "compiler/tests/types.test.ts",
  "compiler/tests/symbolTable.test.ts",
];

const out = process.argv[2] ?? "/tmp/tests.jsonl";
const records: unknown[] = [];
let n = 0;

for (const path of files) {
  const text = readFileSync(path, "utf8");
  const re = /check\(\s*`([\s\S]*?)`\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    n += 1;
    const source = m[1];
    const id = `${path.split("/").pop()}:${n}`;
    let ast;
    try {
      ast = new Parser(tokenize(source, id)).parseProgram();
    } catch (e) {
      console.warn("parser failed for", id, (e as Error).message);
      continue;
    }
    const checker = new TypeChecker({ file: id });
    const ts = checker.check(ast);
    records.push({ file: id, source, ast, ts });
  }
}

writeFileSync(out, records.map(r => JSON.stringify(r)).join("\n") + "\n");
console.log(`emitted ${records.length} records to ${out}`);