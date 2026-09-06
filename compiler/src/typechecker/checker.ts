import { Program, TypeAnnotation } from "../ast/nodes.js";
import { Binder, SymbolBinding } from "./binder.js";
import { Diagnostic } from "../diagnostics/index.js";
import { WorkspaceRegistry, nativeRegistryOf } from "./registry.js";
import { NativeRegistry, nativeCheck, nativeCheckSource, nativeBindingsFor } from "../native.js";

export type FunctionSignature = { params: TypeAnnotation[]; returnType: TypeAnnotation };

export interface TypeCheckerOptions {
  registry?: WorkspaceRegistry;
  file?: string;
  importedFunctions?: Map<string, FunctionSignature>;
}

/**
 * The typechecker, backed by the native binding in `raven-core`. Every method
 * keeps the exact signature of the previous TypeScript implementation; the
 * checking logic itself now runs in Rust.
 *
 * Phase 2: the FFI boundary is now source-text-in (`checkSource`). The
 * `check(program)` method is kept only for the differential harness and
 * hand-built AST tests; new code should call `checkSource(source)`.
 */
export class TypeChecker {
  private readonly registry?: WorkspaceRegistry;
  private readonly file: string;
  private readonly importedFunctions: Map<string, FunctionSignature>;
  private binder = new Binder();
  private exportedFunctions = new Map<string, FunctionSignature>();

  constructor(options: TypeCheckerOptions = {}) {
    this.registry = options.registry;
    this.file = options.file ?? "<anonymous>";
    this.importedFunctions = options.importedFunctions ?? new Map();
  }

  /**
   * Check source text directly — Phase 2 path. No JSON AST crosses the boundary.
   * Diagnostics only; call `bindingsForSource` when binder data is needed.
   */
  checkSource(source: string): Diagnostic[] {
    const result = nativeCheckSource(
      source,
      this.file,
      {
        file: this.file,
        importedFunctions: Object.fromEntries([...this.importedFunctions]),
      },
      this.registry ? nativeRegistryOf(this.registry) : undefined,
    );
    // Binder/types are lazily fetched via bindingsFor; keep empty for now.
    // Preserve previous binder if caller later calls bindingsForSource.
    return result.diagnostics as Diagnostic[];
  }

  /**
   * Lazily fetch bindings/types for hover/go-to-def. Avoids building the
   * 53 KB bindings JSON on every check (Phase 1 cost). Only the language
   * server needs this; the CLI `compileFile` path does not.
   */
  bindingsForSource(source: string): { binder: Binder; types: Map<string, FunctionSignature>; diagnostics: Diagnostic[] } {
    const result = nativeBindingsFor(
      source,
      this.file,
      {
        file: this.file,
        importedFunctions: Object.fromEntries([...this.importedFunctions]),
      },
      this.registry ? nativeRegistryOf(this.registry) : undefined,
    );
    const binder = Binder.fromNative(result.bindings as SymbolBinding[]);
    const types = new Map<string, FunctionSignature>(
      Object.entries(result.types) as [string, FunctionSignature][],
    );
    this.binder = binder;
    this.exportedFunctions = types;
    return { binder, types, diagnostics: result.diagnostics as Diagnostic[] };
  }

  /**
   * Deprecated AST-in path. Kept for differential harness and hand-built AST
   * tests. Will be deleted once all callers are migrated to `checkSource`.
   */
  check(program: Program): Diagnostic[] {
    const result = nativeCheck(
      program,
      {
        file: this.file,
        importedFunctions: Object.fromEntries([...this.importedFunctions]),
      },
      this.registry ? nativeRegistryOf(this.registry) : undefined,
    );
    this.binder = Binder.fromNative(result.bindings as SymbolBinding[]);
    this.exportedFunctions = new Map<string, FunctionSignature>(
      Object.entries(result.types) as [string, FunctionSignature][],
    );
    return result.diagnostics as Diagnostic[];
  }

  getExportedFunctions(): Map<string, FunctionSignature> {
    return this.exportedFunctions;
  }

  getBinder(): Binder {
    return this.binder;
  }
}
