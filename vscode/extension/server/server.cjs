#!/usr/bin/env node
"use strict";

// src/server.ts
var import_node3 = require("vscode-languageserver/node.js");
var import_vscode_languageserver_textdocument = require("vscode-languageserver-textdocument");

// src/state.ts
var import_compiler = require("@raven/compiler");
var documentChecks = /* @__PURE__ */ new Map();
function refresh(document) {
  const result = (0, import_compiler.checkSource)(document.getText(), document.uri);
  documentChecks.set(document.uri, result);
  return result;
}
function getCheckResult(uri) {
  return documentChecks.get(uri);
}
function forget(uri) {
  documentChecks.delete(uri);
}

// src/diagnostics.ts
var import_node = require("vscode-languageserver/node.js");
function toLspDiagnostics(diagnostics, document) {
  return diagnostics.map((d) => ({
    severity: d.severity === "error" ? import_node.DiagnosticSeverity.Error : import_node.DiagnosticSeverity.Warning,
    range: {
      start: document.positionAt(d.location.start),
      end: document.positionAt(d.location.end)
    },
    message: d.hint ? `${d.message}
${d.hint}` : d.message,
    source: "raven"
  }));
}

// src/hover.ts
var import_node2 = require("vscode-languageserver/node.js");

// src/symbolAt.ts
function symbolAt(document, position) {
  const result = getCheckResult(document.uri);
  if (!result) return void 0;
  const offset = document.offsetAt(position);
  return result.binder.bindingAt(offset);
}

// src/hover.ts
function formatType(type) {
  if (type === "any") return "any";
  if (typeof type === "string") return type;
  return `${formatType(type.elementType)}[]`;
}
function onHover(document, params) {
  const binding = symbolAt(document, params.position);
  if (!binding) return null;
  const keyword = binding.kind === "constant" ? "const" : binding.kind === "parameter" ? "param" : binding.kind === "function" ? "fn" : "let";
  const signature = binding.kind === "function" ? `fn ${binding.name}(...): ${formatType(binding.type)}` : `${keyword} ${binding.name}: ${formatType(binding.type)}`;
  return {
    contents: {
      kind: import_node2.MarkupKind.Markdown,
      value: `\`\`\`raven
${signature}
\`\`\``
    }
  };
}

// src/definition.ts
function toLspLocation(uri, loc, document) {
  return {
    uri,
    range: {
      start: document.positionAt(loc.start),
      end: document.positionAt(loc.end)
    }
  };
}
function onDefinition(document, params) {
  const binding = symbolAt(document, params.position);
  if (!binding) return null;
  return toLspLocation(document.uri, binding.declaration, document);
}

// src/references.ts
function toLspLocation2(uri, loc, document) {
  return {
    uri,
    range: {
      start: document.positionAt(loc.start),
      end: document.positionAt(loc.end)
    }
  };
}
function onReferences(document, params) {
  const binding = symbolAt(document, params.position);
  if (!binding) return [];
  const locations = params.context.includeDeclaration ? [binding.declaration, ...binding.references] : binding.references;
  return locations.map((loc) => toLspLocation2(document.uri, loc, document));
}

// src/server.ts
var connection = (0, import_node3.createConnection)(import_node3.ProposedFeatures.all);
var documents = new import_node3.TextDocuments(import_vscode_languageserver_textdocument.TextDocument);
connection.onInitialize((_params) => {
  return {
    capabilities: {
      // Full: re-send the whole document text on every change. Simplest
      // option and plenty fast for how small a Raven file is; incremental
      // sync is a later optimization, not a Milestone 2 concern.
      textDocumentSync: import_node3.TextDocumentSyncKind.Full,
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true
    }
  };
});
function validate(document) {
  const result = refresh(document);
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: toLspDiagnostics(result.diagnostics, document)
  });
}
documents.onDidChangeContent((event) => validate(event.document));
documents.onDidClose((event) => {
  forget(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return null;
  return onHover(document, params);
});
connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return null;
  return onDefinition(document, params);
});
connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return [];
  return onReferences(document, params);
});
documents.listen(connection);
connection.listen();
