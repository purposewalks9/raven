import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { tokenize } from "../../lexer/token";
import { Parser } from "../../parser/parser.js";
import { optimize } from "../../optimizer/index.js";
import { Emitter } from "../../emitter/emitter.js";

export async function replCommand(): Promise<void> {
  const rl = createInterface({ input, output });
  console.log("Raven REPL — type 'exit' or 'quit' to leave.");

  for (;;) {
    const line = await rl.question("> ");
    if (["exit", "quit"].includes(line.trim())) break;
    if (line.trim() === "") continue;

    try {
      const source = `print(${line})`;
      const ast = new Parser(tokenize(source, "<repl>")).parseProgram();
      const js = new Emitter().emit(optimize(ast));
      spawnSync(process.execPath, ["-e", js], { stdio: "inherit" });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    }
  }

  rl.close();
}