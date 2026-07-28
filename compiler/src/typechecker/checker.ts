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
  MemberExpression,
} from "../ast/nodes.js";
import { SymbolTable } from "./symbolTable.js";
import { Binder, SymbolBinding } from "./binder.js";
import { DiagnosticBag, Diagnostic } from "../diagnostics/index.js";

export class TypeChecker {
  private symbolTable = new SymbolTable();
  private diagnostics = new DiagnosticBag();
  private binder = new Binder();
  private functionSignatures = new Map<string, { params: TypeAnnotation[]; returnType: TypeAnnotation; binding?: SymbolBinding }>([
    ["len", { params: [{ kind: "array", elementType: "any" }], returnType: "number" }],
    ["abs", { params: ["number"], returnType: "number" }],
    ["sqrt", { params: ["number"], returnType: "number" }],
    ["toString", { params: ["any"], returnType: "string" }],
  ]);
  private currentReturnType: TypeAnnotation | undefined;
  private inferredReturnTypes: TypeAnnotation[] | undefined;

  check(program: Program): Diagnostic[] {
    this.diagnostics = new DiagnosticBag();
    this.binder = new Binder();
    for (const stmt of program.body) {
      this.checkStatement(stmt);
    }
    return this.diagnostics.all();
  }

  getBinder(): Binder {
    return this.binder;
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
        if (this.inferredReturnTypes) {
          this.inferredReturnTypes.push(returnType);
        } else if (this.currentReturnType && !this.sameType(returnType, this.currentReturnType)) {
          this.diagnostics.error(
            `Return type mismatch: expected '${this.formatType(this.currentReturnType)}', got '${this.formatType(returnType)}'`,
            node.location
          );
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
      this.diagnostics.error(
        `Type mismatch in declaration of '${node.name}': expected '${this.formatType(node.typeAnnotation)}', but got '${this.formatType(actualType)}'`,
        node.location,
        `Either change the annotation to '${this.formatType(actualType)}' or change the value to match '${this.formatType(node.typeAnnotation)}'.`
      );
    }

    const type = node.typeAnnotation ?? actualType;
    const constant = node.type === "ConstantDeclaration";
    const binding = this.binder.declare(node.name, constant ? "constant" : "variable", type, node.location);
    const success = this.symbolTable.declare(node.name, { type, constant, binding });

    if (!success) {
      this.diagnostics.error(`'${node.name}' has already been declared.`, node.location);
    }
  }

  private checkAssignment(node: Assignment): void {
    const symbol = this.symbolTable.lookup(node.name);

    if (!symbol) {
      this.diagnostics.error(`Cannot assign to undeclared variable '${node.name}'`, node.location);
      return;
    }
    this.binder.reference(symbol.binding, node.location);

    if (symbol.constant) {
      this.diagnostics.error(
        `Cannot reassign constant '${node.name}' (declared with 'const')`,
        node.location,
        `Use 'let' instead of 'const' if '${node.name}' needs to change later.`
      );
      return;
    }

    const valueType = this.inferType(node.value);
    if (!this.sameType(valueType, symbol.type)) {
      this.diagnostics.error(
        `Type mismatch in assignment to '${node.name}': expected '${this.formatType(symbol.type)}', got '${this.formatType(valueType)}'`,
        node.location
      );
    }
  }

  private checkIfStatement(node: IfStatement): void {
    const conditionType = this.inferType(node.condition);
    if (conditionType !== "boolean" && conditionType !== "any") {
      this.diagnostics.error(
        `If condition must be a boolean, got '${this.formatType(conditionType)}'`,
        node.condition.location
      );
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
    if (conditionType !== "boolean" && conditionType !== "any") {
      this.diagnostics.error(
        `While condition must be a boolean, got '${this.formatType(conditionType)}'`,
        node.condition.location
      );
    }

    this.symbolTable.enterScope();
    for (const stmt of node.body) {
      this.checkStatement(stmt);
    }
    this.symbolTable.exitScope();
  }

  private checkFunctionDeclaration(node: FunctionDeclaration): void {
    if (this.functionSignatures.has(node.name)) {
      this.diagnostics.error(`Function '${node.name}' has already been declared`, node.location);
    }

    const paramTypes: TypeAnnotation[] = node.parameters.map(p => p.typeAnnotation ?? "any");
    const isReturnTypeInferred = node.returnType === undefined;

    const functionBinding = this.binder.declare(node.name, "function", node.returnType ?? "any", node.location);
    const signature = {
      params: paramTypes,
      returnType: node.returnType ?? "any",
      binding: functionBinding,
    };
    this.functionSignatures.set(node.name, signature);

    this.symbolTable.enterScope();
    const seenParameters = new Set<string>();
    const previousReturnType = this.currentReturnType;
    const previousInferredReturns = this.inferredReturnTypes;
    this.currentReturnType = isReturnTypeInferred ? undefined : node.returnType;
    this.inferredReturnTypes = isReturnTypeInferred ? [] : undefined;

    for (const param of node.parameters) {
      if (seenParameters.has(param.name)) {
        this.diagnostics.error(
          `Duplicate parameter name '${param.name}' in function '${node.name}'`,
          node.location
        );
      }
      seenParameters.add(param.name);

      const paramType = param.typeAnnotation ?? "any";
      const paramBinding = this.binder.declare(param.name, "parameter", paramType, param.location ?? node.location);
      this.symbolTable.declare(param.name, { type: paramType, constant: false, binding: paramBinding });
    }

    for (const stmt of node.body) {
      this.checkStatement(stmt);
    }

    if (isReturnTypeInferred) {
      let inferred: TypeAnnotation = "any";
      for (const returnType of this.inferredReturnTypes ?? []) {
        if (inferred === "any") {
          inferred = returnType;
        } else if (!this.sameType(inferred, returnType)) {
          this.diagnostics.error(
            `Function '${node.name}' returns different types in different places: '${this.formatType(inferred)}' and '${this.formatType(returnType)}'`,
            node.location,
            `Add an explicit return type annotation (e.g. ': ${this.formatType(inferred)}') to resolve the ambiguity.`
          );
        }
      }
      signature.returnType = inferred;
      functionBinding.type = inferred;
    }

    this.symbolTable.exitScope();
    this.currentReturnType = previousReturnType;
    this.inferredReturnTypes = previousInferredReturns;
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
          this.diagnostics.error(`Undeclared variable '${node.name}'`, node.location);
          return "any";
        }
        this.binder.reference(symbol.binding, node.location);
        return symbol.type;
      }

      case "UnaryExpression": {
        const argType = this.inferType(node.argument);
        if (argType !== "boolean" && argType !== "any") {
          this.diagnostics.error(
            `Operator 'not' requires a boolean operand, got '${this.formatType(argType)}'`,
            node.location
          );
        }
        return "boolean";
      }

      case "CallExpression": {
        const signature = this.functionSignatures.get(node.callee);
        if (!signature) {
          this.diagnostics.error(`Undeclared function '${node.callee}'`, node.location);
          return "any";
        }
        this.binder.reference(signature.binding, node.location);
        if (node.arguments.length !== signature.params.length) {
          this.diagnostics.error(
            `Function '${node.callee}' expects ${signature.params.length} argument(s), but got ${node.arguments.length}`,
            node.location
          );
        }
        node.arguments.forEach((arg, i) => {
          const argType = this.inferType(arg);
          const expectedType = signature.params[i];
          if (expectedType && expectedType !== "any" && !this.sameType(argType, expectedType)) {
            this.diagnostics.error(
              `Argument ${i + 1} of '${node.callee}': expected '${this.formatType(expectedType)}', got '${this.formatType(argType)}'`,
              arg.location
            );
          }
        });
        return signature.returnType;
      }

      case "ArrayLiteral": {
        if (node.elements.length === 0) {
          return { kind: "array", elementType: "any" };
        }
        const elementType = this.inferType(node.elements[0]!);
        for (const el of node.elements) {
          const elType = this.inferType(el);
          if (!this.sameType(elType, elementType) && elementType !== "any" && elType !== "any") {
            this.diagnostics.error(
              `Array elements must all have the same type. Found '${this.formatType(elementType)}' and '${this.formatType(elType)}'`,
              el.location
            );
          }
        }
        return { kind: "array", elementType };
      }

      case "ObjectLiteral": {
        const fields: Record<string, TypeAnnotation> = {};
        for (const property of node.properties) {
          fields[property.key] = this.inferType(property.value);
        }
        return { kind: "record", fields };
      }

      case "MemberExpression": {
        const objectType = this.inferType(node.object);

        if (objectType === "any") {
          return "any";
        }

        if (typeof objectType === "object" && objectType.kind === "record") {
          const fieldType = objectType.fields[node.property];
          if (fieldType === undefined) {
            this.diagnostics.error(
              `Property '${node.property}' does not exist on type '${this.formatType(objectType)}'`,
              node.location
            );
            return "any";
          }
          return fieldType;
        }

        this.diagnostics.error(
          `Cannot access property '${node.property}' on non-record type '${this.formatType(objectType)}'`,
          node.location
        );
        return "any";
      }

      case "IndexExpression": {
        const arrayType = this.inferType(node.array);
        const indexType = this.inferType(node.index);

        if (indexType !== "number" && indexType !== "any") {
          this.diagnostics.error(
            `Array index must be a number, got '${this.formatType(indexType)}'`,
            node.index.location
          );
        }

        if (typeof arrayType === "object" && arrayType.kind === "array") {
          return arrayType.elementType;
        }
        if (arrayType === "any") {
          return "any";
        }
        this.diagnostics.error(
          `Cannot index a non-array value of type '${this.formatType(arrayType)}'`,
          node.array.location
        );
        return "any";
      }

      case "BinaryExpression": {
        const leftType = this.inferType(node.left);
        const rightType = this.inferType(node.right);

        if (leftType === "any") return rightType;
        if (rightType === "any") return leftType;

        if (node.operator === "and" || node.operator === "or") {
          if (leftType !== "boolean" || rightType !== "boolean") {
            this.diagnostics.error(
              `Operator '${node.operator}' requires two booleans. Got '${this.formatType(leftType)}' and '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "boolean";
        }

        if (["==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
          if (!this.sameType(leftType, rightType)) {
            this.diagnostics.error(
              `Cannot compare '${this.formatType(leftType)}' with '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "boolean";
        }

        if (node.operator === "+") {
          if (typeof leftType === "object" && leftType.kind === "array") {
            if (typeof rightType === "object" && rightType.kind === "array") {
              if (!this.sameType(leftType.elementType, rightType.elementType)) {
                this.diagnostics.error(
                  `Cannot concatenate arrays of different types: '${this.formatType(leftType.elementType)}[]' + '${this.formatType(rightType.elementType)}[]'`,
                  node.location
                );
              }
              return leftType;
            }

            if (this.sameType(leftType.elementType, rightType)) {
              return leftType;
            }

            this.diagnostics.error(
              `Cannot append '${this.formatType(rightType)}' to array of '${this.formatType(leftType.elementType)}'`,
              node.location
            );
            return leftType;
          }

          if (leftType === "string" || rightType === "string") {
            return "string";
          }

          if (leftType !== "number" || rightType !== "number") {
            this.diagnostics.error(
              `Operator '+' requires numbers, strings, or arrays. Got '${this.formatType(leftType)}' and '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "number";
        }

        if (leftType !== "number" || rightType !== "number") {
          this.diagnostics.error(
            `Operator '${node.operator}' requires two numbers. Got '${this.formatType(leftType)}' and '${this.formatType(rightType)}'`,
            node.location
          );
        }
        return "number";
      }

      default:
        throw new Error(`Cannot infer type for node type: ${(node as any).type}`);
    }
  }

  private sameType(left: TypeAnnotation, right: TypeAnnotation): boolean {
    if (left === "any" || right === "any") return true;

    if (typeof left === "string" && typeof right === "string") {
      return left === right;
    }
    if (typeof left === "string" || typeof right === "string") {
      return false;
    }
    if (left.kind !== right.kind) {
      return false;
    }

    if (left.kind === "array" && right.kind === "array") {
      return this.sameType(left.elementType, right.elementType);
    }

    if (left.kind === "record" && right.kind === "record") {
      const leftKeys = Object.keys(left.fields);
      const rightKeys = Object.keys(right.fields);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every(key => {
        const rightFieldType = right.fields[key];
        return rightFieldType !== undefined && this.sameType(left.fields[key]!, rightFieldType);
      });
    }

    return false;
  }

  private formatType(type: TypeAnnotation | undefined): string {
    if (!type) return "unknown";
    if (type === "any") return "any";
    if (typeof type === "string") {
      return type;
    }
    if (type.kind === "array") {
      return `${this.formatType(type.elementType)}[]`;
    }
    if (type.kind === "record") {
      const fields = Object.entries(type.fields)
        .map(([key, fieldType]) => `${key}: ${this.formatType(fieldType)}`)
        .join(", ");
      return `{ ${fields} }`;
    }
    return "unknown";
  }
}