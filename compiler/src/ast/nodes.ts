export interface SourceLocation {
    file: string;
    line: number;
    column: number;
    start: number;
    end: number;
}

export interface Node {
    location?: SourceLocation;
}

export interface Program extends Node {
    type: "Program";
    body: Statement[];
}



export type Statement =
    | PrintStatement
    | VariableDeclaration
    | ConstantDeclaration
    | Assignment
    | IfStatement
    | WhileStatement
    | FunctionDeclaration   
    | ReturnStatement
    | ExpressionStatement
    | BreakStatement
    | ContinueStatement;      

export interface Parameter {
    name: string;
    typeAnnotation: TypeAnnotation;
}

export interface FunctionDeclaration extends Node {
    type: "FunctionDeclaration";
    name: string;
    parameters: Parameter[];
    returnType: TypeAnnotation;
    body: Statement[];
}

export interface ExpressionStatement extends Node {
    type: "ExpressionStatement";
    expression: Expression;
}

export interface BreakStatement extends Node {
    type: "BreakStatement";
}

export interface ContinueStatement extends Node {
    type: "ContinueStatement";
}

export interface ReturnStatement extends Node {
    type: "ReturnStatement";
    value: Expression;
}

export interface WhileStatement extends Node {
    type: "WhileStatement";
    condition: Expression;
    body: Statement[];
}
export interface CallExpression extends Node {
    type: "CallExpression";
    callee: string;
    arguments: Expression[];
}
export interface ArrayLiteral extends Node {
    type: "ArrayLiteral";
    elements: Expression[];
}

export interface IndexExpression extends Node {
    type: "IndexExpression";
    array: Expression;
    index: Expression;
}

export interface IfStatement extends Node {
    type: "IfStatement";
    condition: Expression;
    consequent: Statement[];
    alternate?: Statement[];
}

export interface PrintStatement extends Node {
    type: "PrintStatement";
    argument: Expression;
}
export interface Assignment extends Node {
    type: "Assignment";
    name: string;
    value: Expression;
}
export interface VariableDeclaration extends Node {
    type: "VariableDeclaration";
    name: string;
    value: Expression;
    typeAnnotation?: TypeAnnotation;
}
export interface ConstantDeclaration extends Node {
    type: "ConstantDeclaration";
    name: string;
    value: Expression;
    typeAnnotation?: TypeAnnotation; 
}

export interface BooleanLiteral extends Node {   
    type: "BooleanLiteral";
    value: boolean;
}
export type Expression =
    | StringLiteral
    | NumberLiteral
    | BooleanLiteral
    | CallExpression
    | Identifier
    | ArrayLiteral      
    | IndexExpression
    | BinaryExpression
    | UnaryExpression; 

export interface UnaryExpression extends Node {
    type: "UnaryExpression";
    operator: "not";
    argument: Expression;
}
export interface StringLiteral extends Node {
    type: "StringLiteral";
    value: string;
}
export interface NumberLiteral extends Node {
    type: "NumberLiteral";
    value: number;
}

export interface Identifier extends Node {
    type: "Identifier";
    name: string;
}

export interface BinaryExpression extends Node {
    type: "BinaryExpression";
    operator: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "and" | "or";
    left: Expression;
    right: Expression;
}

export type TypeAnnotation =
    | "string"
    | "number"
    | "boolean"
    | { kind: "array"; elementType: TypeAnnotation }; 