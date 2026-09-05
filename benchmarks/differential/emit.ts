import { Parser } from "../../compiler/src/parser/parser.js";
import { tokenize } from "../../compiler/src/lexer/token.js";
import { TypeChecker } from "../../compiler/src/typechecker/checker.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: emit.ts <fixture-dir>");
  process.exit(1);
}
for (const file of readdirSync(dir).filter(f => f.endsWith(".rv")).sort()) {
  const source = readFileSync(join(dir, file), "utf8");
  const ast = new Parser(tokenize(source, file)).parseProgram();
  const checker = new TypeChecker({ file });
  const diags = checker.check(ast);
  console.log(JSON.stringify({ file, source, ast, ts: diags }));
}
