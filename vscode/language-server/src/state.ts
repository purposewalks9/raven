import type { TextDocument } from "vscode-languageserver-textdocument";
import { buildProject, type ProjectResult, type Diagnostic } from "@raven/compiler";
import { fileURLToPath } from "node:url";

export interface CheckResult {
  source: string;
  diagnostics: Diagnostic[];
  binder: import("@raven/compiler").Binder;
}

let workspaceRoot: string | undefined;
let lastResult: ProjectResult | undefined;

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

function toFsPath(uri: string): string {
  return uri.startsWith("file://") ? fileURLToPath(uri) : uri;
}

export function refreshWorkspace(): ProjectResult | undefined {
  if (!workspaceRoot) return undefined;
  try {
    lastResult = buildProject(workspaceRoot);
  } catch (err) {
    console.error("buildProject threw:", err);
  }
  return lastResult;
}

export function refresh(document: TextDocument): CheckResult | undefined {
  refreshWorkspace();
  return getCheckResult(document.uri);
}

export function getCheckResult(uri: string): CheckResult | undefined {
  if (!lastResult) return undefined;
  const path = toFsPath(uri);
  const file = lastResult.files.find(f => f.path === path);
  if (!file || !file.binder) return undefined;
  const diagnostics = lastResult.diagnostics.filter(d => d.file === path);
  return { source: file.source, diagnostics, binder: file.binder };
}

export function getLastResult(): ProjectResult | undefined {
  return lastResult;
}

export function forget(_uri: string): void {
  
}