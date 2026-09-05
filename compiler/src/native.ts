import * as RavenNode from "raven-node";
import type { Registry as NativeRegistryType } from "raven-node";

const RavenNodeAny = RavenNode as unknown as Record<string, unknown>;
const RavenNodeDefault = (RavenNodeAny.default as Record<string, unknown> | undefined) ?? {};

function pick<T>(name: string): T {
  return ((RavenNodeAny[name] as T) ?? (RavenNodeDefault[name] as T)) as T;
}

const nativeCheckProgram = pick<(ast: string, opts?: string | null, reg?: unknown) => string>("checkProgram");
const nativeCheckSourceRaw = pick<(src: string, file: string, opts?: string | null, reg?: unknown) => string>("checkSource");
const nativeBindingsForRaw = pick<(src: string, file: string, opts?: string | null, reg?: unknown) => string>("bindingsFor");
export const NativeRegistry = pick<new () => NativeRegistryType>("Registry") as unknown as typeof RavenNode.Registry;
export type NativeRegistry = NativeRegistryType;

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

export interface NativeSourceCheckResult {
  diagnostics: unknown[];
}

export interface NativeBindingsResult {
  diagnostics: unknown[];
  bindings: unknown[];
  types: Record<string, { params: unknown[]; returnType: unknown }>;
}

/**
 * Run the native typechecker over source text. `registry` is forwarded so a
 * single native registry accumulates models across multiple calls.
 *
 * This is the Phase 2 FFI boundary: source text in, diagnostics out.
 * The TS `tokenize` + `Parser` step is now inside `raven-core`; no JSON AST
 * crosses the boundary here.
 */
export function nativeCheckSource(
  source: string,
  file: string,
  options: NativeCheckOptions = {},
  registry?: NativeRegistry,
): NativeSourceCheckResult {
  const result = nativeCheckSourceRaw(
    source,
    file,
    JSON.stringify(options),
    registry,
  );
  return JSON.parse(result) as NativeSourceCheckResult;
}

/**
 * Lazily fetch bindings/types for hover/go-to-def. Avoids building the
 * 53–63 KB bindings JSON on every `checkSource` call (Phase 1 cost).
 */
export function nativeBindingsFor(
  source: string,
  file: string,
  options: NativeCheckOptions = {},
  registry?: NativeRegistry,
): NativeBindingsResult {
  const result = nativeBindingsForRaw(
    source,
    file,
    JSON.stringify(options),
    registry,
  );
  return JSON.parse(result) as NativeBindingsResult;
}

/**
 * Deprecated Phase 1 entry: JSON AST in. Kept only for differential harness
 * checker-in-isolation tests. New code must use `nativeCheckSource` /
 * `nativeBindingsFor`. Will be deleted once TS side no longer calls it.
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
