# Raven architecture

Raven is organized around one compiler core shared by every host.

```text
crates/raven-core  →  raven-node  →  compiler CLI and public API
                  ↘ raven-lsp    →  VS Code extension
                  ↘ raven-wasm   →  browser playground (Phase 5)
```

`raven-core` owns language semantics. It has no Node, WASM, editor, or filesystem dependency. Add lexer, parser, checker, optimizer, emitter, source-map, and diagnostic behavior there first.

`raven-node` is the napi-rs boundary used by `compiler/src`. Keep `@raven/compiler` stable; the CLI owns arguments, file discovery, and watch mode.

`raven-lsp` is a stdio `tower-lsp` server that uses `raven-core` directly. The VS Code extension packages the `raven-lsp` executable and starts it through the Language Client protocol.

## Change checklist

- Parser or type-system change: update `raven-core` tests and language docs.
- Diagnostic change: keep source locations and diagnostic codes stable where possible.
- Node binding change: document the FFI API and add an integration test through the real binding.
- LSP change: preserve LSP ranges as zero-based positions and build `vscode/extension`.
- Performance-sensitive change: run `pnpm bench` and commit the generated report when required by `AGENTS.md`.
