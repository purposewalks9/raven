// compiler/src/emitter/emitter.ts
//
// Thin delegate to the native `emitProgram` binding. Keeps the existing
// `Emitter` class shape (so call sites elsewhere in the codebase don't
// change) but every method now just serializes in, calls native, and
// deserializes out.
//
// I don't have your actual pre-port `Emitter` class here to match field-
// for-field, so double check the exact public method names/params against
// what's really there (I've matched them to what the Rust module doc
// comments say they mirror: `emit`, `emitWithSourceMap`,
// `EmitWithSourceMapOptions`) before deleting the TS implementation.

import { emitProgram } from "@raven/node"; // adjust to your actual native import path
import type { Program } from "../ast";
import type { RawSourceMap } from "../sourcemap/generator";

export interface EmitWithSourceMapOptions {
  sourceFile: string;
  generatedFile?: string;
  sourceContent?: string;
}

export interface EmitWithSourceMapResult {
  code: string;
  map: RawSourceMap;
}

/**
 * Emits JavaScript source text from a Raven AST. Delegates to the Rust
 * emitter (`raven-core::emitter::Emitter`).
 */
export class Emitter {
  /** Emits `program` as plain JavaScript, with no source-map bookkeeping. */
  emit(program: Program): string {
    const resultJson = emitProgram(JSON.stringify(program));
    const { code } = JSON.parse(resultJson) as { code: string; map: null };
    return code;
  }

  /** Emits `program` as JavaScript alongside a v3 source map. */
  emitWithSourceMap(
    program: Program,
    options: EmitWithSourceMapOptions
  ): EmitWithSourceMapResult {
    const optionsJson = JSON.stringify({
      sourceMap: true,
      sourceFile: options.sourceFile,
      sourceContent: options.sourceContent,
    });
    const resultJson = emitProgram(JSON.stringify(program), optionsJson);
    const { code, map } = JSON.parse(resultJson) as {
      code: string;
      map: RawSourceMap;
    };
    return { code, map };
  }
}
