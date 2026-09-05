import { Program, TypeAnnotation } from "../ast/nodes.js";
import { Binder, SymbolBinding } from "./binder.js";
import { Diagnostic } from "../diagnostics/index.js";
import { WorkspaceRegistry, nativeRegistryOf } from "./registry.js";
import { NativeRegistry, nativeCheck } from "../native.js";

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