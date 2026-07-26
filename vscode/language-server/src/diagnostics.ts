import { Diagnostic as LspDiagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Diagnostic as RavenDiagnostic } from "@raven/compiler";

/**
 * @raven/compiler's Diagnostic carries a SourceLocation with absolute
 * character offsets (`start`/`end`) alongside 1-based line/column. LSP
 * wants a Range of 0-based {line, character} positions. Using
 * `document.positionAt(offset)` (rather than hand-converting line/column)
 * means this is correct even if a future compiler change touches how
 * line/column get computed — offsets are the one thing both sides agree
 * on unambiguously.
 */
export function toLspDiagnostics(diagnostics: RavenDiagnostic[], document: TextDocument): LspDiagnostic[] {
  return diagnostics.map(d => ({
    severity: d.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    range: {
      start: document.positionAt(d.location.start),
      end: document.positionAt(d.location.end),
    },
    message: d.hint ? `${d.message}\n${d.hint}` : d.message,
    source: "raven",
  }));
}
