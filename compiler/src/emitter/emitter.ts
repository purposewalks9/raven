import {
  Program,
  Statement,
  PrintStatement,
  VariableDeclaration,
  ConstantDeclaration,
  Expression,
  StringLiteral,
  Identifier,
  NumberLiteral,
  BooleanLiteral,
  NoneLiteral,
  BinaryExpression,
  Assignment,
  TupleLiteral,
  FunctionDeclaration,
  ReturnStatement,
  IfStatement,
  UnaryExpression,
  WhileStatement,
  ArrayLiteral,
  IndexExpression,
  CallExpression,
  ObjectLiteral,
  MemberExpression,
  ModelDeclaration,
  ImportDeclaration,
  Node,
} from "../ast/nodes.js";
import { SourceMapGenerator } from "../sourcemap/generator.js";

export interface EmitWithSourceMapOptions {
 
  sourceFile: string;
  
  generatedFile?: string;
 
  sourceContent?: string;
}

export interface EmitWithSourceMapResult {
  code: string;
  map: SourceMapGenerator;
}

export class Emitter {
  private indentLevel = 0;
  private output: string[] = [];
  private atLineStart = true;
  private sourceMap: SourceMapGenerator | null = null;
  private sourceMapFile = "<unknown>";
  private genLine = 0; // 0-based, tracks the generated output position
  private genColumn = 0;

  emit(program: Program): string {
    this.output = [];
    this.indentLevel = 0;
    this.atLineStart = true;
    this.sourceMap = null;
    this.emitProgram(program);
    return this.output.join("");
  }

  emitWithSourceMap(program: Program, options: EmitWithSourceMapOptions): EmitWithSourceMapResult {
    this.output = [];
    this.indentLevel = 0;
    this.atLineStart = true;
    this.genLine = 0;
    this.genColumn = 0;
    this.sourceMapFile = options.sourceFile;
    this.sourceMap = new SourceMapGenerator();
    if (options.sourceContent !== undefined) {
      this.sourceMap.setSourceContent(options.sourceFile, options.sourceContent);
    }

    this.emitProgram(program);

    const map = this.sourceMap;
    this.sourceMap = null;
    return { code: this.output.join(""), map };
  }

  
  private mark(node: Node): void {
    if (!this.sourceMap) return;
    this.sourceMap.addMapping({
      generatedLine: this.genLine,
      generatedColumn: this.genColumn,
      source: this.sourceMapFile,
      sourceLine: (node.location?.line ?? 1) - 1,
      sourceColumn: (node.location?.column ?? 1) - 1,
    });
  }

  private emitProgram(node: Program): void {
    this.emitStatementList(node.body);
  }

  private emitStatementList(statements: Statement[]): void {
    for (const stmt of statements) {
      this.indent();
      this.mark(stmt);
      this.emitStatement(stmt);
    }
  }

  private emitStatement(node: Statement): void {
    switch (node.type) {
      case "PrintStatement":
        this.emitPrintStatement(node);
        break;

      case "VariableDeclaration":
      case "ConstantDeclaration":
        this.emitVariableDeclaration(node);
        break;
      case "ModelDeclaration":
        this.emitModelDeclaration(node);
        break;
      case "ImportDeclaration":
        this.emitImportDeclaration(node);
        break;
      case "Assignment":
        this.emitAssignment(node);
        break;
      case "IfStatement":
        this.emitIfStatement(node);
        break;
      case "WhileStatement":
        this.emitWhileStatement(node);
        break;
      case "FunctionDeclaration":
        this.emitFunctionDeclaration(node);
        break;
      case "ReturnStatement":
        this.emitReturnStatement(node);
        break;
      case "ExpressionStatement":
        this.emitExpression(node.expression);
        this.write(";");
        this.newline();
        break;
      case "BreakStatement":
        this.write("break;");
        this.newline();
        break;
      case "ContinueStatement":
        this.write("continue;");
        this.newline();
        break;
      default:
        throw new Error(`Unknown statement type: ${(node as any).type}`);
    }
  }

  private emitPrintStatement(node: PrintStatement): void {
    this.write("console.log(");
    this.emitExpression(node.argument);
    this.write(");");
    this.newline();
  }

  private emitFunctionDeclaration(node: FunctionDeclaration): void {
    const params = node.parameters.map(p => p.name).join(", ");
    this.write(`function ${node.name}(${params}) {`);
    this.newline();
    this.indentLevel++;
    this.emitStatementList(node.body);
    this.indentLevel--;
    this.indent();
    this.write("}");
    this.newline();
  }

  private emitReturnStatement(node: ReturnStatement): void {
    this.write("return ");
    this.emitExpression(node.value);
    this.write(";");
    this.newline();
  }

  private emitVariableDeclaration(
    node: VariableDeclaration | ConstantDeclaration,
  ): void {
    const keyword = node.type === "ConstantDeclaration" ? "const" : "let";

    this.write(`${keyword} ${node.name} = `);
    this.emitExpression(node.value);
    this.write(";");
    this.newline();
  }

  private emitModelDeclaration(node: ModelDeclaration): void {
    this.write(`const ${node.name} = `);
    this.emitExpression(node.value);
    this.write(";");
    this.newline();
  }

  private emitImportDeclaration(node: ImportDeclaration): void {
    const names = node.names.join(", ");
    const path = node.source.startsWith(".") && !node.source.endsWith(".js")
      ? `${node.source}.js`
      : node.source;
    this.write(`import { ${names} } from "${path}";`);
    this.newline();
  }

  private emitWhileStatement(node: WhileStatement): void {
    this.write("while (");
    this.emitExpression(node.condition);
    this.write(") {");
    this.newline();
    this.indentLevel++;
    this.emitStatementList(node.body);
    this.indentLevel--;
    this.indent();
    this.write("}");
    this.newline();
  }

  private emitExpression(node: Expression): void {
    this.mark(node);
    switch (node.type) {
      case "StringLiteral":
        this.emitStringLiteral(node);
        break;
      case "Identifier":
        this.emitIdentifier(node);
        break;
      case "NumberLiteral":
        this.emitNumberLiteral(node);
        break;
      case "BooleanLiteral":
        this.emitBooleanLiteral(node);
        break;
      case "NoneLiteral":
        this.write("null");
        break;
      case "BinaryExpression":
        this.emitBinaryExpression(node);
        break;
      case "CallExpression":
        this.emitCallExpression(node);
        break;
      case "ObjectLiteral":
        this.emitObjectLiteral(node);
        break;
      case "UnaryExpression":
        this.emitUnaryExpression(node);
        break;
      case "ArrayLiteral":
        this.emitArrayLiteral(node);
        break;
     case "TupleLiteral":
    this.emitArrayLiteral(node as any);
    break;
      case "IndexExpression":
        this.emitIndexExpression(node);
        break;
      case "MemberExpression":
        this.emitMemberExpression(node);
        break;
      default:
        throw new Error(`Unknown expression type: ${(node as any).type}`);
    }
  }



  private emitStringLiteral(node: StringLiteral): void {
    const escaped = node.value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    this.write(`"${escaped}"`);
  }


  private emitObjectLiteral(node: ObjectLiteral): void {
    this.write("{ ");
    node.properties.forEach((property, i) => {
      if (i > 0) this.write(", ");
      this.write(`${property.key}: `);
      this.emitExpression(property.value);
    });
    this.write(" }");
  }

  private emitMemberExpression(node: MemberExpression): void {
    this.emitExpression(node.object);
    this.write(`.${node.property}`);
  }
  private emitIfStatement(node: IfStatement): void {
    this.write("if (");
    this.emitExpression(node.condition);
    this.write(") {");
    this.newline();
    this.indentLevel++;
    this.emitStatementList(node.consequent);
    this.indentLevel--;
    this.indent();
    this.write("}");
    if (node.alternate) {
      this.write(" else {");
      this.newline();
      this.indentLevel++;
      this.emitStatementList(node.alternate);
      this.indentLevel--;
      this.indent();
      this.write("}");
    }
    this.newline();
  }

  private emitIdentifier(node: Identifier): void {
    this.write(node.name);
  }

  private emitAssignment(node: Assignment): void {
    this.write(`${node.name} = `);
    this.emitExpression(node.value);
    this.write(";");
    this.newline();
  }


  private static readonly BUILTIN_CALL_MAP: Record<string, string> = {
    abs: "Math.abs",
    sqrt: "Math.sqrt",
    toString: "String",
  };

  private emitCallExpression(node: CallExpression): void {
    if (node.callee === "len" && node.arguments.length === 1) {
      this.write("(");
      this.emitExpression(node.arguments[0]!);
      this.write(").length");
      return;
    }

    const jsName = Emitter.BUILTIN_CALL_MAP[node.callee] ?? node.callee;
    this.write(`${jsName}(`);
    node.arguments.forEach((arg, i) => {
      if (i > 0) this.write(", ");
      this.emitExpression(arg);
    });
    this.write(")");
  }
  private emitUnaryExpression(node: UnaryExpression): void {
    this.write("(!");
    this.emitExpression(node.argument);
    this.write(")");
  }

  private emitNumberLiteral(node: NumberLiteral): void {
    this.write(String(node.value));
  }

  private emitBinaryExpression(node: BinaryExpression): void {
    const jsOperator = node.operator === "and" ? "&&" : node.operator === "or" ? "||" : node.operator;
    this.write("(");
    this.emitExpression(node.left);
    this.write(` ${jsOperator} `);
    this.emitExpression(node.right);
    this.write(")");
  }

  private emitBooleanLiteral(node: BooleanLiteral): void {
    this.write(String(node.value));
  }

  private emitArrayLiteral(node: ArrayLiteral): void {
    this.write("[");
    node.elements.forEach((el, i) => {
      if (i > 0) this.write(", ");
      this.emitExpression(el);
    });
    this.write("]");
  }

  private emitIndexExpression(node: IndexExpression): void {
    this.emitExpression(node.array);
    this.write("[");
    this.emitExpression(node.index);
    this.write("]");
  }

  private write(text: string): void {
    this.push(text);
    this.atLineStart = text.endsWith("\n");
  }

  private newline(): void {
    this.push("\n");
    this.atLineStart = true;
  }

  private indent(): void {
    if (this.atLineStart) {
      this.push("  ".repeat(this.indentLevel));
      this.atLineStart = false;
    }
  }

  private push(text: string): void {
    this.output.push(text);
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") {
        this.genLine++;
        this.genColumn = 0;
      } else {
        this.genColumn++;
      }
    }
  }
}