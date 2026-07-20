import type { Program } from "../ast/index.js";

/**
 * Placeholder — see language/state.md ("compiler passes involved") and
 * roadmap.md Phase 2. Will build the state read/write dependency graph
 * used to generate minimal DOM patches and batch action-scoped writes.
 */
export function optimize(program: Program): Program {
  return program; // no-op for now
}
