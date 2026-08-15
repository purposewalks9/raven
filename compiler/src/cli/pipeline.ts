import { readFileSync } from "node:fs";
import { tokenize } from "../lexer/token.js";
import { Parser } from "../parser/parser.js";
import { TypeChecker } from "../typechecker/checker.js";
import { Binder } from "../typechecker/binder.js";
import { Program } from "../ast/nodes.js";
import { optimize } from "../optimizer/index.js";
import { Emitter } from "../emitter/emitter.js";
import { SourceMapGenerator } from "../sourcemap/generator.js";
import { Diagnostic, formatDiagnostic } from "../diagnostics/index.js";

export interface CompileResult {
  source: string;
  diagnostics: Diagnostic[];
  js: string | null;
  map: SourceMapGenerator | null;
}

export interface CheckResult {
  source: string;
  ast: Program;
  diagnostics: Diagnostic[];
  binder: Binder;
}

export function checkSource(source: string, fileName = "<memory>"): CheckResult {
  const ast = new Parser(tokenize(source, fileName)).parseProgram();
  const checker = new TypeChecker();
  const diagnostics = checker.check(ast);
  return { source, ast, diagnostics, binder: checker.getBinder() };
}

export function compileFile(file: string, shouldOptimize = true, options: { sourceMap?: boolean } = {}): CompileResult {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Could not read file: ${file}`);
  }

  const { ast, diagnostics } = checkSource(source, file);

  if (diagnostics.some(d => d.severity === "error")) {
    return { source, diagnostics, js: null, map: null };
  }

  const program = shouldOptimize ? optimize(ast) : ast;

  if (options.sourceMap) {
    const { code, map } = new Emitter().emitWithSourceMap(program, {
      sourceFile: file,
      sourceContent: source,
    });
    return { source, diagnostics, js: code, map };
  }

  const js = new Emitter().emit(program);
  return { source, diagnostics, js, map: null };
}

export function printErrors(file: string, diagnostics: Diagnostic[], source?: string): void {
  const useColor = process.stdout.isTTY === true;
  const errorCount = diagnostics.filter(d => d.severity === "error").length;
  console.error(`Found ${errorCount} error(s) in ${file}:\n`);
  for (const diagnostic of diagnostics) {
    console.error(formatDiagnostic(diagnostic, source, useColor));
    console.error("");
  }
}