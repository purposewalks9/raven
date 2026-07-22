import { TypeAnnotation } from "../ast/nodes.js";

export class SymbolTable {
    private symbols = new Map<string, TypeAnnotation>();

    declare(name: string, type: TypeAnnotation): void {
        this.symbols.set(name, type);
    }

    lookup(name: string): TypeAnnotation | undefined {
        return this.symbols.get(name);
    }

    has(name: string): boolean {
        return this.symbols.has(name);
    }
}