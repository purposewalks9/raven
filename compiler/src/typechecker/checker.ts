import {
  Program,
  Statement,
  Expression,
  TypeAnnotation,
  VariableDeclaration,
  ConstantDeclaration,
  Assignment,
  IfStatement,
} from "../ast/nodes.js";
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
      case "VariableDeclaration":
      case "ConstantDeclaration":
        this.checkDeclaration(node);
        break;

      case "PrintStatement":
        this.checkExpression(node.argument);
        break;
      case "Assignment":
        this.checkAssignment(node);
        break;

      case "IfStatement":
        this.checkIfStatement(node);
        break;

      default:
        throw new Error(`Unknown statement type: ${(node as any).type}`);
    }
  }

  private checkAssignment(node: Assignment): void {   // NEW
    const symbol = this.symbolTable.lookup(node.name);

    if (!symbol) {
      this.errors.push(`Cannot assign to undeclared variable: '${node.name}'`);
      return;
    }

    if (symbol.constant) {
      this.errors.push(`Cannot reassign '${node.name}' — it was declared with 'rave' (constant)`);
      return;
    }

    const valueType = this.inferType(node.value);
    if (valueType !== symbol.type) {
      this.errors.push(
        `Type mismatch: '${node.name}' is '${symbol.type}' but assigned a value of type '${valueType}'`
      );
    }
  }

  private checkDeclaration(
    node: VariableDeclaration | ConstantDeclaration,
  ): void {
    const actualType = this.inferType(node.value);

    if (node.typeAnnotation && node.typeAnnotation !== actualType) {
      this.errors.push(
        `Type mismatch: '${node.name}' declared as '${node.typeAnnotation}' but assigned a value of type '${actualType}'`,
      );
    }

    const success = this.symbolTable.declare(node.name, {
      type: node.typeAnnotation ?? actualType,
      constant: node.type === "ConstantDeclaration",
    });

    if (!success) {
      this.errors.push(`'${node.name}' has already been declared.`);
    }
  }

  private checkExpression(node: Expression): TypeAnnotation {
    return this.inferType(node);
  }

 private checkIfStatement(node: IfStatement): void {
    const conditionType = this.inferType(node.condition);
    if (conditionType !== "boolean") {
        this.errors.push(`'if' condition must be a boolean, got '${conditionType}'`);
    }
    for (const stmt of node.consequent) {
        this.checkStatement(stmt);
    }
    if (node.alternate) {
        for (const stmt of node.alternate) {
            this.checkStatement(stmt);
        }
    }
}
  private inferType(node: Expression): TypeAnnotation {
    switch (node.type) {
      case "StringLiteral":
        return "string";

      case "NumberLiteral":
        return "number";

      case "BooleanLiteral":
        return "boolean";

      case "Identifier": {
        const symbol = this.symbolTable.lookup(node.name);

        if (!symbol) {
          this.errors.push(`Undeclared variable: '${node.name}'`);
          return "string";
        }

        return symbol.type;
      }

      case "BinaryExpression": {
        const leftType = this.inferType(node.left);
        const rightType = this.inferType(node.right);

        if (node.operator === "==" || node.operator === "<" || node.operator === ">") {
          if (leftType !== rightType) {
            this.errors.push(
              `Cannot compare '${leftType}' with '${rightType}'`
            );
          }
          return "boolean";
        }

        if (leftType !== "number" || rightType !== "number") {
          this.errors.push(
            `Operator '${node.operator}' requires two numbers, got '${leftType}' and '${rightType}'`
          );
        }
        return "number";
      }

      default:
        throw new Error(`Cannot infer type for: ${(node as any).type}`);
    }
  }
}