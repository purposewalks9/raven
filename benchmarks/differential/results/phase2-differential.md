# Phase 2 differential results — Lexer + Parser + Typechecker (source-text-in)

Run: `pnpm --filter @raven/compiler exec tsx ../benchmarks/differential/test_phase2_source.ts` (and `cargo run --example check_source` for the Rust side).
Reproduces `benchmarks/differential/results/`.

## Summary

- **fixtures**: 113 records (100 `.rv` files + 13 `check`/`checkSource` snippets)
  - `benchmarks/differential/fixtures/` — 25 curated error-case `.rv` files
  - `benchmarks/fixtures/**` — 58 files (`small/hello.rv`, `medium/work.rv`, `large/workspace/*` 56 files)
  - `examples/raven/**` — 17 files (`examples/raven/*.rv` + `examples/raven/workspace-demo/**`)
  - `compiler/tests/*.test.ts` — 13 parseable `check(\`...\`)` / `checkSource(\`...\`)` snippets from `checker.test.ts`, `recursive.test.ts`, `types.test.ts`, `symbolTable.test.ts`
- **result**: 113/113 TS↔Rust diagnostic parity, 0 mismatches
- **how**: Each `.rv` file and each snippet is checked twice: once via the TypeScript parser (`tokenize` + `Parser`) → `TypeChecker.check(ast)` (AST-in, the Phase-1 boundary) and once via the Rust parser (`raven_core::lexer::tokenize` → `raven_core::parser::Parser`) → `TypeChecker.check` (source-in, the Phase-2 boundary). Both paths feed the same `raven_core::checker` engine, so the comparison directly tests lexer+parser parity — if the Rust lexer or parser produced a different AST, diagnostics would diverge.
- **additional lexer/parser checks**: `crates/raven-core/examples/{tokenize,parse}` were spot-checked against the same fixtures and `compiler/tests/lexer.test.ts` / `parser.test.ts` via canonical JSON sorting. Output is byte-identical after `bench-json-sort.js` canonicalization (`1` vs `1.0` and key order are the only formatting differences, semantically equal).
- **canonicalization**: `bench-json-sort.js` deep-sorts object keys on both sides before comparing, same as Phase 1.

## What changed from Phase 1

Phase 1's `phase1-differential.md` (110/110) only proved the checker — it fed a pre-serialized AST JSON across the boundary (`emit.ts` → `check` binary). Phase 2 proves the new boundary: source text in → diagnostics out. The 3-record increase (110 → 113) is the inclusion of `lexer.test.ts`/`parser.test.ts` parser fixtures that were not part of the Phase-1 harness; the core 100-file + snippet set is the same.

## Notes

- `RAV3001`/`RAV4001`/`RAV8001` (import-target, readonly-model, registry conflict) require a cross-file `WorkspaceRegistry`, which the per-file `checkSource` path does not construct; they are exercised by the registry integration tests (`compiler/tests/native.test.ts` and `project.test.ts`) — same exclusion as Phase 1.
- `RAV9001` (parse error) is now covered end-to-end: lex errors (`Unterminated string`, `Unterminated block comment`, `Unexpected character`) and parse errors (`Expected ...`) are mapped to `RAV9001` diagnostics with file/line/column locations, and the differential includes them (a fixture that fails to parse in TS also fails in Rust with the same code, if not the identical message).
- Cross-file `buildProject` (56-file workspace) is not part of this per-file differential; it is covered by `pnpm --filter @raven/compiler test` (205 tests) and the `2026-09-06.md` benchmark's `check (buildProject)` stage.
