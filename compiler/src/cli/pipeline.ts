import { readFileSync } from "node:fs";
import { tokenize } from "../lexer/token.js";
import { Parser } from "../parser/parser.js";
import { TypeChecker } from "../typechecker/checker.js";
import { Binder } from "../typechecker/binder.js";
import { Program } from "../ast/nodes.js";
import { SourceMapGenerator } from "../sourcemap/generator.js";
import { Diagnostic, formatDiagnostic } from "../diagnostics/index.js";
import { nativeCompileSource } from "../native.js";

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
 * `checkSourceWithBindings` still parses twice (TS for the AST the language
 * server's `Binder` needs, Rust for diagnostics+bindings) — that duplicate
 * parse is intentional and out of Phase 3 scope. `compileFile` below is the
 * one that changed: Phase 3 made it a single native call, so it no longer
 * parses in TS at all.
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

  // Phase 3: lex + parse + check + optimize + emit in one native call.
  // Previously this function parsed the source twice — once in TS
  // (`Parser`/`tokenize`, for `optimize`/`Emitter`) and once inside Rust
  // (`checkSource`, for diagnostics). `compileSource` does the whole
  // pipeline natively, so neither TS-side `Parser` call nor a separate
  // `optimize`/`Emitter` pass happens here anymore.
  //
  // `checkSourceWithBindings` (language server) intentionally still parses
  // in TS — it needs the TS-side `Binder`, out of Phase 3 scope.
  const result = nativeCompileSource(source, file, {
    sourceMap: options.sourceMap ?? false,
    sourceContent: source,
    optimize: shouldOptimize,
  });
  const diagnostics = result.diagnostics as Diagnostic[];

  if (diagnostics.some(d => d.severity === "error")) {
    return { source, diagnostics, js: null, map: null };
  }

  const map = result.map ? SourceMapGenerator.fromRaw(result.map) : null;
  return { source, diagnostics, js: result.code, map };
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
