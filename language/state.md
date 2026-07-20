# Nova Compiler-Managed State (Draft v0.1)

## Model
`state x = expr` declares a reactive binding scoped to the enclosing
`page`/`component`. The compiler statically finds every read and write of
`x` within that scope and:

1. Wraps writes so dependent UI nodes are marked dirty.
2. Batches multiple synchronous writes in one action into a single
   re-render (see `login()` setting `loading = true` then later `false` —
   the compiler can see these are two separate scheduling points because
   an `await` sits between them, and batches within each sync segment).
3. Emits the minimal DOM-patch code for exactly the nodes that read `x`
   (no vdom diff needed for the common case — this is the "zero runtime
   overhead" claim in practice).

## Why not just "a hook"
A library-based signal/hook (`useState`, Zustand, signals) can't see the
whole call graph at compile time, so it always pays some runtime tracking
cost and can't prove batching/ordering the way a compiler pass can.

## Derived state
```nova
state items = []
derived total = items.reduce((sum, i) => sum + i.price, 0)
```
`derived` (planned) is recomputed only when its declared dependencies
change, memoized automatically — no dependency array to keep in sync by
hand (the classic `useMemo([...])` foot-gun).

## Cross-scope state (planned)
`store` (planned, `framework/state`) for state shared across pages —
compiles to a small pub/sub module rather than pulling in a
Redux/Zustand-shaped runtime.

## Compiler passes involved
- `typechecker`: resolves every `bind X` / `X = ...` to a declared `state`.
- `optimizer`: builds the read/write dependency graph, computes minimal
  update sets per state variable.
- `emitter`: generates the patch functions + the batching wrapper around
  actions.
