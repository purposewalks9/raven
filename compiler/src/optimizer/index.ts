// compiler/src/optimizer/index.ts
//
// Thin delegate to the native `optimizeProgram` binding. Public signature
// (the `optimize` function name and its `Program -> Program` shape) is
// unchanged from the pre-port TS implementation — only the body moved.
//
// I don't have your actual pre-port file to diff against here, so match
// this against your real export name/signature before deleting the old
// implementation; the body below is what should replace it once confirmed.

import { optimizeProgram } from "@raven/node"; // adjust to your actual native import path
import type { Program } from "../ast";

/**
 * Runs all optimization passes over `program`, returning a new, optimized
 * `Program`. Delegates to the Rust port (`raven-core::optimizer::optimize`);
 * see that module's doc comment for the one intentional behavior diff
 * (model/import statements are no longer silently dropped).
 */
export function optimize(program: Program): Program {
  const resultJson = optimizeProgram(JSON.stringify(program));
  return JSON.parse(resultJson) as Program;
}
