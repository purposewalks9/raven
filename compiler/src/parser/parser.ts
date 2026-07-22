import { Token, TokenKind } from "../lexer/token.js";
import { Program, Statement, Expression } from "../ast/nodes.js";

export class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) { }

    parseProgram(): Program {
        const body: Statement[] = [];

        while (this.peek().kind !== TokenKind.EOF) {
            body.push(this.parseStatement());
        }

        return {
            type: "Program",
            body
        };
    }

    parseStatement(): Statement {
        if (this.checkKeyword("print")) {
            return this.parsePrint();
        }
        if (this.checkKeyword("val")) {
            return this.parseVal();
        }
        throw new Error("Expected a statement");
    }

    parsePrint(): Statement {
        this.expectKeyword("print");
        this.expect("(");
        const argument = this.parseExpression();
        this.expect(")");
        return {
            type: "PrintStatement",
            argument
        };
    }

   parseVal(): Statement {
    this.expectKeyword("val");

    const nameToken = this.peek();
    if (nameToken.kind !== TokenKind.Identifier) {
        throw new Error("Expected an identifier after 'val'");
    }
    this.advance();

    let typeAnnotation: "string" | "number" | "boolean" | undefined;
    if (this.peek().value === ":") {
        this.advance();
        const typeToken = this.peek();
        if (typeToken.kind !== TokenKind.Identifier) {
            throw new Error("Expected a type name after ':'");
        }
        typeAnnotation = typeToken.value as "string" | "number" | "boolean";
        this.advance();
    }

    this.expect("=");
    const value = this.parseExpression();

    return typeAnnotation === undefined
        ? { type: "VariableDeclaration", name: nameToken.value, value }
        : { type: "VariableDeclaration", name: nameToken.value, value, typeAnnotation };
}

    parseExpression(): Expression {
        return this.parseComparison();
    }

    parseComparison(): Expression {
        let left: Expression = this.parseAdditive();

        while (
            this.peek().value === "==" ||
            this.peek().value === "<" ||
            this.peek().value === ">"
        ) {
            const operator = this.advance().value as "==" | "<" | ">";
            const right = this.parseAdditive();
            left = { type: "BinaryExpression", operator, left, right };
        }

        return left;
    }

    parseAdditive(): Expression {
        let left: Expression = this.parseMultiplicative();

        while (this.peek().value === "+" || this.peek().value === "-") {
            const operator = this.advance().value as "+" | "-";
            const right = this.parseMultiplicative();
            left = { type: "BinaryExpression", operator, left, right };
        }

        return left;
    }

    parseMultiplicative(): Expression {
        let left: Expression = this.parsePrimary();

        while (this.peek().value === "*" || this.peek().value === "/") {
            const operator = this.advance().value as "*" | "/";
            const right = this.parsePrimary();
            left = { type: "BinaryExpression", operator, left, right };
        }

        return left;
    }

    parsePrimary(): Expression {
        const token = this.peek();
        if (token.kind === TokenKind.String) {
            this.advance();
            return { type: "StringLiteral", value: token.value };
        }
        if (token.kind === TokenKind.Identifier) {
            this.advance();
            return { type: "Identifier", name: token.value };
        }
        if (token.kind === TokenKind.Number) {
            this.advance();
            return { type: "NumberLiteral", value: Number(token.value) };
        }
        if (token.kind === TokenKind.Keyword && (token.value === "true" || token.value === "false")) {
            this.advance();
            return { type: "BooleanLiteral", value: token.value === "true" };
        }
        throw new Error("Expected a string or identifier");
    }

    peek(): Token {
        const token = this.tokens[this.pos];
        if (!token) {
            throw new Error("Unexpected end of file");
        }
        return token;
    }

    advance(): Token {
        const token = this.tokens[this.pos];
        if (!token) {
            throw new Error("Unexpected end of file");
        }
        this.pos++;
        return token;
    }

    checkKeyword(word: string): boolean {
        const token = this.peek();
        return token.kind === TokenKind.Keyword && token.value === word;
    }

    expectKeyword(word: string): void {
        if (!this.checkKeyword(word)) {
            throw new Error(`Expected '${word}'`);
        }
        this.advance();
    }

    expect(value: string): void {
        const token = this.peek();
        if (token.value !== value) {
            throw new Error(`Expected '${value}'`);
        }
        this.advance();
    }
}