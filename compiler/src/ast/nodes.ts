export interface Program {
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
    | ReturnStatement;      

export interface Parameter {
    name: string;
    typeAnnotation: TypeAnnotation;
}

export interface FunctionDeclaration {
    type: "FunctionDeclaration";
    name: string;
    parameters: Parameter[];
    returnType: TypeAnnotation;
    body: Statement[];
}

export interface ReturnStatement {
    type: "ReturnStatement";
    value: Expression;
}

export interface WhileStatement {
    type: "WhileStatement";
    condition: Expression;
    body: Statement[];
}
export interface CallExpression {
    type: "CallExpression";
    callee: string;
    arguments: Expression[];
}
export interface ArrayLiteral {
    type: "ArrayLiteral";
    elements: Expression[];
}

export interface IndexExpression {
    type: "IndexExpression";
    array: Expression;
    index: Expression;
}

export interface IfStatement {
    type: "IfStatement";
    condition: Expression;
    consequent: Statement[];
    alternate?: Statement[];
}

export interface PrintStatement {
    type: "PrintStatement";
    argument: Expression;
}
export interface Assignment {
    type: "Assignment";
    name: string;
    value: Expression;
}
export interface VariableDeclaration {
    type: "VariableDeclaration";
    name: string;
    value: Expression;
    typeAnnotation?: TypeAnnotation;
}
export interface ConstantDeclaration {
    type: "ConstantDeclaration";
    name: string;
    value: Expression;
    typeAnnotation?: TypeAnnotation; 
}

export interface BooleanLiteral {   
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

export interface UnaryExpression {
    type: "UnaryExpression";
    operator: "not";
    argument: Expression;
}
export interface StringLiteral {
    type: "StringLiteral";
    value: string;
}
export interface NumberLiteral {
    type: "NumberLiteral";
    value: number;
}

export interface Identifier {
    type: "Identifier";
    name: string;
}

export interface BinaryExpression {
    type: "BinaryExpression";
    operator: "+" | "-" | "*" | "/" | "==" | "<" | ">" | "and" | "or";
    left: Expression;
    right: Expression;
}

export type TypeAnnotation =
    | "string"
    | "number"
    | "boolean"
    | { kind: "array"; elementType: TypeAnnotation }; 