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

export function formatDiagnostic(diagnostic: Diagnostic, source?: string): string {
  const { location } = diagnostic;
  const header = `${diagnostic.severity}: ${diagnostic.message}`;
  const pointer = ` --> ${location.file}:${location.line}:${location.column}`;
  const lines = [header, pointer];

  if (source) {
    const sourceLine = source.split(/\r?\n/)[location.line - 1] ?? "";
    const width = Math.max(1, location.end - location.start);
    lines.push(`${location.line} | ${sourceLine}`);
    lines.push(`${" ".repeat(String(location.line).length)} | ${" ".repeat(Math.max(0, location.column - 1))}${"^".repeat(width)}`);
  }

  if (diagnostic.hint) lines.push(`Hint: ${diagnostic.hint}`);
  return lines.join("\n");
}
