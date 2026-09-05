# Raven — Project Rules

These rules apply to anyone (human or AI) implementing the performance
rewrite described in `SYSTEM_DESIGN.md`. If you're using Claude Code, drop
this file at the repo root as `CLAUDE.md` — it will be read automatically.

## 0. The one hard rule

**No Rust code is written until `benchmarks/results/` contains at least one
committed report from `benchmarks/run.ts`.** If asked to "port the
typechecker to Rust" before that exists, build the benchmark harness first
and report the numbers before writing any `.rs` file. This is the whole
point of the plan — do not skip it because it feels slower to start.

## 1. Phase discipline

- Work one phase of `SYSTEM_DESIGN.md` at a time. Do not start Phase *N+1*
  until Phase *N*'s "Definition of done" checklist is fully checked.
- A phase is not done when the Rust code compiles — it's done when the
  differential tests pass in CI *and* the old TypeScript implementation for
  that stage has been deleted in the same PR. Never leave two live
  implementations of the same stage past the PR that ports it.
- If you're unsure whether something belongs in this phase, it doesn't —
  raise it as a follow-up instead of expanding scope mid-phase.

## 2. Rust coding conventions (`crates/`)

- No `.unwrap()` / `.expect()` / `panic!` in library code
  (`raven-core`, `raven-node`, `raven-wasm`, `raven-lsp` non-test code).
  Use `Result<T, E>` with an error enum via `thiserror`. `unwrap` is fine in
  `#[test]` blocks and examples only.
- Run `clippy` and `rustfmt` in CI; a PR with clippy warnings doesn't merge.
- Model closed sets of kinds (AST nodes, type kinds, token kinds) as `enum`s
  with pattern matching, not trait objects — this mirrors the discriminated
  unions already used in `ast/nodes.ts` and `typechecker/types.ts` and keeps
  matches exhaustive (the compiler will tell you if you forget a case).
- All structural type comparisons go through the type-interning table
  described in `SYSTEM_DESIGN.md` §5 Phase 1. Never write a new ad hoc
  recursive deep-equality function for `RavenType` outside of it.
- `raven-core` must not depend on `napi` or `wasm-bindgen`. Only
  `raven-node` and `raven-wasm` may depend on those — `raven-core` stays a
  plain library so it can be tested and fuzzed without Node or a browser.

## 3. FFI boundary rules

- Every function exposed across the Node (`napi-rs`) or WASM
  (`wasm-bindgen`) boundary needs a doc comment with an example, and a real
  integration test in the corresponding TS or website package that calls the
  actual compiled binding — not a mock of it.
- The public shape of `@raven/compiler` (`compiler/src/index.ts`'s exported
  types and function signatures) does not change across phases. Consumers
  should never need to know whether a given stage currently runs in
  TypeScript or Rust.

## 4. Testing rules

- Any PR that ports a stage must include differential-test results comparing
  old (TS) vs new (Rust) output on every fixture in `examples/raven/` and
  `compiler/tests/`, not just a subset.
- Any PR touching `crates/raven-core` or a not-yet-deleted TS stage it
  overlaps with must include a before/after run of `benchmarks/run.ts` in
  the PR description.
- Golden-file diffs (emitted JS, diagnostics) require an explicit "this diff
  is intentional and why" note in the PR — never a silent re-approve.

## 5. What stays TypeScript, permanently

- `compiler/src/cli/*` — argument parsing, file globbing, watch mode.
- `compiler/src/index.ts` — becomes a thin wrapper, but stays TS as the
  public entry point.
- `vscode/extension/*` — never touched by this migration; it only cares that
  *some* LSP binary is configured, not what it's written in.

Do not "opportunistically" port these while working on something adjacent —
they were deliberately scoped out in §3 of `SYSTEM_DESIGN.md`.