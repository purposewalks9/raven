export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
}

/**
 * Renders a diagnostic the way rustc/tsc do — a caret under the offending
 * column, source line included, so errors are legible without an editor
 * plugin. Good error messages are a bigger adoption lever than most
 * language features (see language/roadmap.md, Phase 1).
 */
export function formatDiagnostic(diag: Diagnostic, sourceLines: string[]): string {
  const lineText = sourceLines[diag.line - 1] ?? "";
  const caret = " ".repeat(Math.max(0, diag.column - 1)) + "^";
  return [
    `${diag.severity}: ${diag.message}`,
    `  --> ${diag.file}:${diag.line}:${diag.column}`,
    `   |`,
    `${String(diag.line).padStart(3)} | ${lineText}`,
    `   | ${caret}`,
  ].join("\n");
}

export class DiagnosticBag {
  private diagnostics: Diagnostic[] = [];

  add(diag: Diagnostic): void {
    this.diagnostics.push(diag);
  }

  get hasErrors(): boolean {
    return this.diagnostics.some((d) => d.severity === "error");
  }

  all(): readonly Diagnostic[] {
    return this.diagnostics;
  }
}
