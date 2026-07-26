import { readFileSync, writeFileSync } from "node:fs";
import { formatRaven } from "../../formatter/index.js";

export function fmtCommand(args: string[]): void {
  const [file] = args;
  if (!file) {
    console.error("Usage: raven fmt <file.rv>");
    process.exitCode = 1;
    return;
  }

  writeFileSync(file, formatRaven(readFileSync(file, "utf8")));
  console.log(`Formatted ${file}`);
}