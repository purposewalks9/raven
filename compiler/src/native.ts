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
const nativeOptimizeProgramRaw = pick<(astJson: string) => string>("optimizeProgram");
const nativeEmitProgramRaw = pick<(astJson: string, optionsJson?: string | null) => string>("emitProgram");
const nativeCompileSourceRaw = pick<
  (source: string, file: string, optionsJson?: string | null, reg?: unknown) => string
>("compileSource");
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

export interface NativeEmitOptions {
  sourceMap?: boolean;
  sourceFile?: string;
  sourceContent?: string;
  /**
   * Only meaningful for `nativeCompileSource` — mirrors `compileFile`'s
   * `shouldOptimize` parameter (default `true`; `raven check` passes
   * `false` since it only reads `diagnostics`).
   */
  optimize?: boolean;
}

export interface NativeEmitResult {
  code: string;
  map: import("./sourcemap/generator.js").RawSourceMap | null;
}

export interface NativeCompileSourceResult {
  diagnostics: unknown[];
  code: string | null;
  map: import("./sourcemap/generator.js").RawSourceMap | null;
}

/**
 * Runs the native optimizer (`raven-core::optimizer::optimize`) over a
 * serialized AST. Phase 3: this is the same pass `optimizer/index.ts`'s
 * `optimize()` used to run in TS — see that module for the one intentional
 * behavior fix (model/import statements are no longer silently dropped).
 */
export function nativeOptimizeProgram<T>(ast: T): T {
  const result = nativeOptimizeProgramRaw(JSON.stringify(ast));
  return JSON.parse(result) as T;
}

/**
 * Runs the native emitter (`raven-core::emitter::Emitter`) over a
 * serialized AST, optionally building a source map alongside it.
 */
export function nativeEmitProgram<T>(ast: T, options: NativeEmitOptions = {}): NativeEmitResult {
  const result = nativeEmitProgramRaw(JSON.stringify(ast), JSON.stringify(options));
  return JSON.parse(result) as NativeEmitResult;
}

/**
 * Full native pipeline: lex + parse + check + optimize + emit in one call.
 * This is the Phase 3 goal call for `compileFile` — source text in,
 * `{ diagnostics, code, map }` out, no TS-side `Parser`/`tokenize` call and
 * no separate `optimize`/`Emitter` pass needed.
 */
export function nativeCompileSource(
  source: string,
  file: string,
  options: NativeEmitOptions = {},
  registry?: NativeRegistry,
): NativeCompileSourceResult {
  const result = nativeCompileSourceRaw(source, file, JSON.stringify(options), registry);
  return JSON.parse(result) as NativeCompileSourceResult;
}
