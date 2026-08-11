# Raven's Type Intelligence Roadmap

**Status:** foundational design doc — read this before proposing new type syntax.
**Audience:** contributors working on `compiler/src/typechecker`, `compiler/src/ast`, the language server, or the docs site.

---

## 1. The one-sentence version

TypeScript gives developers a large toolbox (`interface`, `generics`, `keyof`,
`import type`, declaration files...) and expects them to pick the right tool
and use it correctly. **Raven's job is to solve the same underlying problems
inside the compiler, so the developer reaches for that toolbox far less
often.**

This is not "TypeScript with different keywords." It's a different split of
labor between the developer and the compiler:

```
TypeScript:  developer describes the types  →  compiler checks them
Raven:       developer describes the data   →  compiler derives the types
                                                  and checks them
```

Every design decision below is a consequence of that one sentence.

## 2. Why this doc exists

Raven already has the beginning of this: `model` + the `WorkspaceRegistry`
(`compiler/src/typechecker/registry.ts`) remove `export type` / `import type`
for cross-file shapes. That wasn't an accident — it's the first instance of
a general pattern:

> Find a place where TypeScript makes the *developer* carry information the
> *compiler* could derive on its own. Move that responsibility into Raven.

The rest of this document extends that pattern to the rest of the type
system, so new contributors don't have to reconstruct the reasoning from
scratch or accidentally pull Raven toward "TypeScript clone" by adding
declaration syntax before the inference underneath it exists.

## 3. Two categories, and why the order matters

Every TypeScript capability falls into one of two buckets:

**Category A — things a human has to tell the compiler.**
`interface`, `type`, `import`/`export` of types, explicit generic
annotations, `.d.ts` files, `@types` packages. For each of these, Raven's
question is: *can the compiler derive this instead of asking for it?*

**Category B — things the compiler needs internally to reason at all.**
Union representation, structural assignability, inference, narrowing,
generic substitution, control-flow analysis. These have to exist inside
Raven's type engine whether or not there's ever surface syntax for them.

**The mistake to avoid:** adding Category A syntax (`union`, `generic<T>`,
`interface`) before Category B machinery (a real assignability check, an
inference engine, flow analysis) exists to back it. That produces "lots of
type syntax, weak compiler intelligence" — syntax debt with nothing under
it. Build B first. A follows once B makes a piece of A genuinely
unnecessary, or reveals that a small bit of A is still required because the
information truly can't be derived.

## 4. Where Raven's type engine actually is today

Grounding this in the real code, not the abstract idea — as of this doc:

| Piece | Lives in | What it does now |
|---|---|---|
| Type representation | `ast/nodes.ts` (`TypeAnnotation`) | `string \| number \| boolean \| any \| array<T> \| record{...}` — a closed set, no unions/optionals yet |
| Structural equality | `typechecker/types.ts` (`sameType`) | Recursive structural comparison, used for both variable typing and model-shape conflicts |
| Shape diffing | `typechecker/types.ts` (`diffShapes`, `formatShapeDiff`) | Explains *why* two shapes conflict, field by field — this is the seed of "better error output," not just "type mismatch" |
| Local inference | `typechecker/checker.ts` | Infers `let`/`const` shapes from literals; no annotation needed for `let x = 20` |
| Cross-file shape resolution | `typechecker/registry.ts` (`WorkspaceRegistry`) | `model` publishes a shape project-wide; other files resolve it without an import — this *is* Zone 4 (project intelligence) already, just for one construct |
| Function signature resolution | `project/project.ts` | Statically scans function params/return types across files to resolve `import` without running the checker first |
| Diagnostics | `diagnostics/index.ts` | Has file/line/column/caret formatting already — the delivery mechanism for "better error output" exists; the *reasoning* behind the message needs to grow |

This table matters because it tells you **where to plug in**, not just what
to build. New inference work extends `checker.ts` + `types.ts`. New
cross-file intelligence extends `registry.ts` and `project.ts`. New
diagnostic quality work extends the message-construction call sites in
`checker.ts`, not `diagnostics/index.ts` itself (that part's fine).

## 5. The seven layers

This is the order to build in, not seven independent projects. Each layer
mostly depends on the ones above it existing first.

### Layer 1 — Program model
Raven already tracks files, scopes, and function signatures
(`symbolTable.ts`, `binder.ts`, `project.ts`). Extends here: giving the
`Binder` a full picture of every symbol's *origin* (declared locally,
resolved from a model, resolved from an import), not just its type — needed
before error messages can explain *how* a type was derived.

### Layer 2 — Type engine
The core of this roadmap. Extends `TypeAnnotation` beyond the current closed
set: optional (`T?`), union, and eventually generics — each added only once
`sameType`/inference can actually reason about it, not before. Also where a
real **assignability** check (`isAssignableTo`, distinct from the current
strict `sameType`) needs to exist, since TypeScript-style inference needs
"compatible with," not just "identical to."

### Layer 3 — Flow engine
Doesn't exist yet. This is what turns `x: number | string` plus
`if (typeof x == "string")` into `x: string` inside that branch. Needs a
control-flow-aware pass over `IfStatement`/`WhileStatement` bodies that
narrows the symbol table's view of a variable's type per-branch. Depends
entirely on Layer 2's union types existing first.

### Layer 4 — Project engine
`WorkspaceRegistry` is the prototype for this — extend the same pattern
(publish once, resolve everywhere, diff on conflict) to more than `model`:
function signatures, eventually whole inferred module shapes, so cross-file
reasoning doesn't stay a special case that only `model` gets.

### Layer 5 — Developer intelligence
The language server (`vscode/language-server`) should query the *same*
`Binder`/`TypeChecker` the compiler uses for hover, autocomplete, go-to-def
— not maintain a second, drifting understanding of the program. Anywhere
the language server currently guesses, it should be asking the compiler's
program model instead.

### Layer 6 — Library intelligence
Once Layers 2–4 are solid: a Raven package should be self-describing.
Instead of a hand-maintained `.d.ts`-equivalent, `raven build` on a library
packages the compiler's own resolved API model (the same structural types
`checker.ts` already derives) as the artifact consumers read. No second,
human-maintained description of the same shapes.

### Layer 7 — Backend ecosystem
Deliberately last, and deliberately backend-first rather than
frontend-first: HTTP, database, auth, queues, CLI, filesystem. This is
where `model X = api("/users")` / `model X = database.users` (already in
the parser — see `parser.ts:isExternalBinding`) grows from "trust the
developer's annotation" into "infer as much of the external shape as
possible, verify the rest at the boundary."

## 6. The four questions every new type feature should answer

Before adding anything to the type system, answer these in the PR
description:

1. **What problem does this solve** — not "what TypeScript syntax does this
   mirror," but what concrete Raven program becomes possible or safer.
2. **Can the compiler derive this instead of requiring syntax for it?** If
   yes, that's the actual feature — the syntax (if any) is a fallback for
   the ambiguous cases only.
3. **Which layer does this belong to**, per §5? If it needs Layer 3 (flow)
   and Layer 3 doesn't exist yet, that's a sign to build the dependency
   first, not to fake narrowing with a special case.
4. **What does the error message say when it's wrong?** Per §4, `diffShapes`
   already sets the bar: not "type mismatch" but *which* field, *what* was
   expected, and *where* the conflicting type came from. New checks should
   clear that bar too.

## 7. What this means for docs and contribution flow

- **`CONTRIBUTING.md`** currently points at `language/roadmap.md` and
  `language/specification.md`, which predate the Nova → Raven rename and
  don't exist in this repo layout. Update it to point here for type-system
  work, and to `compiler/tests/` (which already encodes the tokenize →
  parse → assert pattern) for the testing convention.
- **Docs site** (`website/raven-site`): every layer in §5 that ships should
  get a page that leads with the *problem it removes*, matching the
  README's existing style (`let` vs `model` explains the *removal* of
  `import type`, not the mechanics of `WorkspaceRegistry` first). Keep that
  pattern — problem first, mechanism second.
- **PRs that add type-system surface area** should link back to the
  relevant §5 layer and answer §6's four questions, so reviewers can tell
  "derived automatically" work apart from "asks for syntax" work at a
  glance.

## 8. What NOT to do yet

Explicitly out of scope until Layers 1–4 are solid:

- Generics/type parameters (needs real inference, not just structural
  equality)
- `keyof`, mapped/conditional types (needs a type introspection engine that
  doesn't exist)
- npm/JavaScript-library interop and `@types`-equivalent consumption
  (Layer 6 territory, and depends on Raven understanding *itself* well
  first — see the closing principle below)
- Frontend/DOM-facing work of any kind (deliberately Layer 7+, and
  backend-shaped Layer 7 first)

## 9. Closing principle

> Types should be derived whenever possible rather than declared manually.
> Explicit type information should exist primarily for genuine ambiguity
> and developer intent — not because the compiler is incapable of inference.

Every layer above is in service of that sentence. When in doubt about
whether a feature belongs in Raven, or belongs as compiler intelligence
versus developer-facing syntax, come back to it.
