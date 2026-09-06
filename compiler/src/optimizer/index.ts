import type { Program } from "../ast/index.js";
import { nativeOptimizeProgram } from "../native.js";

/**
 * Runs all optimization passes over `program`, returning a new, optimized
 * `Program`. Phase 3: delegates to the Rust port
 * (`raven-core::optimizer::optimize`) instead of walking the AST in TS.
 *
 * One intentional behavior difference from the pre-port implementation:
 * the old TS `optimizeStatement` switch had no case (and no default) for
 * `ModelDeclaration`/`ImportDeclaration`, so it silently deleted every
 * `model` and `import` statement whenever `optimize()` ran (which is the
 * default in `compileFile`). The Rust port passes both through unchanged
 * instead — see `raven-core::optimizer`'s module doc comment.
 */
export function optimize(program: Program): Program {
  return nativeOptimizeProgram(program);
}
