#!/usr/bin/env node
import { runCommand } from "./commands/run.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { newCommand } from "./commands/new.js";
import { fmtCommand } from "./commands/fmt.js";
import { replCommand } from "./commands/repl.js";
import { versionCommand } from "./commands/version.js";

/**
 * Command registry: adding a new feature (e.g. `raven lint`, `raven doc`,
 * `raven watch`) means writing one file in commands/ and adding one line
 * here — no touching the dispatch logic itself. This is the main lever
 * for "how do I integrate more features" going forward.
 */
const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  new: newCommand,
  run: runCommand,
  build: buildCommand,
  check: checkCommand,
  fmt: fmtCommand,
  repl: replCommand,
  version: versionCommand,
};

function usage(): void {
  console.log(`Raven compiler

Commands:
  raven new <name>
  raven run <file.rv>
  raven build <file.rv> [out.js] [--sourcemap|-s]
  raven check <file.rv | project-dir>
  raven fmt <file.rv>
  raven repl
  raven version`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "-h" || command === "--help") {
    return usage();
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: '${command}'\n`);
    usage();
    process.exitCode = 1;
    return;
  }

  await handler(args);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});