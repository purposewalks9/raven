import type { Program } from "../ast/nodes.js";
import { SourceMapGenerator } from "../sourcemap/generator.js";
import { nativeEmitProgram } from "../native.js";

export interface EmitWithSourceMapOptions {
  sourceFile: string;
  generatedFile?: string;
  sourceContent?: string;
}

export interface EmitWithSourceMapResult {
  code: string;
  map: SourceMapGenerator;
}

/**
 * Emits JavaScript source text from a Raven AST. Phase 3: delegates to the
 * Rust emitter (`raven-core::emitter::Emitter`) instead of walking the AST
 * in TS. Public shape (`emit`/`emitWithSourceMap`) is unchanged so existing
 * call sites (`pipeline.ts`, tests) don't need to change.
 */
export class Emitter {
  /** Emits `program` as plain JavaScript, with no source-map bookkeeping. */
  emit(program: Program): string {
    return nativeEmitProgram(program).code;
  }

  /** Emits `program` as JavaScript alongside a v3 source map. */
  emitWithSourceMap(program: Program, options: EmitWithSourceMapOptions): EmitWithSourceMapResult {
    const result = nativeEmitProgram(program, {
      sourceMap: true,
      sourceFile: options.sourceFile,
      sourceContent: options.sourceContent,
    });
    // `generatedFile` is accepted for parity with the pre-port interface
    // but was never read internally by the old TS `Emitter` either — the
    // generated filename only matters to whatever writes the `.map` file
    // (`build.ts`), not to emission itself.
    if (!result.map) {
      // Only reachable if native ever changes to not honor `sourceMap: true`;
      // kept as a defensive check rather than a silent `null` map.
      throw new Error("nativeEmitProgram: expected a source map, got null");
    }
    return { code: result.code, map: SourceMapGenerator.fromRaw(result.map) };
  }
}
