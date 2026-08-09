import * as vscode from "vscode";
import * as path from "node:path";
import type { ExtensionContext } from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

const DECORATIONS: Record<string, { badge: string; color: vscode.ThemeColor; tooltip: string }> = {
  ".rv": { badge: "RV", color: new vscode.ThemeColor("raven.badgeColor"), tooltip: "Raven source file" },
};

class RavenFileDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const ext = path.extname(uri.fsPath);
    const match = DECORATIONS[ext];
    if (!match) return undefined;
    return {
      badge: match.badge,
      color: match.color,
      tooltip: match.tooltip,
    };
  }
}

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new RavenFileDecorationProvider())
  );

  const serverModule = context.asAbsolutePath(path.join("server", "server.cjs"));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "raven" }],
  };

  client = new LanguageClient(
    "ravenLanguageServer",
    "Raven Language Server",
    serverOptions,
    clientOptions
  );

  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}