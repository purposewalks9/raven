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

        return { type: "Program", body, location: this.tokens[0]?.location ?? this.peek().location };
    }

    parseStatement(): Statement {
        if (this.checkKeyword("print")) return this.parsePrint();
        if (this.checkKeyword("val") || this.checkKeyword("let")) return this.parseVal();
        if (this.checkKeyword("rave") || this.checkKeyword("const")) return this.parseConst();
        if (this.checkKeyword("if")) return this.parseIf();
        if (this.checkKeyword("while")) return this.parseWhile();
        if (this.checkKeyword("fn")) return this.parseFunctionDeclaration();
        if (this.checkKeyword("return")) return this.parseReturn();
        if (this.checkKeyword("break")) { const token = this.advance(); return this.withLocation({ type: "BreakStatement" }, token.location); }
        if (this.checkKeyword("continue")) { const token = this.advance(); return this.withLocation({ type: "ContinueStatement" }, token.location); }
        if (this.peek().kind === TokenKind.Identifier && this.tokens[this.pos + 1]?.value === "=") {
            return this.parseAssignment();
        }
        if (this.peek().kind === TokenKind.Identifier && this.tokens[this.pos + 1]?.value === "(") {
            const expression = this.parseExpression();
            if (this.peek().value === ";") this.advance();
            return this.withLocation({ type: "ExpressionStatement", expression }, expression.location);
        }
        throw new Error("Expected a statement");
    }

    parsePrint(): Statement {
        const start = this.peek().location;
        this.expectKeyword("print");
        this.expect("(");
        const argument = this.parseExpression();
        this.expect(")");
        return this.withLocation({ type: "PrintStatement", argument }, start);
    }

    parseVal(): Statement {
        const start = this.peek().location;
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
            ? this.withLocation({ type: "VariableDeclaration", name: nameToken.value, value }, start)
            : this.withLocation({ type: "VariableDeclaration", name: nameToken.value, value, typeAnnotation }, start);
    }

    parseConst(): Statement {
        const start = this.peek().location;
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
            ? this.withLocation({ type: "ConstantDeclaration", name: nameToken.value, value }, start)
            : this.withLocation({ type: "ConstantDeclaration", name: nameToken.value, value, typeAnnotation }, start);
    }

    parseAssignment(): Statement {
        const nameToken = this.advance();
        const start = nameToken.location;
        this.expect("=");
        const value = this.parseExpression();
        return this.withLocation({ type: "Assignment", name: nameToken.value, value }, start);
    }

    parseIf(): Statement {
        const start = this.peek().location;
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
            ? this.withLocation({ type: "IfStatement", condition, consequent }, start)
            : this.withLocation({ type: "IfStatement", condition, consequent, alternate }, start);
    }

    parseWhile(): Statement {
        const start = this.peek().location;
        this.expectKeyword("while");
        const condition = this.parseExpression();
        this.expectKeyword("do");
        const body = this.parseBlockUntil(["end"]);
        this.expectKeyword("end");
        return this.withLocation({ type: "WhileStatement", condition, body }, start);
    }

    parseFunctionDeclaration(): Statement {
        const start = this.peek().location;
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

        return this.withLocation({
            type: "FunctionDeclaration",
            name: nameToken.value,
            parameters,
            returnType: returnTypeToken.value as TypeAnnotation,
            body,
        }, start);
    }

    parseReturn(): Statement {
        const start = this.peek().location;
        this.expectKeyword("return");
        const value = this.parseExpression();
        return this.withLocation({ type: "ReturnStatement", value }, start);
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
            left = this.withLocation({ type: "BinaryExpression", operator, left, right }, left.location);
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
            left = this.withLocation({ type: "BinaryExpression", operator, left, right }, left.location);
        }

        return left;
    }

    parseAdditive(): Expression {
        let left: Expression = this.parseMultiplicative();

        while (this.peek().value === "+" || this.peek().value === "-") {
            const operator = this.advance().value as "+" | "-";
            const right = this.parseMultiplicative();
            left = this.withLocation({ type: "BinaryExpression", operator, left, right }, left.location);
        }

        return left;
    }

    parseMultiplicative(): Expression {
        let left: Expression = this.parsePrimary();

        while (this.peek().value === "*" || this.peek().value === "/" || this.peek().value === "%") {
            const operator = this.advance().value as "*" | "/" | "%";
            const right = this.parsePrimary();
            left = this.withLocation({ type: "BinaryExpression", operator, left, right }, left.location);
        }

        return left;
    }
    

    parsePrimary(): Expression {
    let expr = this.parsePrimaryBase(); 
    while (this.peek().value === "[") {
        this.advance();
        const index = this.parseExpression();
        this.expect("]");
        expr = this.withLocation({ type: "IndexExpression", array: expr, index }, expr.location);
    }
    return expr;
}

    private parsePrimaryBase(): Expression {
        const token = this.peek();

        if (this.checkKeyword("not")) {
            this.advance();
            const argument = this.parsePrimary();
            return this.withLocation({ type: "UnaryExpression", operator: "not", argument }, token.location);
        }

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
            return this.withLocation({ type: "StringLiteral", value: token.value }, token.location);
        }
        if (token.kind === TokenKind.Identifier) {
            this.advance();
            return this.withLocation({ type: "Identifier", name: token.value }, token.location);
        }
        if (token.kind === TokenKind.Number) {
            this.advance();
            return this.withLocation({ type: "NumberLiteral", value: Number(token.value) }, token.location);
        }
        if (token.kind === TokenKind.Keyword && (token.value === "true" || token.value === "false")) {
            this.advance();
            return this.withLocation({ type: "BooleanLiteral", value: token.value === "true" }, token.location);
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
        return this.withLocation({ type: "CallExpression", callee: nameToken.value, arguments: args }, nameToken.location);
    }
    parseArrayLiteral(): Expression {
    const start = this.peek().location;
    this.expect("[");
    const elements: Expression[] = [];
    while (this.peek().value !== "]") {
        elements.push(this.parseExpression());
        if (this.peek().value === ",") {
            this.advance();
        }
    }
    this.expect("]");
    return this.withLocation({ type: "ArrayLiteral", elements }, start);
}

    private withLocation<T extends object>(node: T, location = this.peek().location): T & { location: Token["location"] } {
        return { ...node, location };
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