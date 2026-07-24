import { Token, TokenKind } from "../lexer/token.js";
import { Program, Statement, Expression, Parameter, TypeAnnotation } from "../ast/nodes.js";

export class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    parseProgram(): Program {
        const body: Statement[] = [];

        while (this.peek().kind !== TokenKind.EOF) {
            body.push(this.parseStatement());
        }

        return { type: "Program", body };
    }

    parseStatement(): Statement {
        if (this.checkKeyword("print")) return this.parsePrint();
        if (this.checkKeyword("val") || this.checkKeyword("let")) return this.parseVal();
        if (this.checkKeyword("rave") || this.checkKeyword("const")) return this.parseConst();
        if (this.checkKeyword("if")) return this.parseIf();
        if (this.checkKeyword("while")) return this.parseWhile();
        if (this.checkKeyword("fn")) return this.parseFunctionDeclaration();
        if (this.checkKeyword("return")) return this.parseReturn();
        if (this.checkKeyword("break")) { this.advance(); return { type: "BreakStatement" }; }
        if (this.checkKeyword("continue")) { this.advance(); return { type: "ContinueStatement" }; }
        if (this.peek().kind === TokenKind.Identifier && this.tokens[this.pos + 1]?.value === "=") {
            return this.parseAssignment();
        }
        if (this.peek().kind === TokenKind.Identifier && this.tokens[this.pos + 1]?.value === "(") {
            const expression = this.parseExpression();
            if (this.peek().value === ";") this.advance();
            return { type: "ExpressionStatement", expression };
        }
        throw new Error("Expected a statement");
    }

    parsePrint(): Statement {
        this.expectKeyword("print");
        this.expect("(");
        const argument = this.parseExpression();
        this.expect(")");
        return { type: "PrintStatement", argument };
    }

    parseVal(): Statement {
        const declarationKeyword = this.advance().value;

        const nameToken = this.peek();
        if (nameToken.kind !== TokenKind.Identifier) {
            throw new Error("Expected an identifier after variable declaration");
        }
        this.advance();

        let typeAnnotation: TypeAnnotation | undefined;
        if (this.peek().value === ":") {
            this.advance();
            const typeToken = this.peek();
            if (typeToken.kind !== TokenKind.Identifier) {
                throw new Error("Expected a type name after ':'");
            }
            typeAnnotation = typeToken.value as TypeAnnotation;
            this.advance();
        }

        this.expect("=");
        const value = this.parseExpression();

        return typeAnnotation === undefined
            ? { type: "VariableDeclaration", name: nameToken.value, value }
            : { type: "VariableDeclaration", name: nameToken.value, value, typeAnnotation };
    }

    parseConst(): Statement {
        const declarationKeyword = this.advance().value;

        const nameToken = this.peek();
        if (nameToken.kind !== TokenKind.Identifier) {
            throw new Error("Expected an identifier after constant declaration");
        }
        this.advance();

        let typeAnnotation: TypeAnnotation | undefined;
        if (this.peek().value === ":") {
            this.advance();
            const typeToken = this.peek();
            if (typeToken.kind !== TokenKind.Identifier) {
                throw new Error("Expected a type name after ':'");
            }
            typeAnnotation = typeToken.value as TypeAnnotation;
            this.advance();
        }

        this.expect("=");
        const value = this.parseExpression();

        return typeAnnotation === undefined
            ? { type: "ConstantDeclaration", name: nameToken.value, value }
            : { type: "ConstantDeclaration", name: nameToken.value, value, typeAnnotation };
    }

    parseAssignment(): Statement {
        const nameToken = this.advance();
        this.expect("=");
        const value = this.parseExpression();
        return { type: "Assignment", name: nameToken.value, value };
    }

    parseIf(): Statement {
        this.expectKeyword("if");
        const condition = this.parseExpression();
        this.expectKeyword("then");

        const consequent = this.parseBlockUntil(["else", "end"]);

        let alternate: Statement[] | undefined;
        if (this.checkKeyword("else")) {
            this.advance();
            alternate = this.parseBlockUntil(["end"]);
        }

        this.expectKeyword("end");

        return alternate === undefined
            ? { type: "IfStatement", condition, consequent }
            : { type: "IfStatement", condition, consequent, alternate };
    }

    parseWhile(): Statement {
        this.expectKeyword("while");
        const condition = this.parseExpression();
        this.expectKeyword("do");
        const body = this.parseBlockUntil(["end"]);
        this.expectKeyword("end");
        return { type: "WhileStatement", condition, body };
    }

    parseFunctionDeclaration(): Statement {
        this.expectKeyword("fn");

        const nameToken = this.peek();
        if (nameToken.kind !== TokenKind.Identifier) {
            throw new Error("Expected a function name after 'fn'");
        }
        this.advance();

        this.expect("(");
        const parameters: Parameter[] = [];
        while (this.peek().value !== ")") {
            const paramName = this.peek();
            if (paramName.kind !== TokenKind.Identifier) {
                throw new Error("Expected a parameter name");
            }
            this.advance();

            this.expect(":");
            const typeToken = this.peek();
            if (typeToken.kind !== TokenKind.Identifier) {
                throw new Error("Expected a parameter type");
            }
            this.advance();

            parameters.push({ name: paramName.value, typeAnnotation: typeToken.value as TypeAnnotation });

            if (this.peek().value === ",") {
                this.advance();
            }
        }
        this.expect(")");

        this.expect(":");
        const returnTypeToken = this.peek();
        if (returnTypeToken.kind !== TokenKind.Identifier) {
            throw new Error("Expected a return type after ':'");
        }
        this.advance();

        this.expectKeyword("do");
        const body = this.parseBlockUntil(["end"]);
        this.expectKeyword("end");

        return {
            type: "FunctionDeclaration",
            name: nameToken.value,
            parameters,
            returnType: returnTypeToken.value as TypeAnnotation,
            body,
        };
    }

    parseReturn(): Statement {
        this.expectKeyword("return");
        const value = this.parseExpression();
        return { type: "ReturnStatement", value };
    }

    parseBlockUntil(stopKeywords: string[]): Statement[] {
        const statements: Statement[] = [];
        while (!stopKeywords.some(word => this.checkKeyword(word))) {
            statements.push(this.parseStatement());
        }
        return statements;
    }

    parseExpression(): Expression {
        return this.parseLogical();
    }

    parseLogical(): Expression {
        let left: Expression = this.parseComparison();

        while (this.checkKeyword("and") || this.checkKeyword("or")) {
            const operator = this.advance().value as "and" | "or";
            const right = this.parseComparison();
            left = { type: "BinaryExpression", operator, left, right };
        }

        return left;
    }

    parseComparison(): Expression {
        let left: Expression = this.parseAdditive();

        while (
            ["==", "!=", "<", "<=", ">", ">="].includes(this.peek().value)
        ) {
            const operator = this.advance().value as "==" | "!=" | "<" | "<=" | ">" | ">=";
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

        while (this.peek().value === "*" || this.peek().value === "/" || this.peek().value === "%") {
            const operator = this.advance().value as "*" | "/" | "%";
            const right = this.parsePrimary();
            left = { type: "BinaryExpression", operator, left, right };
        }

        return left;
    }
    

    parsePrimary(): Expression {
    let expr = this.parsePrimaryBase(); 
    while (this.peek().value === "[") {
        this.advance();
        const index = this.parseExpression();
        this.expect("]");
        expr = { type: "IndexExpression", array: expr, index };
    }
    return expr;
}

    private parsePrimaryBase(): Expression {
        if (this.checkKeyword("not")) {
            this.advance();
            const argument = this.parsePrimary();
            return { type: "UnaryExpression", operator: "not", argument };
        }

        const token = this.peek();

        if (this.peek().value === "(") {
            this.advance();
            const expression = this.parseExpression();
            this.expect(")");
            return expression;
        }

        if (token.kind === TokenKind.Identifier && this.tokens[this.pos + 1]?.value === "(") {
            return this.parseCall();
        }

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
          if (this.peek().value === "[") {           // NEW
        return this.parseArrayLiteral();
    }
        throw new Error("Expected a string, number, boolean, identifier, or function call");
    }

    parseCall(): Expression {
        const nameToken = this.advance();
        this.expect("(");
        const args: Expression[] = [];
        while (this.peek().value !== ")") {
            args.push(this.parseExpression());
            if (this.peek().value === ",") {
                this.advance();
            }
        }
        this.expect(")");
        return { type: "CallExpression", callee: nameToken.value, arguments: args };
    }
    parseArrayLiteral(): Expression {
    this.expect("[");
    const elements: Expression[] = [];
    while (this.peek().value !== "]") {
        elements.push(this.parseExpression());
        if (this.peek().value === ",") {
            this.advance();
        }
    }
    this.expect("]");
    return { type: "ArrayLiteral", elements };
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