import { Program, Statement, Expression, TypeAnnotation } from "../ast/nodes.js";
import { SymbolTable } from "./symbolTable.js";

export class TypeChecker {
    private symbolTable = new SymbolTable();
    private errors: string[] = [];

    check(program: Program): string[] {
        this.errors = [];
        for (const stmt of program.body) {
            this.checkStatement(stmt);
        }
        return this.errors;
    }

    private checkStatement(node: Statement): void {
        switch (node.type) {
            case "VariableDeclaration": {
                const actualType = this.inferType(node.value);

                if (node.typeAnnotation && node.typeAnnotation !== actualType) {
                    this.errors.push(
                        `Type mismatch: variable '${node.name}' declared as '${node.typeAnnotation}' but assigned a value of type '${actualType}'`
                    );
                }
                this.symbolTable.declare(node.name, node.typeAnnotation ?? actualType);
                break;
            }
            case "PrintStatement": {
                this.checkExpression(node.argument);
                break;
            }
            default:
                throw new Error(`Unknown statement type: ${(node as any).type}`);
        }
    }

    private checkExpression(node: Expression): TypeAnnotation {
        return this.inferType(node);
    }
  private inferType(node: Expression): TypeAnnotation {
    switch (node.type) {
        case "StringLiteral":
            return "string";
        case "NumberLiteral":
            return "number";
        case "BooleanLiteral":          // NEW
            return "boolean";
        case "Identifier": {
            const type = this.symbolTable.lookup(node.name);
            if (!type) {
                this.errors.push(`Undeclared variable: '${node.name}'`);
                return "string";
            }
            return type;
        }
        default:
            throw new Error(`Cannot infer type for: ${(node as any).type}`);
    }
}
}