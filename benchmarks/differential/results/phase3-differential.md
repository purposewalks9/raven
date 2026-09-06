# Phase 3 differential results — optimizer/emitter, TS vs Rust

Run:
```
# OLD side (needs a checkout from before optimizer/index.ts and
# emitter/emitter.ts were swapped to native delegates):
OUT_PATH=/tmp/raven-phase3-old.json \
  npx tsx benchmarks/differential/phase3-old.mts $(find examples -name "*.rv")

# NEW side:
OUT_PATH=/tmp/raven-phase3-new.json \
  cargo run --example differential -p raven-core -- $(find ../examples -name "*.rv")

# Diff:
python3 benchmarks/differential/phase3-diff.py /tmp/raven-phase3-old.json /tmp/raven-phase3-new.json
```

## Summary

- **fixtures**: all 17 `.rv` files under `examples/raven/**` (single-file
  tokenize → parse → optimize → emit; no `WorkspaceRegistry`/cross-file
  `model` resolution involved, since that's a typechecker concern, not
  optimizer/emitter — out of scope for this differential).
- **result**: 6/17 byte-identical (both the optimized and unoptimized emit
  output). 11/17 differ. **Every one of the 11 diffs is exactly the known
  optimizer bug fix** documented in `raven-core::optimizer`'s module doc
  comment: the old TS `optimizeStatement` switch silently drops
  `ModelDeclaration`/`ImportDeclaration` statements (no case, no default);
  the Rust port passes them through. Zero unexplained differences.
- **unoptimized-emit parity**: 17/17 identical — the emitter port alone
  (independent of the optimizer bug fix) is byte-for-byte faithful on every
  fixture.

## Per-file detail

| Fixture | Match? | Diff explained by |
|---|---|---|
| `demo.rv` | ✅ identical | — |
| `showcase.rv` | ❌ optimized only | old drops 2 `model` decls (`settings`, `remoteUser` via `api(...)`) |
| `workspace-demo/01-model-basics/user.rv` | ❌ optimized only | old drops the file's only statement (a `model`) → empty output |
| `workspace-demo/01-model-basics/auth.rv` | ✅ identical | no model/import |
| `workspace-demo/02-shape-conflict/billing.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/02-shape-conflict/user.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/03-typo-suggestion/auth.rv` | ✅ identical | no model/import |
| `workspace-demo/03-typo-suggestion/user.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/04-local-scope/scratch.rv` | ✅ identical | no model/import |
| `workspace-demo/04-local-scope/user.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/05-model-immutability/hacker.rv` | ✅ identical | no model/import |
| `workspace-demo/05-model-immutability/user.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/06-import-vs-model/user.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/06-import-vs-model/wrong-import.rv` | ❌ optimized only | old drops the `import` statement entirely |
| `workspace-demo/auth.rv` | ✅ identical | no model/import |
| `workspace-demo/billing.rv` | ❌ optimized only | old drops sole `model` decl |
| `workspace-demo/user.rv` | ❌ optimized only | old drops sole `model` decl |

## Golden-diff note (per AGENTS.md §4)

This diff is intentional. It is the one behavior change called out in
`raven-core::optimizer`'s module doc comment: the pre-port TS optimizer has
no `case`/`default` for `ModelDeclaration`/`ImportDeclaration` in its
`optimizeStatement` switch, so those statements fall through and the
function implicitly returns `undefined`, silently deleting every `model`
and `import` statement whenever `optimize()` runs (the default in
`compileFile`, since `shouldOptimize` defaults to `true`). Confirmed above
on real fixtures, not just unit tests: every file containing a `model` or
`import` statement loses it in the old output and keeps it in the new
output; nothing else about those files' emitted JS changes.

## Coverage gap (not silently dropped — flagging it)

Per AGENTS.md §4 ("every fixture... not just a subset"), this run covers
`examples/raven/**` but not the inline `check(\`...\`)`-style snippets in
`compiler/tests/*.test.ts` (the Phase 1 harness's `from-tests.ts` does this
for the typechecker; there's no equivalent extraction for
optimizer/emitter-relevant snippets yet). `compiler/tests/emitter.test.ts`
and `sourcemap.test.ts` do exercise many of those snippets directly, but
they currently fail to *run* (not fail assertions — fail to load) because
`Emitter` now requires the native `raven-node` binary, which isn't built in
any environment this work was done in (see the native-build blocker in the
top-level README). Re-run those suites once the binary exists; if they
pass, that closes this gap without needing a separate extraction script.
