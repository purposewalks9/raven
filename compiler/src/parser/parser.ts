import { Token, TokenKind } from "../lexer/token.js";

export class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    parseProgram() {
        const body = [];

        while (this.peek().kind !== TokenKind.EOF) {
            body.push(this.parseStatement());
        }

        return {
            type: "Program",
            body
        };
    }

    parseStatement() {
        if (this.checkKeyword("print")) {
            return this.parsePrint();
        }
        throw new Error("Expected a statement");
    }

    parsePrint() {
        this.expectKeyword("print");
        this.expect("(");
        const argument = this.parseExpression();
        this.expect(")");
        return {
            type: "PrintStatement",
            argument
        };
    }

    parseExpression() {
        return this.parsePrimary();
    }

    parsePrimary() {
        const token = this.peek();
        if (token.kind === TokenKind.String) {
            this.advance();
            return {
                type: "StringLiteral",
                value: token.value
            };
        }
        throw new Error("Expected a string");
    }

    peek(): Token {
        const token = this.tokens[this.pos];
        if (!token) {
            throw new Error("Unexpected end of file");
        }
        return token;
    }

    advance() {
        return this.tokens[this.pos++];
    }

    checkKeyword(word: string) {
        const token = this.peek();
        return token.kind === TokenKind.Keyword && token.value === word;
    }

    expectKeyword(word: string) {
        if (!this.checkKeyword(word)) {
            throw new Error(`Expected '${word}'`);
        }
        this.advance();
    }

    expect(value: string) {
        const token = this.peek();
        if (token.value !== value) {
            throw new Error(`Expected '${value}'`);
        }
        this.advance();
    }
}