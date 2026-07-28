import * as path from "node:path";
import type { ExtensionContext } from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {

const serverModule = context.asAbsolutePath(
    path.join("server", "server.cjs")
);
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
