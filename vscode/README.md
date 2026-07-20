# Nova VS Code Tooling

| Folder             | Purpose |
|---------------------|---------|
| `syntax/`            | TextMate grammar for `.nova`/`.nv` syntax highlighting |
| `language-server/`   | LSP server: diagnostics, go-to-definition, hover types (wraps `compiler/src`) |
| `extension/`         | The VS Code extension package that wires the above into the editor |

Not started yet — see `language/roadmap.md` Phase 4. The language server
should be a thin wrapper around `compiler/src/typechecker` + `diagnostics`,
reusing the exact same compiler the CLI uses so editor errors and build
errors never disagree.
