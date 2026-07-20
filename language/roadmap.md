# Nova Roadmap (Draft v0.1)

## Phase 0 — Foundations (current)
- [x] Repo scaffold, workspace config
- [x] Draft grammar covering `page`/`state`/`action`/UI-node syntax
- [ ] Lexer: tokenize the full example grammar (in progress, `compiler/src/lexer`)
- [ ] Parser: recursive-descent producing the AST in `compiler/src/ast`
- [ ] Minimal emitter: `page` → a single React (or framework-agnostic DOM) component, no typechecking yet
- [ ] `nova compile <file>` CLI round-trips `examples/hello-world`

## Phase 1 — Type system
- [ ] Local inference for `state`/`let`
- [ ] `interface`/`type`/`enum` + exhaustive `match`
- [ ] Diagnostics with source spans (`compiler/src/diagnostics`) — this is
      worth investing in early; good error messages are a bigger adoption
      driver than most language features.

## Phase 2 — State & concurrency runtime
- [ ] Dependency-graph-based patch generation for `state`
- [ ] `task group` / `spawn` / `race` / `timeout` lowering to `AbortController`
- [ ] `derived` values

## Phase 3 — Full-stack boundary
- [ ] `server action` → RPC codegen (client stub + server handler)
- [ ] File-based route discovery across `src/pages/**`
- [ ] Auth/DB framework packages (`framework/auth`, `framework/database`)

## Phase 4 — Tooling
- [ ] VS Code syntax highlighting (`vscode/syntax`)
- [ ] Language server: go-to-def, hover types, diagnostics (`vscode/language-server`)
- [ ] `@nova/testing` package

## Phase 5 — Ecosystem
- [ ] `@nova/ui` baseline component set matching the example (`card`,
      `input`, `button`, `socialButton`, etc.)
- [ ] Docs site (`website/`), example apps (`examples/todo`, `blog`, ...)

## Open design questions to resolve before Phase 1 locks in
- Contextual keywords vs. fully reserved (see `keywords.md`)
- `?`-based error propagation syntax for `Result<T, E>`
- Whether UI node prop syntax needs commas (`spacing 24` vs `spacing: 24,`) —
  current grammar is comma-free / newline-or-semicolon-separated, confirm
  this scales to nested conditional children before locking the grammar.
