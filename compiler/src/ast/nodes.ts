import type { SourceSpan } from "../lexer/token.js";

export interface Node {
  span: SourceSpan;
}

export interface Program extends Node {
  type: "Program";
  body: TopLevel[];
}

export type TopLevel = PageDecl | ComponentDecl | ImportDecl | TypeDecl;

export interface ImportDecl extends Node {
  type: "ImportDecl";
  specifiers: string[] | "*";
  source: string;
}

export interface PageDecl extends Node {
  type: "PageDecl";
  route: string;
  body: Statement[];
  ui: UINode[];
}

export interface ComponentDecl extends Node {
  type: "ComponentDecl";
  name: string;
  params: Param[];
  body: Statement[];
  ui: UINode[];
}

export interface Param extends Node {
  type: "Param";
  name: string;
  typeAnnotation?: TypeExpr;
  defaultValue?: Expr;
}

export type TypeDecl = { type: "TypeDecl"; name: string } & Node;

export type Statement =
  | StateDecl
  | LetDecl
  | ActionDecl
  | ExprStatement
  | IfStatement
  | MatchStatement
  | ReturnStatement;

export interface StateDecl extends Node {
  type: "StateDecl";
  name: string;
  typeAnnotation?: TypeExpr;
  init: Expr;
}

// `let x = ...` — a plain, non-reactive local binding (as opposed to
// `state x = ...`, which the compiler tracks for reactivity; see state.md).
export interface LetDecl extends Node {
  type: "LetDecl";
  name: string;
  typeAnnotation?: TypeExpr;
  init: Expr;
}

export interface ActionDecl extends Node {
  type: "ActionDecl";
  name: string;
  isAsync: boolean;
  isServer: boolean;
  params: Param[];
  returnType?: TypeExpr;
  body: Statement[];
}

export interface ExprStatement extends Node {
  type: "ExprStatement";
  expression: Expr;
}

export interface IfStatement extends Node {
  type: "IfStatement";
  condition: Expr;
  consequent: Statement[];
  alternate?: Statement[] | IfStatement;
}

export interface MatchStatement extends Node {
  type: "MatchStatement";
  discriminant: Expr;
  arms: { pattern: Expr; body: Statement[] | Expr }[];
}

export interface ReturnStatement extends Node {
  type: "ReturnStatement";
  argument?: Expr;
}

// UI tree — the part that renders `card { ... }`, `input { ... }`, etc.
export interface UINode extends Node {
  type: "UINode";
  name: string; // e.g. "card", "input", "button"
  args: Expr[]; // e.g. `link "/register" { ... }` -> args: [StringLiteral("/register")]
  props: UIProp[]; // e.g. `width 420`, `bind email`
  children: (UINode | Expr)[]; // nested nodes and bare string/text children
}

export interface UIProp extends Node {
  type: "UIProp";
  name: string; // e.g. "width", "bind", "click"
  values: Expr[]; // e.g. `spacing 24` -> [NumberLiteral(24)]
}

export type Expr =
  | Identifier
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | AssignmentExpr
  | AwaitExpr;

export interface Identifier extends Node {
  type: "Identifier";
  name: string;
}

export interface StringLiteral extends Node {
  type: "StringLiteral";
  value: string;
}

export interface NumberLiteral extends Node {
  type: "NumberLiteral";
  value: number;
}

export interface BooleanLiteral extends Node {
  type: "BooleanLiteral";
  value: boolean;
}

export interface BinaryExpr extends Node {
  type: "BinaryExpr";
  operator: string;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends Node {
  type: "UnaryExpr";
  operator: string;
  argument: Expr;
}

export interface CallExpr extends Node {
  type: "CallExpr";
  callee: Expr;
  args: Expr[];
}

export interface MemberExpr extends Node {
  type: "MemberExpr";
  object: Expr;
  property: string;
}

export interface AssignmentExpr extends Node {
  type: "AssignmentExpr";
  operator: string;
  left: Expr;
  right: Expr;
}

export interface AwaitExpr extends Node {
  type: "AwaitExpr";
  argument: Expr;
}

// Minimal placeholder — expand alongside type-system.md
export interface TypeExpr extends Node {
  type: "TypeExpr";
  name: string;
  generics?: TypeExpr[];
}
