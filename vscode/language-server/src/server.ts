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
import { fileURLToPath } from "node:url";

import { setWorkspaceRoot, refreshWorkspace, getCheckResult, forget } from "./state.js";
import { toLspDiagnostics } from "./diagnostics.js";
import { onHover } from "./hover.js";
import { onDefinition } from "./definition.js";
import { onReferences } from "./references.js";

const connection = createConnection(ProposedFeatures.all);

process.on("uncaughtException", (err) => {
  connection.console.error(`Uncaught exception: ${err instanceof Error ? err.stack : String(err)}`);
});

const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const rootUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
  if (rootUri) setWorkspaceRoot(fileURLToPath(rootUri));

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
    },
  };
});

/**
 * The one place a project-wide check happens: run buildProject() over the
 * whole workspace, then push fresh diagnostics for every file it touched —
 * not just the one that was just edited, since a change in one file (e.g.
 * a model's shape) can invalidate diagnostics in every other file that
 * uses it. Called on open and on every change — see the listeners below.
 */
function validateWorkspace(): void {
  const result = refreshWorkspace();
  if (!result) return;

  const byFile = new Map<string, typeof result.diagnostics>();
  for (const diag of result.diagnostics) {
    if (!byFile.has(diag.file)) byFile.set(diag.file, []);
    byFile.get(diag.file)!.push(diag);
  }

  for (const file of result.files) {
    const uri = `file://${file.path}`;
    // Prefer the live in-editor buffer if this file is currently open —
    // buildProject read it from disk, which may be stale against unsaved
    // keystrokes. Falls back to a throwaway TextDocument built from the
    // on-disk source for files that aren't open right now.
    const document = documents.get(uri) ?? TextDocument.create(uri, "raven", 0, file.source);
    const fileDiagnostics = byFile.get(file.path) ?? [];
    connection.sendDiagnostics({
      uri,
      diagnostics: toLspDiagnostics(fileDiagnostics, document),
    });
  }
}

// NOTE: onDidChangeContent fires once on open too, so a separate onDidOpen
// listener would double-validate. One listener covers both cases.
documents.onDidChangeContent(() => validateWorkspace());
documents.onDidClose(event => forget(event.document.uri));

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