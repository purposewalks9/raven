// emitter/emitter.ts
import { Program, Statement, PrintStatement, Expression, StringLiteral } from "../ast/nodes.js";

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

    private emitExpression(node: Expression): void {
        switch (node.type) {
            case "StringLiteral":
                this.emitStringLiteral(node);
                break;
            default:
                throw new Error(`Unknown expression type: ${(node as any).type}`);
        }
    }

    private emitStringLiteral(node: StringLiteral): void {
        // Escape quotes and backslashes in the string value
        const escaped = node.value
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
        this.write(`"${escaped}"`);
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