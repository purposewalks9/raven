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
import { DiagnosticBag, Diagnostic, CODES } from "../diagnostics/index.js";
import { WorkspaceRegistry } from "./registry.js";
import { sameType as sharedSameType, isAssignableTo as sharedIsAssignableTo, formatType as sharedFormatType, closestMatch, optionalType, unionType } from "./types.js";
import { isDirectSelfAlias } from "./recursive.js";
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

  getExportedFunctions(): Map<string, FunctionSignature> {
    const result = new Map<string, FunctionSignature>();
    for (const [name, sig] of this.functionSignatures) {
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

        const returnType = this.currentReturnType ? this.literalAwareType(node.value) : this.checkExpression(node.value);
        if (this.inferredReturnTypes) {
          this.inferredReturnTypes.push(returnType);
        } else if (this.currentReturnType && !this.isAssignableTo(returnType, this.currentReturnType)) {
          this.diagnostics.error(
            CODES.RETURN_TYPE_MISMATCH,
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

    const actualType = node.typeAnnotation ? this.literalAwareType(node.value) : this.inferType(node.value);

    if (node.typeAnnotation && !this.isAssignableTo(actualType, node.typeAnnotation)) {
      this.diagnostics.error(
        CODES.DECLARATION_TYPE_MISMATCH,
        `Type mismatch in declaration of '${node.name}': expected '${this.formatType(node.typeAnnotation)}', but got '${this.formatType(actualType)}'`,
        node.location,
        {
          hint: `Either change the annotation to '${this.formatType(actualType)}' or change the value to match '${this.formatType(node.typeAnnotation)}'.`,
          suggestions: [
            { message: `Change the annotation to '${this.formatType(actualType)}'` },
            { message: `Change the value to match '${this.formatType(node.typeAnnotation)}'` },
          ],
        }
      );
    }

    const type = node.typeAnnotation ?? actualType;
    const constant = node.type === "ConstantDeclaration";
    const binding = this.binder.declare(node.name, constant ? "constant" : "variable", type, node.location, node.typeAnnotation ? "local" : "inferred");
    const success = this.symbolTable.declare(node.name, { type, constant, binding, origin: binding.origin });

    if (!success) {
      this.diagnostics.error(CODES.DUPLICATE_DECLARATION, `'${node.name}' has already been declared.`, node.location);
    }
  }

private checkModelDeclaration(node: ModelDeclaration): void {
  let type: TypeAnnotation;

  if (node.external) {
    type = node.typeAnnotation ?? "any";
  } else {
    const actualType = node.typeAnnotation ? this.literalAwareType(node.value) : this.inferType(node.value);
    

  if (node.typeAnnotation && isDirectSelfAlias(node.typeAnnotation, node.name)) {
      this.diagnostics.error(
        CODES.RECURSIVE_MODEL_CYCLE,
        `Model '${node.name}' cannot reference itself directly. Use a union or optional type instead.`,
        node.location
      );
      type = "any";
    } else if (node.typeAnnotation && !this.isAssignableTo(actualType, node.typeAnnotation)) {
      this.diagnostics.error(
        CODES.MODEL_TYPE_MISMATCH,
        `Type mismatch in model '${node.name}': expected '${this.formatType(node.typeAnnotation)}', but got '${this.formatType(actualType)}'`,
        node.location
      );
      type = node.typeAnnotation ?? actualType;
    } else {
      type = node.typeAnnotation ?? actualType;
    }
  }

  const binding = this.binder.declare(node.name, "model", type, node.location, "model", node.external ? "external" : this.file);

  const success = this.symbolTable.declare(node.name, { type, constant: true, binding, origin: binding.origin, source: binding.source });
  if (!success) {
    this.diagnostics.error(CODES.DUPLICATE_DECLARATION, `'${node.name}' has already been declared.`, node.location);
  }

  if (this.registry) {
    const result = this.registry.publish(node.name, type, node.external, this.file, node.location);
    if (!result.ok) {
      this.diagnostics.error(
        CODES.MODEL_REGISTRY_CONFLICT,
        result.message,
        node.location,
        { hint: `'${node.name}' was first published in ${result.existing.file}. Give this one a different name, or make both shapes match.` }
      );
    }
  }
}

  private checkImportDeclaration(node: ImportDeclaration): void {
    for (const name of node.names) {
      const imported = this.importedFunctions.get(name);

      if (imported) {
        const functionType: TypeAnnotation = {
          kind: "function",
          params: imported.params,
          returnType: imported.returnType,
        };

        const binding = this.binder.declare(
          name,
          "function",
          functionType,
          node.location,
          "import",
          node.source
        );

        this.functionSignatures.set(name, { ...imported, binding });
        continue;
      }

      if (this.registry?.lookup(name)) {
        this.diagnostics.error(
          CODES.INVALID_IMPORT_TARGET,
          `'${name}' is a published model, not code — models don't need an import, just use the name directly.`,
          node.location,
          { suggestions: [{ message: `Remove the import and reference '${name}' directly.` }] }
        );
        continue;
      }

      this.diagnostics.error(
        CODES.UNRESOLVED_IMPORT,
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
          CODES.READONLY_MODEL_REASSIGNMENT,
          `Cannot reassign '${node.name}': it's a published model, which is read-only outside the file that declares it.`,
          node.location
        );
        return;
      }
      this.diagnostics.error(CODES.UNDECLARED_ASSIGNMENT_TARGET, `Cannot assign to undeclared variable '${node.name}'`, node.location);
      return;
    }
    this.binder.reference(symbol.binding, node.location);

    if (symbol.constant) {
      this.diagnostics.error(
        CODES.CONST_REASSIGNMENT,
        `Cannot reassign constant '${node.name}' (declared with 'const')`,
        node.location,
        {
          hint: `Use 'let' instead of 'const' if '${node.name}' needs to change later.`,
          suggestions: [{ message: `Change 'const ${node.name}' to 'let ${node.name}'`, replacement: "let" }],
        }
      );
      return;
    }


    const valueType = this.literalAwareType(node.value);
    if (!this.isAssignableTo(valueType, symbol.type)) {
      this.diagnostics.error(
        CODES.ASSIGNMENT_TYPE_MISMATCH,
        `Type mismatch in assignment to '${node.name}': expected '${this.formatType(symbol.type)}', got '${this.formatType(valueType)}'`,
        node.location
      );
    }
  }

  private checkIfStatement(node: IfStatement): void {
    const conditionType = this.inferType(node.condition);
    if (!this.isAssignableTo(conditionType, "boolean")) {
      this.diagnostics.error(
        CODES.NON_BOOLEAN_CONDITION,
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
        CODES.NON_BOOLEAN_CONDITION,
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
      this.diagnostics.error(CODES.DUPLICATE_FUNCTION, `Function '${node.name}' has already been declared`, node.location);
    }

    const paramTypes: TypeAnnotation[] = node.parameters.map(
      p => p.typeAnnotation ?? "any"
    );

    const isReturnTypeInferred = node.returnType === undefined;

    const functionType: TypeAnnotation = {
      kind: "function",
      params: paramTypes,
      returnType: node.returnType ?? "any",
    };

    const functionBinding = this.binder.declare(
      node.name,
      "function",
      functionType,
      node.location,
      "local",
      this.file
    );

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
          CODES.DUPLICATE_PARAMETER,
          `Duplicate parameter name '${param.name}' in function '${node.name}'`,
          node.location
        );
      }
      seenParameters.add(param.name);

      const paramType = param.typeAnnotation ?? "any";
      const paramBinding = this.binder.declare(param.name, "parameter", paramType, param.location ?? node.location, param.typeAnnotation ? "local" : "inferred");
      this.symbolTable.declare(param.name, { type: paramType, constant: false, binding: paramBinding, origin: paramBinding.origin });
    }

    for (const stmt of node.body) {
      this.checkStatement(stmt);
    }

    if (isReturnTypeInferred) {
      const returns = this.inferredReturnTypes ?? [];
      const inferred = returns.length === 0 ? "any" : this.bestCommonType(returns);

      signature.returnType = inferred;

      functionBinding.type = {
        kind: "function",
        params: signature.params,
        returnType: inferred,
      };
    }

    this.symbolTable.exitScope();
    this.currentReturnType = previousReturnType;
    this.inferredReturnTypes = previousInferredReturns;
  }

  private checkExpression(node: Expression): TypeAnnotation {
    return this.inferType(node);
  }


  private literalAwareType(node: Expression): TypeAnnotation {
    switch (node.type) {
      case "StringLiteral":
      case "NumberLiteral":
      case "BooleanLiteral":
        return { kind: "literal", value: node.value };
      default:
        return this.inferType(node);
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
            binding = this.binder.declare(node.name, "model", published.type, published.location, "model", published.file);
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
          CODES.UNDECLARED_VARIABLE,
          `Undeclared variable '${node.name}'`,
          node.location,
          suggestion
            ? {
              hint: `Did you mean '${suggestion}'?`,
              suggestions: [{ message: `Did you mean '${suggestion}'?`, replacement: suggestion, location: node.location }],
            }
            : undefined
        );
        return "any";
      }

      case "UnaryExpression": {
        const argType = this.inferType(node.argument);
        if (!this.isAssignableTo(argType, "boolean")) {
          this.diagnostics.error(
            CODES.INVALID_UNARY_OPERAND,
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
            CODES.UNDECLARED_FUNCTION,
            `Undeclared function '${node.callee}'`,
            node.location,
            suggestion
              ? {
                hint: `Did you mean '${suggestion}'?`,
                suggestions: [{ message: `Did you mean '${suggestion}'?`, replacement: suggestion, location: node.location }],
              }
              : undefined
          );
          return "any";
        }
        this.binder.reference(signature.binding, node.location);
        if (node.arguments.length !== signature.params.length) {
          this.diagnostics.error(
            CODES.ARGUMENT_COUNT_MISMATCH,
            `Function '${node.callee}' expects ${signature.params.length} argument(s), but got ${node.arguments.length}`,
            node.location
          );
        }
        node.arguments.forEach((arg, i) => {
          const expectedType = signature.params[i];
          const argType = expectedType ? this.literalAwareType(arg) : this.inferType(arg);
          if (expectedType && expectedType !== "any" && !this.isAssignableTo(argType, expectedType)) {
            this.diagnostics.error(
              CODES.ARGUMENT_TYPE_MISMATCH,
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
        const elementTypes = node.elements.map(element => this.inferType(element));
        return { kind: "array", elementType: this.bestCommonType(elementTypes) };
      }

      case "TupleLiteral": {
        const elementTypes = node.elements.map(element => this.inferType(element));
        return { kind: "tuple", elements: elementTypes };
      }

      case "ObjectLiteral": {
        const fields: Record<string, TypeAnnotation> = {};
        for (const property of node.properties) {
          fields[property.key] = this.inferType(property.value);
        }
        return { kind: "record", fields };
      }

      case "MemberExpression": {
        const objectType = this.resolveRef(this.inferType(node.object));

        if (objectType === "any") {
          return "any";
        }

        if (typeof objectType === "object" && objectType.kind === "record") {
          const fieldType = objectType.fields[node.property];
          if (fieldType === undefined) {
            this.diagnostics.error(
              CODES.UNKNOWN_PROPERTY,
              `Property '${node.property}' does not exist on type '${this.formatType(objectType)}'`,
              node.location
            );
            return "any";
          }
          return fieldType;
        }

        this.diagnostics.error(
          CODES.INVALID_PROPERTY_ACCESS,
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
            CODES.INVALID_INDEX_TYPE,
            `Array index must be a number, got '${this.formatType(indexType)}'`,
            node.index.location
          );
        }
        if (typeof arrayType === "object" && arrayType.kind === "tuple") {
          if (node.index.type === "NumberLiteral") {
            const i = node.index.value;

            if (i < 0 || i >= arrayType.elements.length) {
              this.diagnostics.error(
                CODES.TUPLE_INDEX_OUT_OF_BOUNDS,
                `Tuple index ${i} is out of bounds for '${this.formatType(arrayType)}' (length ${arrayType.elements.length})`,
                node.index.location
              );
              return "any";
            }

            return arrayType.elements[i] ?? "any";
          }
          return this.bestCommonType(arrayType.elements);
        }

        if (typeof arrayType === "object" && arrayType.kind === "array") {
          return arrayType.elementType;
        }
        if (arrayType === "any") {
          return "any";
        }
        this.diagnostics.error(
          CODES.INVALID_INDEX_TARGET,
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
              CODES.INVALID_LOGICAL_OPERANDS,
              `Operator '${node.operator}' requires two booleans. Got '${this.formatType(leftType)}' and '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "boolean";
        }

        if (["==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
          const comparable = this.isAssignableTo(leftType, rightType) || this.isAssignableTo(rightType, leftType);
          if (!comparable) {
            this.diagnostics.error(
              CODES.INCOMPARABLE_TYPES,
              `Cannot compare '${this.formatType(leftType)}' with '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "boolean";
        }

        if (node.operator === "+") {
          if (typeof leftType === "object" && leftType.kind === "array") {
            if (typeof rightType === "object" && rightType.kind === "array") {

              return { kind: "array", elementType: unionType([leftType.elementType, rightType.elementType]) };
            }

            return { kind: "array", elementType: unionType([leftType.elementType, rightType]) };
          }

          if (leftType === "string" || rightType === "string") {
            return "string";
          }

          if (leftType !== "number" || rightType !== "number") {
            this.diagnostics.error(
              CODES.INVALID_PLUS_OPERANDS,
              `Operator '+' requires numbers, strings, or arrays. Got '${this.formatType(leftType)}' and '${this.formatType(rightType)}'`,
              node.location
            );
          }
          return "number";
        }

        if (leftType !== "number" || rightType !== "number") {
          this.diagnostics.error(
            CODES.INVALID_ARITHMETIC_OPERANDS,
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

  private bestCommonType(types: TypeAnnotation[]): TypeAnnotation {
    if (types.length === 0) return "any";
    if (types.some(type => type === "any")) return "any";

    const [first, ...rest] = types;
    if (first && rest.every(type => this.sameType(type, first))) {
      return first;
    }

    if (types.every(type => typeof type === "object" && type.kind === "record")) {
      return this.mergeRecordTypes(types as Extract<TypeAnnotation, { kind: "record" }>[]);
    }

    return unionType(types);
  }

  private mergeRecordTypes(records: Extract<TypeAnnotation, { kind: "record" }>[]): TypeAnnotation {
    const allKeys = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record.fields)) allKeys.add(key);
    }

    const fields: Record<string, TypeAnnotation> = {};
    for (const key of allKeys) {
      const presentTypes = records
        .map(record => record.fields[key])
        .filter((type): type is TypeAnnotation => type !== undefined);
      const merged = this.bestCommonType(presentTypes);
      fields[key] = presentTypes.length === records.length ? merged : optionalType(merged);
    }

    return { kind: "record", fields };
  }
  

private resolveRef(type: TypeAnnotation): TypeAnnotation {
  if (typeof type === "object" && type.kind === "ref") {
    const published = this.registry?.lookup(type.name);
    return published ? published.type : "any";
  }
  return type;
}
private sameType(left: TypeAnnotation, right: TypeAnnotation): boolean {
  return sharedSameType(this.resolveRef(left), this.resolveRef(right));
}

private isAssignableTo(source: TypeAnnotation, target: TypeAnnotation): boolean {
  return sharedIsAssignableTo(this.resolveRef(source), this.resolveRef(target));
}

  private formatType(type: TypeAnnotation | undefined): string {
    return sharedFormatType(type);
  }
}