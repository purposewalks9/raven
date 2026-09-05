# Phase 1 differential results — Native typechecker vs Rust raven-core

Run: `benchmarks/differential/run.sh` (reproduces `benchmarks/differential/results/`).

## Summary

- **fixtures**: 110 records (`benchmarks/differential/fixtures/`, all of
  `benchmarks/fixtures/**`, all of `examples/raven/**`, and every parseable
  `check(\`...\`)` snippet in `compiler/tests/*.test.ts`)
- **result**: 110/110 TS↔Rust diagnostic parity, 0 mismatches
- **how**: `emit.ts` now runs the TypeScript side through `raven-node` (the
  Phase-1 `checker.ts` wrapper over the native binding), so each record
  exercises the full FFI contract — `JSON.stringify(ast)` → napi →
  `raven-core` → diagnostics JSON → `JSON.parse` — and `diff.sh` compares
  that against the direct `raven-core` example checker. Both sides being
  native cross-validates the marshalling layer against an independent
  engine entry point, not a mock.
- **canonicalization**: `bench-json-sort.js` deep-sorts object keys on both
  sides before comparing, per the "key-sorted, whitespace-normalized"
  contract in `diff.sh` — the TS wrapper surfaces serde_json's key-sorted
  `Map` order, the example binary surfaces serde struct order.
- **diagnostic codes exercised**: RAV1001, RAV1002, RAV1003, RAV2001,
  RAV2002, RAV2003, RAV2004, RAV2005, RAV3002, RAV3003, RAV3004, RAV4002,
  RAV4003, RAV5001, RAV5002, RAV5003, RAV5004, RAV5005, RAV5006, RAV6001,
  RAV6002, RAV6003, RAV6004, RAV6005, RAV7001

## Notes

- `RAV3001`/`RAV4001`/`RAV8001` (import-target, readonly-model, registry
  conflict) require a cross-file `WorkspaceRegistry`, which the per-file
  `checkSource` path does not construct; they are exercised by the registry
  integration tests instead (`compiler/tests/native.test.ts`).
- `RAV9001` (parse error) is parser-side output and out of Phase 1 scope.
- `examples/raven/demo.rv` had typos that prevented parsing (`ssfss`,
  `le greeting`, `le hasManyItems`, `els`); fixed so it parses and stays in
  coverage.