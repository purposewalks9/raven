import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["cjs"],
  clean: true,
  // Bundle every runtime dependency the server needs so the built
  // server.cjs is fully self-contained — no node_modules required
  // at all when it's packaged into the .vsix and installed on a
  // user's machine.
  noExternal: [
    "@raven/compiler",
    "vscode-languageserver",
    "vscode-languageserver-textdocument",
  ],
});