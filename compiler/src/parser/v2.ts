/**  import { Token, TokenKind } from "../lexer/token.js";
import type {
  ActionDecl,
  Expr,
  IfStatement,
  LetDecl,
  MatchStatement,
  Param,
  PageDecl,
  Program,
  ReturnStatement,
  StateDecl,
  Statement,
  UINode,
  UIProp,
} from "../ast/nodes.js";

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`${message} at line ${token.span.line}, column ${token.span.column} (got "${token.value || token.kind}")`);
    this.name = "ParseError";
  }
}


 * Hand-written recursive-descent parser. Deliberately not table-driven —
 * Nova's grammar is small enough that clarity beats a parser generator
 * for now. Revisit if `grammar.ebnf` grows past what this stays readable for.
 
export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parseProgram(): Program {
    const start = this.peek();
    const body: Program["body"] = [];
    while (!this.isAtEnd()) {
      if (this.checkKeyword("page")) {
        body.push(this.parsePageDecl());
      } else {
        throw new ParseError("Expected a top-level declaration (e.g. 'page')", this.peek());
      }
    }
    return { type: "Program", body, span: this.spanFrom(start) };
  }

  // ---- top level ----

  private parsePageDecl(): PageDecl {
    const start = this.peek();
    this.expectKeyword("page");
    const route = this.expectString().value;
    this.expectPunct("{");

    const body: Statement[] = [];
    const ui: UINode[] = [];

    while (!this.checkPunct("}")) {
      if (this.checkKeyword("state")) {
        body.push(this.parseStateDecl());
      } else if (this.checkKeyword("async") || this.checkKeyword("action") || this.checkKeyword("server")) {
        body.push(this.parseActionDecl());
      } else if (this.check(TokenKind.Identifier) && this.checkNext(TokenKind.Punctuation, "{")) {
        // bare `title "Welcome Back"` style prop at page level, or a UI node.
        ui.push(this.parseUINode());
      } else if (this.check(TokenKind.Identifier)) {
        // Page-level prop like `title "Welcome Back"` (no block)
        ui.push(this.parseUINode());
      } else {
        throw new ParseError("Unexpected token inside page body", this.peek());
      }
    }
    this.expectPunct("}");

    return { type: "PageDecl", route, body, ui, span: this.spanFrom(start) };
  }

  // ---- statements ----

  private parseStateDecl(): StateDecl {
    const start = this.peek();
    this.expectKeyword("state");
    const name = this.expectIdentifier().value;
    this.expectOperator("=");
    const init = this.parseExpr();
    return { type: "StateDecl", name, init, span: this.spanFrom(start) };
  }

  private parseLetDecl(): LetDecl {
    const start = this.peek();
    this.expectKeyword("let");
    const name = this.expectIdentifier().value;
    this.expectOperator("=");
    const init = this.parseExpr();
    return { type: "LetDecl", name, init, span: this.spanFrom(start) };
  }

  private parseActionDecl(): ActionDecl {
    const start = this.peek();
    const isAsync = this.matchKeyword("async");
    const isServer = this.matchKeyword("server");
    this.expectKeyword("action");
    const name = this.expectIdentifier().value;
    const params = this.parseParams();
    const body = this.parseBlockStatements();
    return { type: "ActionDecl", name, isAsync, isServer, params, body, span: this.spanFrom(start) };
  }

  private parseParams(): Param[] {
    this.expectPunct("(");
    const params: Param[] = [];
    while (!this.checkPunct(")")) {
      const start = this.peek();
      const name = this.expectIdentifier().value;
      params.push({ type: "Param", name, span: this.spanFrom(start) });
      if (!this.checkPunct(")")) this.expectPunct(",");
    }
    this.expectPunct(")");
    return params;
  }

  private parseBlockStatements(): Statement[] {
    this.expectPunct("{");
    const statements: Statement[] = [];
    while (!this.checkPunct("}")) {
      statements.push(this.parseStatement());
    }
    this.expectPunct("}");
    return statements;
  }

  private parseStatement(): Statement {
    if (this.checkKeyword("state")) return this.parseStateDecl();
    if (this.checkKeyword("let") || this.checkKeyword("const")) return this.parseLetDecl();
    if (this.checkKeyword("if")) return this.parseIfStatement();
    if (this.checkKeyword("match")) return this.parseMatchStatement();
    if (this.checkKeyword("return")) return this.parseReturnStatement();
    const expr = this.parseExpr();
    return { type: "ExprStatement", expression: expr, span: expr.span };
  }

  private parseIfStatement(): IfStatement {
    const start = this.peek();
    this.expectKeyword("if");
    this.expectPunct("(");
    const condition = this.parseExpr();
    this.expectPunct(")");
    const consequent = this.parseBlockStatements();
    let alternate: Statement[] | IfStatement | undefined;
    if (this.matchKeyword("else")) {
      alternate = this.checkKeyword("if") ? this.parseIfStatement() : this.parseBlockStatements();
    }
    return {
      type: "IfStatement",
      condition,
      consequent,
      span: this.spanFrom(start),
      ...(alternate !== undefined ? { alternate } : {}),
    };
  }

  private parseMatchStatement(): MatchStatement {
    const start = this.peek();
    this.expectKeyword("match");
    this.expectPunct("(");
    const discriminant = this.parseExpr();
    this.expectPunct(")");
    this.expectPunct("{");
    const arms: MatchStatement["arms"] = [];
    while (!this.checkPunct("}")) {
      const pattern = this.parseExpr();
      this.expectOperator("=>");
      const body = this.checkPunct("{") ? this.parseBlockStatements() : this.parseExpr();
      arms.push({ pattern, body });
    }
    this.expectPunct("}");
    return { type: "MatchStatement", discriminant, arms, span: this.spanFrom(start) };
  }

  private parseReturnStatement(): ReturnStatement {
    const start = this.peek();
    this.expectKeyword("return");
    const argument = this.checkPunct("}") ? undefined : this.parseExpr();
    return {
      type: "ReturnStatement",
      span: this.spanFrom(start),
      ...(argument !== undefined ? { argument } : {}),
    };
  }

  // ---- UI nodes ----

  private parseUINode(): UINode {
    const start = this.peek();
    const name = this.expectIdentifier().value;

    const args: Expr[] = [];
    // Optional call-style args, e.g. `link "/register" { ... }`
    while (this.checkString() || (this.check(TokenKind.NumberLiteral))) {
      args.push(this.parsePrimary());
      if (this.checkPunct("{")) break;
    }

    if (!this.checkPunct("{")) {
      // Bare prop line with no block, e.g. `title "Welcome Back"`
      return { type: "UINode", name, args, props: [], children: [], span: this.spanFrom(start) };
    }

    this.expectPunct("{");
    const props: UIProp[] = [];
    const children: (UINode | Expr)[] = [];

    while (!this.checkPunct("}")) {
      if (this.checkString()) {
        children.push(this.parsePrimary());
        this.matchPunct(";");
        continue;
      }
      if (this.checkIdentifierLike() && this.checkNext(TokenKind.Punctuation, "{")) {
        children.push(this.parseUINode());
        continue;
      }
      if (this.checkIdentifierLike()) {
        // Could be `width 420` (prop) or `link "/register" { ... }` (nested node with args)
        const savedPos = this.pos;
        const propNameToken = this.advance();
        const propName = propNameToken.value;
        if (this.checkString() && this.peekAhead(1, TokenKind.Punctuation, "{")) {
          this.pos = savedPos;
          children.push(this.parseUINode());
          continue;
        }
        // A prop's value (if any) must sit on the same source line as its
        // name — that's what disambiguates a bare boolean flag like
        // `fullWidth` from a valued prop like `click login` without
        // requiring semicolons/commas everywhere. If the next token has
        // wrapped to a new line, this prop has no value.
        const values: Expr[] = [];
        if (
          !this.checkPunct(";") &&
          !this.checkPunct("}") &&
          this.peek().span.line === propNameToken.span.line
        ) {
          values.push(this.parseExpr());
        }
        props.push({ type: "UIProp", name: propName, values, span: this.spanFrom(propNameToken) });
        this.matchPunct(";");
        continue;
      }
      throw new ParseError("Unexpected token inside UI block", this.peek());
    }
    this.expectPunct("}");

    return { type: "UINode", name, args, props, children, span: this.spanFrom(start) };
  }

  // ---- expressions (precedence climbing) ----

  private parseExpr(): Expr {
    return this.parseAssignment();
  }

  private parseAssignment(): Expr {
    const left = this.parseLogicalOr();
    if (this.checkOperator("=") || this.checkOperator("+=") || this.checkOperator("-=")) {
      const operator = this.advance().value;
      const right = this.parseAssignment();
      return { type: "AssignmentExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.checkOperator("||")) {
      const operator = this.advance().value;
      const right = this.parseLogicalAnd();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.checkOperator("&&")) {
      const operator = this.advance().value;
      const right = this.parseEquality();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseComparison();
    while (this.checkOperator("==") || this.checkOperator("!=")) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (
      this.checkOperator("<") || this.checkOperator(">") ||
      this.checkOperator("<=") || this.checkOperator(">=")
    ) {
      const operator = this.advance().value;
      const right = this.parseAdditive();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.checkOperator("+") || this.checkOperator("-")) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.checkOperator("*") || this.checkOperator("/") || this.checkOperator("%")) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = { type: "BinaryExpr", operator, left, right, span: this.spanFrom(left) };
    }
    return left;
  }

  private parseUnary(): Expr {
    const start = this.peek();
    if (this.matchKeyword("await")) {
      const argument = this.parseUnary();
      return { type: "AwaitExpr", argument, span: this.spanFrom(start) };
    }
    if (this.checkOperator("!") || this.checkOperator("-")) {
      const operator = this.advance().value;
      const argument = this.parseUnary();
      return { type: "UnaryExpr", operator, argument, span: this.spanFrom(start) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.checkPunct(".")) {
        this.advance();
        const property = this.expectIdentifier().value;
        expr = { type: "MemberExpr", object: expr, property, span: this.spanFrom(expr) };
      } else if (this.checkPunct("(")) {
        this.advance();
        const args: Expr[] = [];
        while (!this.checkPunct(")")) {
          args.push(this.parseExpr());
          if (!this.checkPunct(")")) this.expectPunct(",");
        }
        this.expectPunct(")");
        expr = { type: "CallExpr", callee: expr, args, span: this.spanFrom(expr) };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.kind === TokenKind.NumberLiteral) {
      this.advance();
      return { type: "NumberLiteral", value: Number(t.value), span: t.span };
    }
    if (t.kind === TokenKind.StringLiteral) {
      this.advance();
      return { type: "StringLiteral", value: t.value, span: t.span };
    }
    if (this.checkKeyword("true") || this.checkKeyword("false")) {
      this.advance();
      return { type: "BooleanLiteral", value: t.value === "true", span: t.span };
    }
    if (t.kind === TokenKind.Identifier) {
      this.advance();
      return { type: "Identifier", name: t.value, span: t.span };
    }
    if (this.checkPunct("(")) {
      this.advance();
      const expr = this.parseExpr();
      this.expectPunct(")");
      return expr;
    }
    throw new ParseError("Expected an expression", t);
  }

  // ---- token stream helpers ----

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private advance(): Token {
    const t = this.tokens[this.pos]!;
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.EOF;
  }

  private check(kind: TokenKind, value?: string): boolean {
    const t = this.peek();
    return t.kind === kind && (value === undefined || t.value === value);
  }


  private checkIdentifierLike(): boolean {
    const t = this.peek();
    return t.kind === TokenKind.Identifier || t.kind === TokenKind.Keyword;
  }

  private checkNext(kind: TokenKind, value?: string): boolean {
    const t = this.peek(1);
    return t.kind === kind && (value === undefined || t.value === value);
  }

  private peekAhead(offset: number, kind: TokenKind, value?: string): boolean {
    const t = this.peek(offset);
    return t.kind === kind && (value === undefined || t.value === value);
  }

  private checkKeyword(word: string): boolean {
    return this.check(TokenKind.Keyword, word);
  }

  private checkPunct(p: string): boolean {
    return this.check(TokenKind.Punctuation, p);
  }

  private checkOperator(op: string): boolean {
    return this.check(TokenKind.Operator, op);
  }

  private checkString(): boolean {
    return this.check(TokenKind.StringLiteral);
  }

  private matchKeyword(word: string): boolean {
    if (this.checkKeyword(word)) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchPunct(p: string): boolean {
    if (this.checkPunct(p)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expectKeyword(word: string): Token {
    if (!this.checkKeyword(word)) throw new ParseError(`Expected keyword '${word}'`, this.peek());
    return this.advance();
  }

  private expectPunct(p: string): Token {
    if (!this.checkPunct(p)) throw new ParseError(`Expected '${p}'`, this.peek());
    return this.advance();
  }

  private expectOperator(op: string): Token {
    if (!this.checkOperator(op)) throw new ParseError(`Expected '${op}'`, this.peek());
    return this.advance();
  }

  private expectIdentifier(): Token {
    if (!this.check(TokenKind.Identifier)) throw new ParseError("Expected an identifier", this.peek());
    return this.advance();
  }

  private expectString(): Token {
    if (!this.checkString()) throw new ParseError("Expected a string literal", this.peek());
    return this.advance();
  }

  private spanFrom(startNodeOrToken: { span: { start: number; line: number; column: number } } | Token) {
    const startSpan = "span" in startNodeOrToken ? startNodeOrToken.span : startNodeOrToken;
    const endToken = this.tokens[Math.max(0, this.pos - 1)]!;
    return {
      start: startSpan.start,
      end: endToken.span.end,
      line: startSpan.line,
      column: startSpan.column,
    };
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parseProgram();
}


**/