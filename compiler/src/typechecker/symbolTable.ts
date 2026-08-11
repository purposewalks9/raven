import { TypeAnnotation } from "../ast/nodes.js";
import { SymbolBinding, SymbolOrigin } from "./binder.js";

export interface SymbolInfo {
  type: TypeAnnotation;
  constant: boolean;
  binding?: SymbolBinding;
  origin?: SymbolOrigin;
  source?: string;
}

export class SymbolTable {
  private scopes: Map<string, SymbolInfo>[] = [new Map()];

  enterScope(): void {
    this.scopes.push(new Map());
  }

  exitScope(): void {
    if (this.scopes.length === 1) {
      throw new Error("Cannot exit the global scope.");
    }
    this.scopes.pop();
  }

  declare(name: string, info: SymbolInfo): boolean {
    const current = this.scopes[this.scopes.length - 1];
    if (!current) {
      throw new Error("No active scope.");
    }

    // Check if already declared in current scope
    if (current.has(name)) {
      return false;
    }

    current.set(name, info);
    return true;
  }

  lookup(name: string): SymbolInfo | undefined {
    // Search from innermost to outermost scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const symbol = this.scopes[i]?.get(name);
      if (symbol) {
        return symbol;
      }
    }
    return undefined;
  }

  has(name: string): boolean {
    return this.lookup(name) !== undefined;
  }

  isConstant(name: string): boolean {
    return this.lookup(name)?.constant ?? false;
  }


  getScopeDepth(): number {
    return this.scopes.length;
  }

  hasInCurrentScope(name: string): boolean {
    const current = this.scopes[this.scopes.length - 1];
    return current?.has(name) ?? false;
  }

  /** Every name visible right now, from every open scope, for typo suggestions. */
  allNames(): string[] {
    const names = new Set<string>();
    for (const scope of this.scopes) {
      for (const name of scope.keys()) names.add(name);
    }
    return [...names];
  }
}