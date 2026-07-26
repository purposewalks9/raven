import { Location } from "vscode-languageserver/node.js";
import type { DefinitionParams } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SourceLocation } from "@raven/compiler";
import { symbolAt } from "./symbolAt.js";

function toLspLocation(uri: string, loc: SourceLocation, document: TextDocument): Location {
  return {
    uri,
    range: {
      start: document.positionAt(loc.start),
      end: document.positionAt(loc.end),
    },
  };
}

export function onDefinition(document: TextDocument, params: DefinitionParams): Location | null {
  const binding = symbolAt(document, params.position);
  if (!binding) return null;

  // Single-file language for now, so the definition is always in the same
  // document. Once Raven gets imports/modules, this is the one place that
  // needs to change: resolve binding.declaration.file to a URI instead of
  // assuming `document.uri`.
  return toLspLocation(document.uri, binding.declaration, document);
}
