import type { Program } from "../ast/index.js";
import type { DiagnosticBag } from "../diagnostics/index.js";

/**
 * Placeholder — see language/type-system.md and roadmap.md Phase 1.
 * Will walk the Program, resolve `bind`/`click` references in UI nodes to
 * in-scope `state`/`action` declarations, infer expression types, and
 * check `match` exhaustiveness.
 */
export function typecheck(program: Program, diagnostics: DiagnosticBag): void {
  void program;
  void diagnostics;
  // Not implemented yet.
}
