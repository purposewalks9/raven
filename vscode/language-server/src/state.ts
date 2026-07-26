// This file is the bridge between "a document VS Code is showing me" and
// "what @raven/compiler thinks about it." Every LSP feature (diagnostics,
// hover, go-to-definition, references) starts by asking this module for
// the last CheckResult for a document — never by calling checkSource()
// itself. That keeps "when do we re-check" in exactly one place.
import type { TextDocument } from "vscode-languageserver-textdocument";
import { checkSource, type CheckResult } from "@raven/compiler";

const documentChecks = new Map<string, CheckResult>();

/**
 * Re-runs the compiler against a document's current (possibly unsaved)
 * text and caches the result under its URI. Call this from didOpen and
 * didChange — i.e. whenever VS Code tells us the text changed.
 */
export function refresh(document: TextDocument): CheckResult {
  const result = checkSource(document.getText(), document.uri);
  documentChecks.set(document.uri, result);
  return result;
}

export function getCheckResult(uri: string): CheckResult | undefined {
  return documentChecks.get(uri);
}

export function forget(uri: string): void {
  documentChecks.delete(uri);
}
