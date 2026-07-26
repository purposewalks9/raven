import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { compileFile, printErrors } from "../pipeline.js";

export function buildCommand(args: string[]): void {
  const [file, outFile] = args;
  if (!file) {
    console.error("Usage: raven build <file.rv> [out.js]");
    process.exitCode = 1;
    return;
  }

  const { source, diagnostics, js } = compileFile(file);
  if (js === null) {
    printErrors(file, diagnostics, source);
    process.exitCode = 1;
    return;
  }

  const outputFile = outFile ?? join(dirname(file), `${basename(file, ".rv")}.js`);
  writeFileSync(outputFile, js);
  console.log(`Built ${outputFile}`);
}