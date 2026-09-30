# Raven Phase 3 — verified, drop-in files

These are real diffs against your actual repo (cloned and worked against
directly this session) — not reconstructed guesses. Every claim below was
checked by actually running it.

## How to apply

All of these REPLACE the file at the same path in your repo (they're full
files, either modified or new) — not append, not partial:

```
compiler/src/cli/pipeline.ts        (modified — compileFile now one native call)
compiler/src/emitter/emitter.ts     (replaced — thin native delegate)
compiler/src/native.ts              (modified — 3 new FFI wrappers appended)
compiler/src/optimizer/index.ts     (replaced — thin native delegate)
compiler/src/sourcemap/generator.ts (modified — added SourceMapGenerator.fromRaw)
crates/raven-core/src/lib.rs        (modified — 3 new pub mod lines)
crates/raven-core/src/emitter.rs    (new)
crates/raven-core/src/optimizer.rs  (new)
crates/raven-core/src/sourcemap.rs  (new)
crates/raven-core/examples/differential.rs (new — differential-test tool, not shipped code)
crates/raven-node/index.d.ts        (modified — 3 new declare function entries)
crates/raven-node/src/lib.rs        (modified — mod phase3 + pub use)
crates/raven-node/src/phase3.rs     (new)
benchmarks/differential/phase3-old.mts   (new — reusable differential script)
benchmarks/differential/phase3-diff.py   (new — reusable diff script)
benchmarks/differential/results/phase3-differential.md (new — the report)
```

## What's verified, for real, this session

- `cargo test -p raven-core --lib` → **15/15 passing**, against your actual
  `ast.rs`/`checker.rs`/`lexer.rs`/`parser.rs`.
- `cargo build -p raven-node` → **compiles clean** (verified with a
  temporary rustc-version workaround described below, then reverted — your
  `Cargo.toml`/`Cargo.lock` are untouched).
- `npx tsc --noEmit` (in `compiler/`) → **0 errors**.
- **Differential test**: ran the old TS optimizer/emitter and the new Rust
  ones over all 17 real fixtures in `examples/raven/**`. 6/17 byte-identical,
  11/17 differ — every diff is exactly the documented optimizer bug fix
  (old TS silently drops `model`/`import` statements; new Rust keeps them).
  Zero unexplained differences. Full write-up and reproduction steps in
  `benchmarks/differential/results/phase3-differential.md`.
- Existing baseline suite (`npx vitest run`, before any of this): 107 tests
  passing, 3 suites failing (`checker`, `integration`, `native` — all
  need the native binary, expected).

## The one real blocker: the native `.node` binary isn't built

Your `raven-node/Cargo.toml` pins `napi-build = "2.4"`, which requires
**rustc 1.88+**. Every environment this work was done in only had rustc
1.75 available (apt). I verified the Rust *source* compiles correctly by
temporarily loosening that version pin locally, confirming the build, then
reverting the pin — so `Cargo.toml`/`Cargo.lock` in your repo are
untouched by that workaround. But I could not produce an actual loadable
`.node` file here.

**Check this on your end**: if your dev machine is also on rustc ~1.75,
you'll hit this exact wall. You need rustc ≥1.88 (via rustup, since your
distro's package manager may lag behind) before `napi build` will work.

## What happens to your test suite once you apply these files

Right now (before the native binary exists), applying these files will
make **5 test suites fail to load** (not fail assertions — fail to
`require()` the native module): `checker.test.ts`, `integration.test.ts`,
`native.test.ts`, `emitter.test.ts`, `sourcemap.test.ts` (the last two are
new regressions from this pass specifically, since `Emitter` now requires
native). This is expected and temporary — once you:

1. Get rustc ≥1.88.
2. Run `cd crates/raven-node && npm install && napi build --release` (or
   your project's equivalent build script) to produce the `.node` binary.
3. Re-run `npx vitest run`.

...all 5 suites should pass again, assuming nothing else was missed. If
`checker.test.ts`/`integration.test.ts`/`native.test.ts` don't pass at that
point, that's pre-existing Phase 1/2 surface, not something this pass
touched.

## Genuinely still open

- `benchmarks/differential/results/phase3-differential.md` covers
  `examples/raven/**` but not the inline `check(\`...\`)`-style snippets in
  `compiler/tests/*.test.ts` (per AGENTS.md §4's "every fixture" rule) —
  flagged explicitly in the report rather than silently skipped. Re-running
  `emitter.test.ts`/`sourcemap.test.ts` once the binary exists covers most
  of that gap without extra work.
- Per AGENTS.md §4, this PR should also include a before/after
  `benchmarks/run.ts` timing comparison — not done this session (ran out of
  scope/turns), and it needs the built binary to be meaningful anyway
  (right now the "before" and "after" would just be the same TS code with
  the after path throwing on missing native module).
- Per AGENTS.md phase discipline: don't delete anything else, and don't
  mark Phase 3 "done" in any tracking doc until the binary is built and the
  5 currently-failing suites pass for real.
