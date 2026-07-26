import { readFileSync } from "node:fs";
import { tokenize } from "../lexer/token.js";
import { Parser } from "../parser/parser.js";
import { TypeChecker } from "../typechecker/checker.js";
import { optimize } from "../optimizer/index.js";
import { Emitter } from "../emitter/emitter.js";
import { Diagnostic, formatDiagnostic } from "../diagnostics/index.js";

export interface CompileResult {
  source: string;
  // CHANGED: was `errors: string[]`. Now carries full Diagnostic objects
  // (severity + message + source location) so printErrors can render the
  // file:line:column + caret-pointer format instead of a bare message.
  diagnostics: Diagnostic[];
  js: string | null;
}

export function compileFile(file: string, shouldOptimize = true): CompileResult {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Could not read file: ${file}`);
  }

  const ast = new Parser(tokenize(source, file)).parseProgram();
  const diagnostics = new TypeChecker().check(ast);

  if (diagnostics.some(d => d.severity === "error")) {
    return { source, diagnostics, js: null };
  }

  const program = shouldOptimize ? optimize(ast) : ast;
  const js = new Emitter().emit(program);

  return { source, diagnostics, js };
}

export function printErrors(file: string, diagnostics: Diagnostic[], source?: string): void {
  const errorCount = diagnostics.filter(d => d.severity === "error").length;
  console.error(`Found ${errorCount} error(s) in ${file}:\n`);
  for (const diagnostic of diagnostics) {
    console.error(formatDiagnostic(diagnostic, source));
    console.error("");
  }
}