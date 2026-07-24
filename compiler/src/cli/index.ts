#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { tokenize } from "../lexer/token.js";
import { Parser } from "../parser/parser.js";
import { TypeChecker } from "../typechecker/checker.js";
import { optimize } from "../optimizer/index.js";
import { Emitter } from "../emitter/emitter.js";
import { formatRaven } from "../formatter/index.js";

function compileFile(file: string, shouldOptimize = true): { js: string; errors: string[] } {
  const source = readFileSync(file, "utf8");
  const ast = new Parser(tokenize(source, file)).parseProgram();
  const errors = new TypeChecker().check(ast);
  const program = shouldOptimize ? optimize(ast) : ast;
  return { js: new Emitter().emit(program), errors };
}

function usage(): void {
  console.log(`Raven compiler\n\nCommands:\n  raven new <name>\n  raven run <file.rv>\n  raven build <file.rv> [out.js]\n  raven check <file.rv>\n  raven fmt <file.rv>\n  raven repl\n  raven version`);
}

async function main(): Promise<void> {
  const [command, file, outFile] = process.argv.slice(2);

  if (!command) return usage();
  if (command === "version") return console.log("0.0.1");
  if (command === "new") {
    const name = file ?? "hello-raven";
    mkdirSync(name, { recursive: true });
    writeFileSync(join(name, "main.rv"), 'print("Hello from Raven!")\n');
    return console.log(`Created ${name}/main.rv`);
  }
  if (command === "fmt") {
    if (!file) return usage();
    writeFileSync(file, formatRaven(readFileSync(file, "utf8")));
    return console.log(`Formatted ${file}`);
  }
  if (command === "repl") {
    const rl = createInterface({ input, output });
    for (;;) {
      const line = await rl.question("> ");
      if (["exit", "quit"].includes(line.trim())) break;
      const source = `print(${line})`;
      const ast = new Parser(tokenize(source, "<repl>")).parseProgram();
      const js = new Emitter().emit(optimize(ast));
      spawnSync(process.execPath, ["-e", js], { stdio: "inherit" });
    }
    rl.close();
    return;
  }

  if (!file) return usage();
  const { js, errors } = compileFile(file);
  if (errors.length > 0) {
    errors.forEach(error => console.error(`error: ${error}`));
    process.exitCode = 1;
    return;
  }
  if (command === "check") return console.log(`${file}: ok`);
  if (command === "build") {
    const outputFile = outFile ?? join(dirname(file), `${basename(file, ".rv")}.js`);
    writeFileSync(outputFile, js);
    return console.log(`Built ${outputFile}`);
  }
  if (command === "run") {
    spawnSync(process.execPath, ["-e", js], { stdio: "inherit" });
    return;
  }

  usage();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
