import { spawnSync } from "node:child_process";
import { compileFile, printErrors } from "../pipeline.js";

export function runCommand(args: string[]): void {
  const [file] = args;
  if (!file) {
    console.error("Usage: raven run <file.rv>");
    process.exitCode = 1;
    return;
  }

  const { source, diagnostics, js } = compileFile(file);
  if (js === null) {
    printErrors(file, diagnostics, source);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(process.execPath, ["-e", js], { stdio: "inherit" });
  if (result.status !== null) process.exitCode = result.status;
}