import type { SourceLocation } from "../ast/index.js";

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  location: SourceLocation;
  hint?: string;
}

export class DiagnosticBag {
  private diagnostics: Diagnostic[] = [];

  error(message: string, location: SourceLocation, hint?: string): void {
    this.diagnostics.push(hint ? { severity: "error", message, location, hint } : { severity: "error", message, location });
  }

  warning(message: string, location: SourceLocation, hint?: string): void {
    this.diagnostics.push(hint ? { severity: "warning", message, location, hint } : { severity: "warning", message, location });
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
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

export function formatDiagnostic(diagnostic: Diagnostic, source?: string, useColor = false): string {
  const { location } = diagnostic;
  const c = useColor
    ? COLOR
    : { red: (s: string) => s, yellow: (s: string) => s, cyan: (s: string) => s, dim: (s: string) => s, bold: (s: string) => s };

  const severityColor = diagnostic.severity === "error" ? c.red : c.yellow;
  const header = `${c.bold(severityColor(diagnostic.severity))}: ${diagnostic.message}`;
  const pointer = c.dim(` --> ${location.file}:${location.line}:${location.column}`);
  const lines = [header, pointer];

  if (source) {
    const sourceLine = source.split(/\r?\n/)[location.line - 1] ?? "";
    const width = Math.max(1, location.end - location.start);
    lines.push(`${location.line} | ${sourceLine}`);
    lines.push(`${" ".repeat(String(location.line).length)} | ${" ".repeat(Math.max(0, location.column - 1))}${severityColor("^".repeat(width))}`);
  }

  if (diagnostic.hint) lines.push(c.cyan(`Hint: ${diagnostic.hint}`));
  return lines.join("\n");
}
