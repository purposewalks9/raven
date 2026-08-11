# Raven's Type Intelligence Roadmap

**Status:** foundational design doc — read this before proposing new type syntax.
**Audience:** contributors working on `compiler/src/typechecker`, `compiler/src/ast`, the language server, or the docs site.

## 1. The one-sentence version

TypeScript gives developers a large toolbox (`interface`, `generics`, `keyof`,
`import type`, declaration files...) and expects them to pick the right tool
and use it correctly. **Raven's job is to solve the same underlying problems
inside the compiler, so the developer reaches for that toolbox far less often.**

Raven is not replacing TypeScript as an implementation platform. Raven's compiler
is written in TypeScript and emits JavaScript for the TypeScript/JavaScript
ecosystem; the language design goal is to make the compiler derive more program
meaning from data and flow instead of asking developers to restate that meaning
as type declarations.

```text
TypeScript:  developer describes the types  →  compiler checks them
Raven:       developer describes the data   →  compiler derives the types
                                                  and checks them
```

## 2. Why this doc exists

Raven already has the beginning of this: `model` + the `WorkspaceRegistry`
(`compiler/src/typechecker/registry.ts`) remove `export type` / `import type`
for cross-file shapes. That is the first instance of a general pattern:

> Find a place where TypeScript makes the developer carry information the
> compiler could derive on its own. Move that responsibility into Raven.

New type work should therefore add compiler intelligence before adding syntax.
When syntax is unavoidable, it should be a small escape hatch for ambiguity or
intent — not a substitute for inference, assignability, flow analysis, and
project-wide resolution.

## 3. Two categories, and why the order matters

Every TypeScript capability falls into one of two buckets:

**Category A — things a human has to tell the compiler.**
`interface`, `type`, `import`/`export` of types, explicit generic annotations,
`.d.ts` files, `@types` packages. For each of these, Raven asks: can the
compiler derive this instead of asking for it?

**Category B — things the compiler needs internally to reason at all.**
Union representation, structural assignability, inference, narrowing, generic
substitution, control-flow analysis. These have to exist inside Raven's type
engine whether or not there is ever surface syntax for them.

**The mistake to avoid:** adding Category A syntax (`union`, `generic<T>`,
`interface`) before Category B machinery exists to back it. That produces lots
of type syntax with weak compiler intelligence. Build B first; A follows only
when B proves a bit of explicit syntax is still genuinely needed.

## 4. Where Raven's type engine is today

| Piece | Lives in | What it does now |
|---|---|---|
| Type representation | `compiler/src/ast/nodes.ts` (`TypeAnnotation`) | `string`, `number`, `boolean`, `any`, `array<T>`, and structural `record{...}` |
| Structural equality | `compiler/src/typechecker/types.ts` (`sameType`) | Recursive structural comparison for exact type identity |
| Assignability | `compiler/src/typechecker/types.ts` (`isAssignableTo`) | Compatibility check distinct from identity, ready for optionals/unions later |
| Shape diffing | `compiler/src/typechecker/types.ts` (`diffShapes`, `formatShapeDiff`) | Explains field-by-field model-shape conflicts |
| Local inference | `compiler/src/typechecker/checker.ts` | Infers `let`/`const`, arrays, records, expressions, and inferred function returns |
| Symbol origins | `compiler/src/typechecker/binder.ts`, `compiler/src/typechecker/symbolTable.ts` | Records whether a symbol was local, imported, built in, or resolved from a published model |
| Cross-file shape resolution | `compiler/src/typechecker/registry.ts` (`WorkspaceRegistry`) | Publishes model shapes project-wide without type imports |
| Function signature resolution | `compiler/src/project/project.ts` | Statically scans function params/return types across files to resolve imports |
| Diagnostics | `compiler/src/diagnostics/index.ts` | Has file/line/column/caret formatting; checker messages should keep adding better reasoning |

## 5. The seven layers

Build these in order. Each layer mostly depends on the ones above it.

### Layer 1 — Program model

Raven tracks files, scopes, function signatures, and now symbol origin. Keep
expanding the `Binder` and `SymbolTable` until every diagnostic can explain
where a type came from: declared locally, inferred from a value, resolved from a
model, resolved from an import, or supplied by a builtin.

### Layer 2 — Type engine

This is the core. Extend `TypeAnnotation` only when the engine can reason about
that extension. Optional fields, unions, and later generics should land with
matching `sameType`, `isAssignableTo`, inference, and diagnostics support.

### Layer 3 — Flow engine

Add control-flow-aware narrowing after unions exist. This is what turns a future
`x: number | string` plus a `typeof` check into a narrower type inside the true
branch and a different view in the false branch.

### Layer 4 — Project engine

Grow the `WorkspaceRegistry` pattern from models to richer project API shapes:
function signatures, inferred module boundaries, and eventually package-visible
compiler metadata.

### Layer 5 — Developer intelligence

The language server should query the same compiler model as `raven check` for
hover, autocomplete, diagnostics, and go-to-definition. Avoid a second parser or
type guesser in editor tooling.

### Layer 6 — Library intelligence

A Raven package should become self-describing by shipping the compiler's resolved
API model, not a hand-maintained `.d.ts` equivalent.

### Layer 7 — Backend ecosystem

Backend-shaped integrations come last: HTTP, database, auth, queues, CLI, and
filesystem. External models such as `model X = api("/users")` should move from
trusted annotations toward inferred and verified boundary shapes.

## 6. The four questions every new type feature should answer

1. **What problem does this solve?** Name the Raven program that becomes
   possible or safer.
2. **Can the compiler derive this instead of requiring syntax?** If yes, the
   derivation is the feature and syntax is only a fallback.
3. **Which layer does this belong to?** Build missing dependencies first.
4. **What does the error message say when it is wrong?** Explain expected,
   actual, and where the conflicting type came from.

## 7. What not to do yet

Until Layers 1–4 are solid, avoid generics/type parameters, `keyof`, mapped or
conditional types, npm/JavaScript library type consumption, and frontend/DOM work.
These are valuable later, but they need a stronger compiler model first.

## 8. Closing principle

> Types should be derived whenever possible rather than declared manually.
> Explicit type information should exist primarily for genuine ambiguity and
> developer intent — not because the compiler is incapable of inference.
