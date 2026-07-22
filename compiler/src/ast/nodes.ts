export interface Program {
    type: "Program";
    body: Statement[];
}



export type Statement =
    | PrintStatement
    | VariableDeclaration
    | ConstantDeclaration;

export interface PrintStatement {
    type: "PrintStatement";
    argument: Expression;
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
    | Identifier
    | BinaryExpression;

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
    operator: "+" | "-" | "*" | "/" | "==" | "<" | ">";
    left: Expression;
    right: Expression;
}

export type TypeAnnotation =
    | "string"
    | "boolean"
    | "number";