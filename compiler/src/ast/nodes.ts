export interface Program {
    type: "Program";
    body: Statement[];
}

export type Statement =
    | PrintStatement;

export interface PrintStatement {
    type: "PrintStatement";
    argument: Expression;
}

export type Expression =
    | StringLiteral;

export interface StringLiteral {
    type: "StringLiteral";
    value: string;
}