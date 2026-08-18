import type { SourceLocation } from "../ast/index.js";


export interface DiagnosticSuggestion {
  message: string;
  replacement?: string;
  location?: SourceLocation;
}

export interface Diagnostic {
  /** Stable, greppable identifier for this diagnostic kind, e.g. "RAV2002". See CODES below. */
  code: string;
  severity: "error" | "warning";
  message: string;
  location: SourceLocation;
  hint?: string;
  suggestions?: DiagnosticSuggestion[];
}

export interface DiagnosticOptions {
  hint?: string;
  suggestions?: DiagnosticSuggestion[];
}


export const CODES = {
  DUPLICATE_DECLARATION: "RAV1001",
  DUPLICATE_FUNCTION: "RAV1002",
  DUPLICATE_PARAMETER: "RAV1003",

  RETURN_TYPE_MISMATCH: "RAV2001",
  DECLARATION_TYPE_MISMATCH: "RAV2002",
  MODEL_TYPE_MISMATCH: "RAV2003",
  ASSIGNMENT_TYPE_MISMATCH: "RAV2004",
  ARGUMENT_TYPE_MISMATCH: "RAV2005",

  INVALID_IMPORT_TARGET: "RAV3001",
  UNRESOLVED_IMPORT: "RAV3002",
  UNDECLARED_VARIABLE: "RAV3003",
  UNDECLARED_FUNCTION: "RAV3004",

  READONLY_MODEL_REASSIGNMENT: "RAV4001",
  UNDECLARED_ASSIGNMENT_TARGET: "RAV4002",
  CONST_REASSIGNMENT: "RAV4003",

  NON_BOOLEAN_CONDITION: "RAV5001",
  INVALID_UNARY_OPERAND: "RAV5002",
  INVALID_LOGICAL_OPERANDS: "RAV5003",
  INCOMPARABLE_TYPES: "RAV5004",
  INVALID_PLUS_OPERANDS: "RAV5005",
  INVALID_ARITHMETIC_OPERANDS: "RAV5006",

  UNKNOWN_PROPERTY: "RAV6001",
  INVALID_PROPERTY_ACCESS: "RAV6002",
  INVALID_INDEX_TYPE: "RAV6003",
  INVALID_INDEX_TARGET: "RAV6004",
  TUPLE_INDEX_OUT_OF_BOUNDS: "RAV6005",
  
  RECURSIVE_MODEL_CYCLE: "RECURSIVE_MODEL_CYCLE",
  ARGUMENT_COUNT_MISMATCH: "RAV7001",

  MODEL_REGISTRY_CONFLICT: "RAV8001",

  PARSE_ERROR: "RAV9001",
} as const;

export class DiagnosticBag {
  private diagnostics: Diagnostic[] = [];

  error(code: string, message: string, location: SourceLocation, options: DiagnosticOptions = {}): void {
    this.push("error", code, message, location, options);
  }

  warning(code: string, message: string, location: SourceLocation, options: DiagnosticOptions = {}): void {
    this.push("warning", code, message, location, options);
  }

  private push(severity: "error" | "warning", code: string, message: string, location: SourceLocation, options: DiagnosticOptions): void {
    const diagnostic: Diagnostic = { code, severity, message, location };
    if (options.hint) diagnostic.hint = options.hint;
    if (options.suggestions?.length) diagnostic.suggestions = options.suggestions;
    this.diagnostics.push(diagnostic);
  }

  all(): Diagnostic[] {
    return [...this.diagnostics];
  }

  hasErrors(): boolean {
    return this.diagnostics.some(diagnostic => diagnostic.severity === "error");
  }
}

const COLOR = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

export function formatDiagnostic(diagnostic: Diagnostic, source?: string, useColor = false): string {
  const { location } = diagnostic;
  const c = useColor
    ? COLOR
    : { red: (s: string) => s, yellow: (s: string) => s, cyan: (s: string) => s, green: (s: string) => s, dim: (s: string) => s, bold: (s: string) => s };

  const severityColor = diagnostic.severity === "error" ? c.red : c.yellow;
  const header = `${c.bold(severityColor(diagnostic.severity))}${c.dim(`[${diagnostic.code}]`)}: ${diagnostic.message}`;
  const pointer = c.dim(` --> ${location.file}:${location.line}:${location.column}`);
  const lines = [header, pointer];

  if (source) {
    const sourceLine = source.split(/\r?\n/)[location.line - 1] ?? "";
    const width = Math.max(1, location.end - location.start);
    lines.push(`${location.line} | ${sourceLine}`);
    lines.push(`${" ".repeat(String(location.line).length)} | ${" ".repeat(Math.max(0, location.column - 1))}${severityColor("^".repeat(width))}`);
  }

  if (diagnostic.hint) lines.push(c.cyan(`Hint: ${diagnostic.hint}`));

  for (const suggestion of diagnostic.suggestions ?? []) {
    const where = suggestion.location ?? location;
    const fix = suggestion.replacement !== undefined
      ? ` ${c.dim(`(${where.line}:${where.column} -> '${suggestion.replacement}')`)}`
      : "";
    lines.push(c.green(`Suggestion: ${suggestion.message}${fix}`));
  }

  return lines.join("\n");
}

export function diagnosticsToJSON(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}