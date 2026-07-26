#!/usr/bin/env node
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

import { refresh, getCheckResult, forget } from "./state.js";
import { toLspDiagnostics } from "./diagnostics.js";
import { onHover } from "./hover.js";
import { onDefinition } from "./definition.js";
import { onReferences } from "./references.js";

// stdio is how VS Code talks to a language server subprocess: the
// extension spawns `node dist/server.js`, then sends/receives LSP
// JSON-RPC messages over its stdin/stdout. ProposedFeatures.all just
// opts into the full current LSP feature set (safe — VS Code's client
// ignores anything it doesn't ask for).
const connection = createConnection(ProposedFeatures.all);

// TextDocuments manages open-editor state for us: it listens on the
// connection for didOpen/didChange/didClose and hands us a ready-to-use
// TextDocument (with .getText()/.positionAt()/.offsetAt()) instead of us
// tracking raw text edits ourselves.
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      // Full: re-send the whole document text on every change. Simplest
      // option and plenty fast for how small a Raven file is; incremental
      // sync is a later optimization, not a Milestone 2 concern.
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
    },
  };
});

/**
 * The one place a document gets (re-)checked: run the compiler, cache the
 * result, and push fresh diagnostics to the editor. Called on open and on
 * every change — see the listeners below.
 */
function validate(document: TextDocument): void {
  const result = refresh(document);
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: toLspDiagnostics(result.diagnostics, document),
  });
}

// NOTE: onDidChangeContent already fires once when a document is opened
// (not just on edits), so a separate onDidOpen listener here would
// validate every file twice. One listener covers both cases.
documents.onDidChangeContent(event => validate(event.document));
documents.onDidClose(event => {
  forget(event.document.uri);
  // Clear diagnostics so closing a broken file doesn't leave stale red
  // squiggles behind if it's reopened read-only elsewhere.
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onHover(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return null;
  return onHover(document, params);
});

connection.onDefinition(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return null;
  return onDefinition(document, params);
});

connection.onReferences(params => {
  const document = documents.get(params.textDocument.uri);
  if (!document || !getCheckResult(document.uri)) return [];
  return onReferences(document, params);
});

documents.listen(connection);
connection.listen();
