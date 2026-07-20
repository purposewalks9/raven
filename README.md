# Nova

Nova is a statically typed programming language for the JavaScript ecosystem
that compiles to highly optimized JavaScript. It extends the web platform
with language-level features for concurrency, state management, full-stack
development, and developer productivity — while staying fully compatible
with the existing JS/TS ecosystem.

Unlike TypeScript, which layers a type system on top of JavaScript, Nova
rethinks the language itself: structured concurrency, compiler-managed
state, explicit server/client boundaries, modern error handling, and a
simpler module system are first-class parts of the language, not framework
conventions bolted on afterward.

## Core innovations

- **Structured concurrency** — safe, coordinated async execution built into the language.
- **Compiler-managed state** — the compiler tracks mutation and reactivity instead of a runtime library (Redux/Zustand/signals) doing it.
- **First-class full-stack** — server code, client code, routes, APIs, and server actions are language constructs; the compiler generates the JS wiring.
- **Simple module system** — no bundler config maze, no barrel-file gymnastics.
- **Modern error handling** — explicit, type-safe failure paths instead of unchecked `throw`.
- **Sound static types** — inference, generics, exhaustive pattern matching, null safety.
- **Zero runtime overhead** — compiles to plain, efficient JS wherever possible.
- **JS ecosystem compatible** — import existing npm/TS packages directly.

## Monorepo layout

```
nova/
├── compiler/        # lexer → parser → ast → typechecker → optimizer → emitter, CLI
├── language/         # spec, grammar, syntax & semantics docs
├── framework/        # router, ui, server, auth, database, state, forms runtime
├── packages/          @nova/* published packages
├── vscode/            syntax highlighting + language server + extension
├── docs/              user-facing documentation site content
├── examples/          hello-world, todo, blog, ecommerce, social-app
├── tests/             cross-package/integration tests
└── website/           nova-lang.dev marketing site
```

## Getting started

```bash
pnpm install
pnpm build          # builds compiler + packages
pnpm compile examples/hello-world/src/pages/login.nova
```

See `language/roadmap.md` for where things stand and what's next.
