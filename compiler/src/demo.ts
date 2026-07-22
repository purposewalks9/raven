// src/demo.ts
import { tokenize } from "./lexer/token.js";
import { Parser } from "./parser/parser.js";
import { TypeChecker } from "./typechecker/checker.js";
import { Emitter } from "./emitter/emitter.js";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const source = `
val name: string = "World"
rave goat: string = "Messi"
print(goat)
print(name)
`;

console.log("=== RAVEN SOURCE ===");
console.log(source);

console.log("=== TOKENS ===");
const tokens = tokenize(source);
console.log(tokens);

console.log("=== AST ===");
const ast = new Parser(tokens).parseProgram();
console.log(JSON.stringify(ast, null, 2));

console.log("=== TYPE CHECK ===");
const errors = new TypeChecker().check(ast);
if (errors.length > 0) {
  console.log("Found type errors:");
  errors.forEach(e => console.log("  - " + e));
  process.exit(1); // stop here, don't emit broken code
}
console.log("No type errors ✔");

console.log("=== GENERATED JS ===");
const js = new Emitter().emit(ast);
console.log(js);

console.log("=== ACTUAL OUTPUT (real Node execution) ===");
writeFileSync("./tmp-demo.js", js);
const output = execSync("node ./tmp-demo.js").toString();
console.log(output);