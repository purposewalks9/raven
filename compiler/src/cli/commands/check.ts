import { compileFile, printErrors } from "../pipeline.js";

export function checkCommand(args: string[]): void {
  const [file] = args;
  if (!file) {
    console.error("Usage: raven check <file.rv>");
    process.exitCode = 1;
    return;
  }

  const { source, diagnostics } = compileFile(file, false);
  const hasErrors = diagnostics.some(d => d.severity === "error");

  if (hasErrors) {
    printErrors(file, diagnostics, source);
    process.exitCode = 1;
    return;
  }

  console.log(`${file}: ok`);
}