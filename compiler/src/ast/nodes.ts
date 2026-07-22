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
    typeAnnotation?: TypeAnnotation;   // NEW — optional, since `val x = "hi"` has none
}
export interface ConstantDeclaration {
    type: "ConstantDeclaration";
    name: string;
    value: Expression;
    typeAnnotation?: TypeAnnotation; 
}

export type Expression =
    | StringLiteral
    | Identifier;

export interface StringLiteral {
    type: "StringLiteral";
    value: string;
}

export interface Identifier {
    type: "Identifier";
    name: string;
}

export type TypeAnnotation =
    | "string";