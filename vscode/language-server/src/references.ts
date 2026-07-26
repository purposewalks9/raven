import { Location } from "vscode-languageserver/node.js";
import type { ReferenceParams } from "vscode-languageserver/node.js";
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

export function onReferences(document: TextDocument, params: ReferenceParams): Location[] {
  const binding = symbolAt(document, params.position);
  if (!binding) return [];

  const locations = params.context.includeDeclaration
    ? [binding.declaration, ...binding.references]
    : binding.references;

  return locations.map(loc => toLspLocation(document.uri, loc, document));
}
