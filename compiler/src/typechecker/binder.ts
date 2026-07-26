import { SourceLocation, TypeAnnotation } from "../ast/nodes.js";

export type SymbolKind = "variable" | "constant" | "parameter" | "function";

export interface SymbolBinding {
  name: string;
  kind: SymbolKind;
  type: TypeAnnotation;
  declaration: SourceLocation;
  references: SourceLocation[];
}

function contains(loc: SourceLocation, offset: number): boolean {
  return offset >= loc.start && offset <= loc.end;
}

export class Binder {
  private bindings: SymbolBinding[] = [];

  /** Call once, at the same point the checker declares a symbol. */
  declare(name: string, kind: SymbolKind, type: TypeAnnotation, location: SourceLocation): SymbolBinding {
    const binding: SymbolBinding = { name, kind, type, declaration: location, references: [] };
    this.bindings.push(binding);
    return binding;
  }

  /** Call at the same point the checker resolves a lookup for a use. */
  reference(binding: SymbolBinding | undefined, location: SourceLocation): void {
    if (binding) binding.references.push(location);
  }

  all(): SymbolBinding[] {
    return this.bindings;
  }

  bindingAt(offset: number): SymbolBinding | undefined {
    let match: SymbolBinding | undefined;
    for (const binding of this.bindings) {
      if (contains(binding.declaration, offset)) match = binding;
      else if (binding.references.some(ref => contains(ref, offset))) match = binding;
    }
    return match;
  }
}
