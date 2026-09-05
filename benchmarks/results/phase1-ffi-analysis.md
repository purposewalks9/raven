# Phase 1 — FFI marshalling analysis

Date: 2026-09-05

The Phase-1 port routes every `check` through `raven-node`: the TypeScript
wrapper `JSON.stringify`s the parsed AST, napi passes it to Rust, `raven-core`
re-parses it with serde_json, typechecks, builds the full
diagnostics + bindings + exported-types JSON object, serializes it back, and
the wrapper `JSON.parse`s the result.

Reading `benchmarks/results/2026-09-05.md`: the `check` stage went from
15.59 µs → 501.49 µs (small), 466.27 µs → 15.52 ms (medium) and the workspace
`check (buildProject)` from ~16 ms → ~230 ms per op. Before concluding the
port is a regression, we split the per-call cost inside `raven-core` (release
build, warm, averaged over 20 calls of the exact FFI code path, fixture ASTs
already materialized in-process):

| phase | `hello.rv` (15 lines) | `work.rv` (407 lines) |
|---|---|---|
| serde_json parse of AST | 259 µs | 3 662 µs |
| typecheck (engine) | 29 µs | 934 µs |
| bindings → JSON `Value` | 91 µs | 3 050 µs |
| result `to_string` | 113 µs | 3 115 µs |
| **total** | **494 µs** | **10 762 µs** |

And the same engine in isolation (TypeScript, Phase-0 baseline) was 15.59 µs
(small) / 466.27 µs (medium). Conclusion:

- The **checker engine itself is not the problem** — 29 µs / 934 µs is the same
  order as the old TS implementation, in a release build, before any
  marshalling.
- ~91% of the medium-file cost and ~49% of the small-file cost is
  **serialization**: re-parsing the untouched JSON AST (serde_json), building
  the bindings `Value` graph, and re-serializing the 53–63 KB result for
  `JSON.parse` on the JS side. All three are pure overhead the TS checker
  never paid (it evaluated the AST object graph directly).

This is the outcome SYSTEM_DESIGN.md §5 Phase 1 predicts and explicitly
provisions for:

> "Start with `serde_json` for simplicity; **only move to a binary format
> (`bincode`, flatbuffers) if Phase-1 benchmarks show serialization itself is
> a cost.**"

The benchmarks now show exactly that. Two design-consistent ways to remove it:

1. **Phase 2 deletes the boundary entirely.** Port lemon/parser into
   `raven-core` so the FFI contract becomes *source text in → typed AST +
   diagnostics out*; the untyped AST stops crossing the boundary in either
   direction and both halves of this figure disappear.
2. If the hybrid single-file path must stay fast before Phase 2 lands, adopt a
   **binary wire format** (`bincode`) for AST in / result out, which
   eliminates the serde_json parse + re-serialize legs of the table.

Both are follow-ups; Phase 1 itself is the parity + architecture gate that
makes this measurement possible.