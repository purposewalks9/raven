export enum TokenKind {
  Identifier = "Identifier",
  Keyword = "Keyword",
  StringLiteral = "StringLiteral",
  NumberLiteral = "NumberLiteral",
  Punctuation = "Punctuation",
  Operator = "Operator",
  EOF = "EOF",
}

export const KEYWORDS = new Set([
  "page", "component", "import", "from", "export",
  "type", "enum", "interface",
  "state", "action", "server", "client", "shared", "async", "await",
  "if", "else", "match", "for", "while", "return", "break", "continue",
  "spawn", "task", "race", "all", "timeout", "cancel",
  "try", "catch", "throws", "Result", "Ok", "Err", "Option", "Some", "None",
  "true", "false", "null", "void", "never", "any", "unknown",
  "let", "const",
]);

// Longest-match-first matters here — e.g. "->" before "-".
export const OPERATORS = [
  "->", "=>", "==", "!=", "<=", ">=", "&&", "||", "+=", "-=",
  "=", "+", "-", "*", "/", "%", "<", ">", "!", "?",
];

export const PUNCTUATION = new Set([
  "{", "}", "(", ")", "[", "]", ",", ".", ";", ":",
]);

export interface SourceSpan {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface Token {
  kind: TokenKind;
  value: string;
  span: SourceSpan;
}
