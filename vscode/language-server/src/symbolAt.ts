import type { Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SymbolBinding } from "@raven/compiler";
import { getCheckResult } from "./state.js";

/**
 * The one query every "editor intelligence" feature is built on: given a
 * document and a cursor position, what symbol is there? Converts LSP's
 * {line, character} to the absolute offset the Binder speaks in, then
 * delegates to binder.bindingAt() — the same method proven in Milestone 1.
 */
export function symbolAt(document: TextDocument, position: Position): SymbolBinding | undefined {
  const result = getCheckResult(document.uri);
  if (!result) return undefined;

  const offset = document.offsetAt(position);
  return result.binder.bindingAt(offset);
}
