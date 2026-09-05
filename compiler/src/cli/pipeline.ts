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
 * Phase 2 design decision (documented per prompt):
 *
 * `checkSource` now has a split FFI contract:
 * - Diagnostics are fetched via Rust `check_source` (source text in, no AST
 *   marshalling). This is the cheap path used by `compileFile`.
 * - The AST is still built in TypeScript (`tokenize` + `Parser`) for
 *   `optimize`/`Emitter` until Phase 3 ports those stages. This means
 *   `checkSource` currently parses twice (once in Rust for diagnostics, once
 *   in TS for the AST). That's intentional and temporary — Phase 3 will make
 *   the whole compile one native call and the duplicate parse + the AST-out
 *   JSON leg disappear. The alternative (ship Phase 2+3 together) was
 *   considered; we chose to keep Phase 2 standalone and pay the duplicate
 *   parse cost (≈ 150 lines lexer work) rather than delay the FFI fix.
 *
 * Once `crates/raven-core` owns the emitter, `checkSource` will return only
 * diagnostics and `compileFile` will become a single `compile_source` FFI
 * call with no AST crossing the boundary in either direction.
 */
export function checkSource(source: string, fileName = "<memory>"): CheckResult {
  // AST for optimize/emitter — stays in TS until Phase 3.
  const ast = new Parser(tokenize(source, fileName)).parseProgram();
  // Diagnostics + binder via Rust — source text in, no JSON AST in.
  // This is one Rust parse (not two) — `bindingsForSource` returns both
  // diagnostics and binder. The CLI path (`compileFile`) ignores binder, but
  // CheckResult must provide it for `buildProject` compatibility. The extra
  // bindings JSON cost is now opt-in: `checkSource` still pays it for
  // compatibility, but `nativeCheckSource` (diagnostics only) is available
  // for callers that don't need binder and want the cheaper path.
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
