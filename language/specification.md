# Nova Language Specification (Draft v0.1)

This document is the entry point into Nova's design. It links out to the
focused specs. Treat this as living documentation — update it as the
compiler's actual behavior diverges from (or clarifies) the design.

## Compilation model

A `.nova` file compiles to one or more JS modules:

1. **Parse** → AST (`compiler/src/parser`, `compiler/src/ast`)
2. **Typecheck** → annotated AST + diagnostics (`compiler/src/typechecker`)
3. **Boundary analysis** → split nodes into `server` / `client` / `shared` graphs
   (this is what powers first-class full-stack — see `modules.md`)
4. **Optimize** → dead-code elimination, state-mutation batching, inlining (`compiler/src/optimizer`)
5. **Emit** → JS (+ `.d.ts`, source maps) per target (`compiler/src/emitter`)

## File kinds

| Extension     | Purpose                                   |
|---------------|--------------------------------------------|
| `.nova`       | UI pages/components (declarative, like the `page "/login" { ... }` example) |
| `.nv`         | Plain logic modules (functions, types, no UI) |
| `.nova.server`| Server-only modules (DB access, secrets)   |

## Top-level constructs

- `page "<route>" { ... }` — a routed page; compiles to a client component + (optionally) a server loader.
- `component Name { ... }` — a reusable UI unit.
- `server action name(...) { ... }` — server-only function callable from the client via generated RPC.
- `state name = expr` — compiler-managed reactive binding, scoped to its enclosing page/component.
- `type`, `enum`, `interface` — see `type-system.md`.

## Design principles

1. **Explicit over implicit** — boundaries (server/client), error paths, and state
   mutations should be visible in source, not inferred from folder conventions.
2. **Compile-time > run-time** — push checks and wiring into the compiler so the
   shipped JS has as little framework glue as possible.
3. **Escape hatches everywhere** — anything expressible in JS/TS should remain
   reachable from Nova (`js { ... }` interop blocks, typed FFI to npm packages).

See: `grammar.ebnf`, `syntax.md`, `type-system.md`, `concurrency.md`, `state.md`,
`modules.md`, `keywords.md`, `roadmap.md`.
