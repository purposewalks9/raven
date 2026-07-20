#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { tokenize, LexError } from "../lexer/index.js";
import { parse, ParseError } from "../parser/index.js";

function main() {
  const [, , command, file] = process.argv;

  if (!command || !["tokens", "ast", "compile"].includes(command)) {
    console.log("Usage: nova <tokens|ast|compile> <file.nova>");
    process.exit(1);
  }

  if (!file) {
    console.error("Missing input file");
    process.exit(1);
  }

  const source = readFileSync(file, "utf-8");

  try {
    const tokens = tokenize(source);

    if (command === "tokens") {
      for (const t of tokens) {
        console.log(`${t.kind.padEnd(14)} ${JSON.stringify(t.value)}`);
      }
      return;
    }

    const program = parse(tokens);

    if (command === "ast") {
      console.log(JSON.stringify(program, null, 2));
      return;
    }

    if (command === "compile") {
      console.log("// codegen not implemented yet — see compiler/src/emitter");
      console.log(`// parsed ${program.body.length} top-level declaration(s) from ${file}`);
    }
  } catch (err) {
    if (err instanceof LexError || err instanceof ParseError) {
      console.error(`nova: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();
