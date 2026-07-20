import type { Program } from "../ast/index.js";

/**
 * Placeholder — see language/specification.md ("Compilation model") and
 * roadmap.md Phase 0. First milestone: emit a `page` as a plain function
 * component (framework-agnostic DOM calls) with no reactivity yet, just to
 * get examples/hello-world round-tripping through the CLI.
 */
export function emit(program: Program): string {
  void program;
  return "// TODO: codegen not implemented yet\n";
}
