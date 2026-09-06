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

/**
 * Language-server entry point — pays for bindings.
 *
 * This function intentionally calls `bindingsForSource`, which builds the
 * 53–63 KB `bindings` JSON on every call. That cost is justified here
 * because the language server genuinely needs `binder` (hover, go-to-def,
 * find-references). Do NOT "simplify" `compileFile` to call this function
 * — `compileFile` never reads `binder` and must use the cheap
 * `TypeChecker.checkSource` path instead (see `compileFile` below). The two
 * functions have different costs by design; collapsing them reintroduces the
 * Phase 1 bindings cost on the CLI path (see PR #22 review).
 *
 * `checkSourceWithBindings` still parses twice (TS for AST for `optimize`/
 * `Emitter` until Phase 3, Rust for diagnostics+bindings). Phase 3 will make
 * the whole pipeline one native call and the duplicate parse disappears.
 */
export function checkSourceWithBindings(source: string, fileName = "<memory>"): CheckResult {
  // AST for optimize/emitter — stays in TS until Phase 3.
  const ast = new Parser(tokenize(source, fileName)).parseProgram();
  // Diagnostics + binder via Rust — source text in, no JSON AST in.
  const checker = new TypeChecker({ file: fileName });
  const { diagnostics, binder } = checker.bindingsForSource(source);
  return { source, ast, diagnostics, binder };
}

export function compileFile(file: string, shouldOptimize = true, options: { sourceMap?: boolean } = {}): CompileResult {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Could not read file: ${file}`);
  }

  // Cheap path: compileFile never needs binder. AST is still parsed in TS
  // for optimize/Emitter until Phase 3; diagnostics come from the cheap
  // `checkSource` FFI call (not `bindingsForSource` — see
  // `checkSourceWithBindings`, which exists for the language server only).
  const ast = new Parser(tokenize(source, file)).parseProgram();
  const diagnostics = new TypeChecker({ file }).checkSource(source);

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
