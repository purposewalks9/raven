# Contributing to Raven

Thanks for helping build Raven. Language semantics live in Rust; the public compiler API and CLI stay TypeScript.

## Start here

1. Read the [README](./README.md).
2. Read [the architecture guide](./docs/contributing/architecture.md).
3. Choose a focused issue or open one before changing language semantics.

## Local setup

Raven needs Node 20+ with pnpm and a current Rust toolchain.

```bash
git clone <your-fork-url>
cd raven
pnpm install
cd crates/raven-node && npm install && npm run build
cd ../..
pnpm test
cargo test --manifest-path crates/Cargo.toml --workspace
```

## Where changes belong

| Area | Location |
|---|---|
| Language semantics | `crates/raven-core/` |
| Node binding | `crates/raven-node/` |
| Language server | `crates/raven-lsp/` |
| Public API and CLI | `compiler/src/` |
| VS Code client | `vscode/extension/` |
| Docs and examples | `docs/`, `examples/`, `website/` |

## Before opening a pull request

```bash
pnpm --filter @raven/compiler test
pnpm --filter @raven/compiler run build
cargo fmt --manifest-path crates/Cargo.toml --check
cargo clippy --manifest-path crates/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path crates/Cargo.toml --workspace
```

For `crates/raven-lsp` or `vscode/extension` changes, also run:

```bash
pnpm --dir vscode/extension run build
```

Keep pull requests focused, include tests for changed behavior, and update documentation whenever syntax or diagnostics change. Use conventional-style subjects such as `feat(lsp): add workspace diagnostics`.

## Code of conduct

Be direct about technical disagreements and kind to people. Harassment and personal attacks are not tolerated.
