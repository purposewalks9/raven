// emitter/emitter.ts
import {
  Program,
  Statement,
  PrintStatement,
  VariableDeclaration,
  ConstantDeclaration,
  Expression,
  StringLiteral,
  Identifier,
} from "../ast/nodes.js";

export class Emitter {
  private indentLevel = 0;
  private output: string[] = [];

  emit(program: Program): string {
    this.output = [];
    this.emitProgram(program);
    return this.output.join("\n");
  }

  private emitProgram(node: Program): void {
    for (const stmt of node.body) {
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

  private emitVariableDeclaration(
    node: VariableDeclaration | ConstantDeclaration,
  ): void {
    const keyword = node.type === "ConstantDeclaration" ? "const" : "let";

    this.write(`${keyword} ${node.name} = `);
    this.emitExpression(node.value);
    this.write(";");
    this.newline();
  }

  private emitExpression(node: Expression): void {
    switch (node.type) {
      case "StringLiteral":
        this.emitStringLiteral(node);
        break;
      case "Identifier":
        this.emitIdentifier(node);
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

  private emitIdentifier(node: Identifier): void {
    this.write(node.name);
  }

  // --- Output helpers ---

  private write(text: string): void {
    this.output.push(text);
  }

  private newline(): void {
    this.output.push("\n");
  }

  private indent(): void {
    this.output.push("  ".repeat(this.indentLevel));
  }
}
