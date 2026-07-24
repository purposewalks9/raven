import {
  Program,
  Statement,
  Expression,
  TypeAnnotation,
  VariableDeclaration,
  ConstantDeclaration,
  Assignment,
  IfStatement,
  WhileStatement,
  ArrayLiteral,
  IndexExpression,
  FunctionDeclaration,
} from "../ast/nodes.js";
import { SymbolTable } from "./symbolTable.js";

export class TypeChecker {
  private symbolTable = new SymbolTable();
  private errors: string[] = [];
  private functionSignatures = new Map<string, { params: TypeAnnotation[]; returnType: TypeAnnotation }>([
    ["len", { params: [{ kind: "array", elementType: "number" }], returnType: "number" }],
    ["abs", { params: ["number"], returnType: "number" }],
    ["sqrt", { params: ["number"], returnType: "number" }],
    ["toString", { params: ["number"], returnType: "string" }],
  ]);
  private currentReturnType: TypeAnnotation | undefined;

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
      case "WhileStatement":
        this.checkWhileStatement(node);
        break;
      case "FunctionDeclaration":
        this.checkFunctionDeclaration(node);
        break;
      case "ReturnStatement": {
        const returnType = this.checkExpression(node.value);
        if (this.currentReturnType && !this.sameType(returnType, this.currentReturnType)) {
          this.errors.push(`Return type mismatch: expected '${this.formatType(this.currentReturnType)}', got '${this.formatType(returnType)}'`);
        }
        break;
      }
      case "ExpressionStatement":
        this.checkExpression(node.expression);
        break;
      case "BreakStatement":
      case "ContinueStatement":
        break;
      default:
        throw new Error(`Unknown statement type: ${(node as any).type}`);
    }
  }

  private checkDeclaration(node: VariableDeclaration | ConstantDeclaration): void {
    const actualType = this.inferType(node.value);

    if (node.typeAnnotation && !this.sameType(node.typeAnnotation, actualType)) {
      this.errors.push(
        `Type mismatch: '${node.name}' declared as '${this.formatType(node.typeAnnotation)}' but assigned a value of type '${this.formatType(actualType)}'`
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

  private checkAssignment(node: Assignment): void {
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
    if (!this.sameType(valueType, symbol.type)) {
      this.errors.push(
        `Type mismatch: '${node.name}' is '${this.formatType(symbol.type)}' but assigned a value of type '${this.formatType(valueType)}'`
      );
    }
  }

  private checkIfStatement(node: IfStatement): void {
    const conditionType = this.inferType(node.condition);
    if (conditionType !== "boolean") {
      this.errors.push(`'if' condition must be a boolean, got '${conditionType}'`);
    }

    this.symbolTable.enterScope();
    for (const stmt of node.consequent) {
      this.checkStatement(stmt);
    }
    this.symbolTable.exitScope();

    if (node.alternate) {
      this.symbolTable.enterScope();
      for (const stmt of node.alternate) {
        this.checkStatement(stmt);
      }
      this.symbolTable.exitScope();
    }
  }

  private checkWhileStatement(node: WhileStatement): void {
    const conditionType = this.inferType(node.condition);
    if (conditionType !== "boolean") {
      this.errors.push(`'while' condition must be a boolean, got '${conditionType}'`);
    }

    this.symbolTable.enterScope();
    for (const stmt of node.body) {
      this.checkStatement(stmt);
    }
    this.symbolTable.exitScope();
  }

  private checkFunctionDeclaration(node: FunctionDeclaration): void {
    if (this.functionSignatures.has(node.name)) {
      this.errors.push(`Function '${node.name}' has already been declared.`);
    }
    this.functionSignatures.set(node.name, {
      params: node.parameters.map(p => p.typeAnnotation),
      returnType: node.returnType,
    });

    this.symbolTable.enterScope();
    const seenParameters = new Set<string>();
    const previousReturnType = this.currentReturnType;
    this.currentReturnType = node.returnType;
    for (const param of node.parameters) {
      if (seenParameters.has(param.name)) {
        this.errors.push(`Duplicate parameter: '${param.name}'`);
      }
      seenParameters.add(param.name);
      this.symbolTable.declare(param.name, { type: param.typeAnnotation, constant: false });
    }
    for (const stmt of node.body) {
      this.checkStatement(stmt);
    }
    this.symbolTable.exitScope();
    this.currentReturnType = previousReturnType;
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

      case "UnaryExpression": {
        const argType = this.inferType(node.argument);
        if (argType !== "boolean") {
          this.errors.push(`Operator 'not' requires a boolean, got '${argType}'`);
        }
        return "boolean";
      }

      case "CallExpression": {
        const signature = this.functionSignatures.get(node.callee);
        if (!signature) {
          this.errors.push(`Undeclared function: '${node.callee}'`);
          return "string";
        }
        if (node.arguments.length !== signature.params.length) {
          this.errors.push(
            `'${node.callee}' expects ${signature.params.length} argument(s), got ${node.arguments.length}`
          );
        }
        node.arguments.forEach((arg, i) => {
          const argType = this.inferType(arg);
          const expectedType = signature.params[i];
          if (expectedType && !this.sameType(argType, expectedType)) {
            this.errors.push(
              `Argument ${i + 1} of '${node.callee}': expected '${this.formatType(expectedType)}', got '${this.formatType(argType)}'`
            );
          }
        });
        return signature.returnType;
      }
      case "ArrayLiteral": {          // NEW
        if (node.elements.length === 0) {
          return { kind: "array", elementType: "number" }; // default assumption
        }
        const elementType = this.inferType(node.elements[0]!);
        for (const el of node.elements) {
          if (!this.sameType(this.inferType(el), elementType)) {
            this.errors.push("Array elements must all be the same type");
          }
        }
        return { kind: "array", elementType };
      }
      case "IndexExpression": {       // NEW
        const arrayType = this.inferType(node.array);
        if (typeof arrayType === "object" && arrayType.kind === "array") {
          return arrayType.elementType;
        }
        this.errors.push("Cannot index a non-array value");
        return "number";
      }
      case "BinaryExpression": {
        const leftType = this.inferType(node.left);
        const rightType = this.inferType(node.right);

        if (node.operator === "and" || node.operator === "or") {
          if (leftType !== "boolean" || rightType !== "boolean") {
            this.errors.push(
              `Operator '${node.operator}' requires two booleans, got '${leftType}' and '${rightType}'`
            );
          }
          return "boolean";
        }

        if (["==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
          if (!this.sameType(leftType, rightType)) {
            this.errors.push(`Cannot compare '${this.formatType(leftType)}' with '${this.formatType(rightType)}'`);
          }
          return "boolean";
        }

        // +, -, *, /, %
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

  private sameType(left: TypeAnnotation, right: TypeAnnotation): boolean {
    if (typeof left === "string" || typeof right === "string") return left === right;
    return left.kind === right.kind && this.sameType(left.elementType, right.elementType);
  }

  private formatType(type: TypeAnnotation | undefined): string {
    if (!type) return "unknown";
    return typeof type === "string" ? type : `${this.formatType(type.elementType)}[]`;
  }
}