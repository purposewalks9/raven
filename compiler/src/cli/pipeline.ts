// compiler/src/cli/pipeline.ts — Phase 3 change only.
//
// I don't have your actual pipeline.ts in this session, so this is a
// worked example of the ONE change Phase 3 asks for here, not a full file
// to drop in wholesale: `compileFile` stops doing its own
// lex -> parse -> (TS) check -> optimize -> emit chain and instead makes a
// single call into the native `compileSource`. Splice this shape into your
// real file; leave `checkSourceWithBindings` and everything else in
// pipeline.ts untouched (LSP still needs the TS-side AST/binder — out of
// Phase 3 scope, per the design doc).

import { compileSource } from "@raven/node"; // adjust to your actual native import path
import type { Diagnostic } from "../diagnostics";

export interface CompileFileOptions {
  sourceMap?: boolean;
  registrySnapshot?: string; // see the note below on registry_json
}

export interface CompileFileResult {
  diagnostics: Diagnostic[];
  code: string | null;
  map: Record<string, unknown> | null;
}

/**
 * Compiles a single file's source text to JS, replacing the old
 * lex -> parse -> check -> optimize -> emit chain (which parsed twice: once
 * in TS for the old checker, once again for the old optimizer/emitter)
 * with one native call.
 *
 * NOTE on `registrySnapshot`: `compile_source`'s Rust side currently
 * accepts an optional JSON registry blob but doesn't do anything with it
 * yet (see the note in `phase3.rs`) — cross-file `model` resolution needs
 * confirming against your real `registry.rs` before this parameter is
 * meaningful. Until that's resolved, multi-file/workspace compiles should
 * keep going through whatever your existing TS-side registry path is;
 * only single-file compiles are safe to route through this yet.
 */
export function compileFile(
  source: string,
  file: string,
  options: CompileFileOptions = {}
): CompileFileResult {
  const optionsJson = JSON.stringify({
    sourceMap: options.sourceMap ?? false,
    sourceFile: file,
  });

  const resultJson = compileSource(
    source,
    file,
    optionsJson,
    options.registrySnapshot
  );

  return JSON.parse(resultJson) as CompileFileResult;
}
