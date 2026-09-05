import {
  checkProgram as nativeCheckProgram,
  Registry as NativeRegistry,
} from "raven-node";

export { NativeRegistry };

/**
 * Options passed over the FFI boundary to the native checker.
 */
export interface NativeCheckOptions {
  file?: string;
  importedFunctions?: Record<string, { params: unknown[]; returnType: unknown }>;
}

export interface NativeCheckResult {
  diagnostics: unknown[];
  bindings: unknown[];
  types: Record<string, { params: unknown[]; returnType: unknown }>;
}

/**
 * Run the native typechecker over a JSON AST. `registry` is forwarded so a
 * single native registry accumulates models across multiple calls, the way
 * `project.ts` shares one `WorkspaceRegistry` across every file.
 */
export function nativeCheck(
  ast: unknown,
  options: NativeCheckOptions = {},
  registry?: NativeRegistry,
): NativeCheckResult {
  const result = nativeCheckProgram(
    JSON.stringify(ast),
    JSON.stringify(options),
    registry,
  );
  return JSON.parse(result) as NativeCheckResult;
}