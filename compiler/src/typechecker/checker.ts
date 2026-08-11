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
  ModelDeclaration,
  ImportDeclaration,
} from "../ast/nodes.js";
import { SymbolTable } from "./symbolTable.js";
import { Binder, SymbolBinding } from "./binder.js";
import { DiagnosticBag, Diagnostic } from "../diagnostics/index.js";
import { WorkspaceRegistry } from "./registry.js";
import {
  sameType as sharedSameType,
  isAssignableTo as sharedIsAssignableTo,
  makeUnion,
  formatType as sharedFormatType,
  closestMatch,
} from "./types.js";

export type FunctionSignature = { params: TypeAnnotation[]; returnType: TypeAnnotation };

export interface TypeCheckerOptions {
 
  registry?: WorkspaceRegistry;
 
  file?: string;

  importedFunctions?: Map<string, FunctionSignature>;
}

export class TypeChecker {
  private symbolTable = new SymbolTable();
  private diagnostics = new DiagnosticBag();
  private binder = new Binder();
  private registry?: WorkspaceRegistry;
  private file: string;
  private importedFunctions: Map<string, FunctionSignature>;
  private functionSignatures = new Map<string, { params: TypeAnnotation[]; returnType: TypeAnnotation; binding?: SymbolBinding }>([
    ["len", { params: [{ kind: "array", elementType: "any" }], returnType: "number" }],
    ["abs", { params: ["number"], returnType: "number" }],
    ["sqrt", { params: ["number"], returnType: "number" }],
    ["toString", { params: ["any"], returnType: "string" }],
  ]);
  private currentReturnType: TypeAnnotation | undefined;
  private inferredReturnTypes: TypeAnnotation[] | undefined;
  private externalModelBindings = new Map<string, SymbolBinding>();

  constructor(options: TypeCheckerOptions = {}) {
    this.registry = options.registry;
    this.file = options.file ?? "<anonymous>";
    this.importedFunctions = options.importedFunctions ?? new Map();
  }

 check(program: Program): Diagnostic[] {
    this.diagnostics = new DiagnosticBag();
    this.binder = new Binder();
    this.externalModelBindings = new Map();
    for (const stmt of program.body) {
      this.checkStatement(stmt);
    }
    return this.diagnostics.all();
  }

  /** Every top-level function this file makes available to `import`. */
  getExportedFunctions(): Map<string, FunctionSignature> {
    const result = new Map<string, FunctionSignature>();
    for (const [name, sig] of this.functionSignatures) {
      // Built-ins (len, abs, sqrt, toString) carry no binding — skip them,
      // they're not something a file "exports".
      if (sig.binding) result.set(name, { params: sig.params, returnType: sig.returnType });
    }
    return result;
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
      case "ModelDeclaration":
        this.checkModelDeclaration(node);
        break;
      case "ImportDeclaration":
        this.checkImportDeclaration(node);
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
        } else if (this.currentReturnType && !this.isAssignableTo(returnType, this.currentReturnType)) {
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

    if (node.typeAnnotation && !this.isAssignableTo(actualType, node.typeAnnotation)) {
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

  private checkModelDeclaration(node: ModelDeclaration): void {
    let type: TypeAnnotation;

    if (node.external) {
      // `database.users` / `api("/users")` — the data doesn't live in this
      // project, so we can't infer a shape from it. Trust the annotation if
      // one was given, otherwise it's opaque (`any`) until schema binding exists.
      type = node.typeAnnotation ?? "any";
    } else {
      const actualType = this.inferType(node.value);
      if (node.typeAnnotation && !this.isAssignableTo(actualType, node.typeAnnotation)) {
        this.diagnostics.error(
          `Type mismatch in model '${node.name}': expected '${this.formatType(node.typeAnnotation)}', but got '${this.formatType(actualType)}'`,
          node.location
        );
      }
      type = node.typeAnnotation ?? actualType;
    }

    const binding = this.binder.declare(node.name, "model", type, node.location);

    // Visible immediately in the file that publishes it, same as a const.
    const success = this.symbolTable.declare(node.name, { type, constant: true, binding });
    if (!success) {
      this.diagnostics.error(`'${node.name}' has already been declared.`, node.location);
    }

    if (this.registry) {
      const result = this.registry.publish(node.name, type, node.external, this.file, node.location);
      if (!result.ok) {
        this.diagnostics.error(
          result.message,
          node.location,
          `'${node.name}' was first published in ${result.existing.file}. Give this one a different name, or make both shapes match.`
        );
      }
    }
  }

  private checkImportDeclaration(node: ImportDeclaration): void {
    for (const name of node.names) {
      const imported = this.importedFunctions.get(name);

      if (imported) {
        const binding = this.binder.declare(name, "function", imported.returnType, node.location);
        this.functionSignatures.set(name, { ...imported, binding });
        continue;
      }

      if (this.registry?.lookup(name)) {
        this.diagnostics.error(
          `'${name}' is a published model, not code — models don't need an import, just use the name directly.`,
          node.location
        );
        continue;
      }

      this.diagnostics.error(
        `Cannot resolve import '${name}' from '${node.source}'. Make sure it's declared as a top-level function there.`,
        node.location
      );
    }
  }

  private checkAssignment(node: Assignment): void {
    const symbol = this.symbolTable.lookup(node.name);

    if (!symbol) {
      if (this.registry?.lookup(node.name)) {
        this.diagnostics.error(
          `Cannot reassign '${node.name}': it's a published model, which is read-only outside the file that declares it.`,
          node.location
        );
        return;
      }
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
    if (!this.isAssignableTo(valueType, symbol.type)) {
      this.diagnostics.error(
        `Type mismatch in assignment to '${node.name}': expected '${this.formatType(symbol.type)}', got '${this.formatType(valueType)}'`,
        node.location
      );
    }
  }

  private checkIfStatement(node: IfStatement): void {
    const conditionType = this.inferType(node.condition);
    if (!this.isAssignableTo(conditionType, "boolean")) {
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
    if (!this.isAssignableTo(conditionType, "boolean")) {
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

      case "NoneLiteral":
        return "none";

      case "Identifier": {
        const symbol = this.symbolTable.lookup(node.name);
        if (symbol) {
          this.binder.reference(symbol.binding, node.location);
          return symbol.type;
        }
  
        const published = this.registry?.lookup(node.name);
        if (published) {
          let binding = this.externalModelBindings.get(node.name);
          if (!binding) {
            binding = this.binder.declare(node.name, "model", published.type, published.location);
            this.externalModelBindings.set(node.name, binding);
          }
          this.binder.reference(binding, node.location);
          return published.type;
        }
        
        const suggestion = closestMatch(node.name, [
          ...this.symbolTable.allNames(),
          ...(this.registry?.names() ?? []),
        ]);
        this.diagnostics.error(
          `Undeclared variable '${node.name}'`,
          node.location,
          suggestion ? `Did you mean '${suggestion}'?` : undefined
        );
        return "any";
      }

      case "UnaryExpression": {
        const argType = this.inferType(node.argument);
        if (!this.isAssignableTo(argType, "boolean")) {
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
          const suggestion = closestMatch(node.callee, [...this.functionSignatures.keys()]);
          this.diagnostics.error(
            `Undeclared function '${node.callee}'`,
            node.location,
            suggestion ? `Did you mean '${suggestion}'?` : undefined
          );
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
          if (expectedType && expectedType !== "any" && !this.isAssignableTo(argType, expectedType)) {
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
        // Elements no longer have to be one exact type: `[1, "a"]` infers
        // as `array<number | string>` instead of erroring. This is a
        // Layer 2 case of §6's question 2 — the mixed-type array was
        // already something a developer could mean, and union types now
        // let the compiler describe it instead of rejecting it.
        const elementType = makeUnion(node.elements.map(el => this.inferType(el)));
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
          // "Comparable" means overlap, not identity: a `string | number`
          // can meaningfully be compared against a bare `string`, even
          // though the two aren't the same type.
          const comparable = this.isAssignableTo(leftType, rightType) || this.isAssignableTo(rightType, leftType);
          if (!comparable) {
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
              // Concatenating arrays of different element types no longer
              // errors — the result is `array<union of both>`, the same
              // move as mixed-type array literals above.
              return { kind: "array", elementType: makeUnion([leftType.elementType, rightType.elementType]) };
            }

            // Appending a value widens the element type if it wasn't
            // already covered, rather than requiring an exact match.
            return { kind: "array", elementType: makeUnion([leftType.elementType, rightType]) };
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
    return sharedSameType(left, right);
  }

  /** "Is a value of type `from` acceptable where `to` is expected" — union-aware. */
  private isAssignableTo(from: TypeAnnotation, to: TypeAnnotation): boolean {
    return sharedIsAssignableTo(from, to);
  }

  private formatType(type: TypeAnnotation | undefined): string {
    return sharedFormatType(type);
  }
}