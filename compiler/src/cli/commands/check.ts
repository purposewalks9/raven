import { statSync } from "node:fs";
import { compileFile, printErrors } from "../pipeline.js";
import { buildProject } from "../../project/project.js";
import { formatDiagnostic } from "../../diagnostics/index.js";

export function checkCommand(args: string[]): void {
  const [target] = args;
  if (!target) {
    console.error("Usage: raven check <file.rv | project-directory>");
    process.exitCode = 1;
    return;
  }

  if (statSync(target).isDirectory()) {
    checkProjectDirectory(target);
    return;
  }

  const { source, diagnostics } = compileFile(target, false);
  const hasErrors = diagnostics.some(d => d.severity === "error");

  if (hasErrors) {
    printErrors(target, diagnostics, source);
    process.exitCode = 1;
    return;
  }

  console.log(`${target}: ok`);
}

function checkProjectDirectory(dir: string): void {
  const result = buildProject(dir);
  const sourceByFile = new Map(result.files.map(f => [f.path, f.source]));
  const useColor = process.stdout.isTTY === true;

  if (result.diagnostics.length === 0) {
    console.log(`${dir}: ok (${result.files.length} file(s), ${result.registry.all().length} model(s) published)`);
    return;
  }

  const errorCount = result.diagnostics.filter(d => d.severity === "error").length;
  console.error(`Found ${errorCount} error(s) across ${result.files.length} file(s):\n`);
  for (const diagnostic of result.diagnostics) {
    console.error(formatDiagnostic(diagnostic, sourceByFile.get(diagnostic.file), useColor));
    console.error("");
  }

  if (result.hasErrors) {
    process.exitCode = 1;
  }
}