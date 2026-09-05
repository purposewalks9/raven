#!/usr/bin/env bash
# Runs the full Phase 1 differential suite comparing the TypeScript typechecker
# (the pre-port reference) against the Rust raven-core checker.
#
# Fixture sources:
#   - benchmarks/differential/fixtures/     curated error-case corpus (25 files)
#   - benchmarks/fixtures/**                the Phase 0 benchmark corpora
#   - examples/raven/**                     documented examples
#   - compiler/tests/.test.ts check(``)     inline fugitive snippets
#
# Usage: benchmarks/differential/run.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

TMPDIR_BASE="${TMPDIR:-/tmp}"
OUT="$TMPDIR_BASE/raven-differential.jsonl"
RUST_BIN="$(cd crates && pwd)/target/debug/examples/check"

if [[ ! -x "$RUST_BIN" ]]; then
  echo "building raven-core example checker..." >&2
  (cd crates && cargo build --example check --quiet)
fi

rm -f "$OUT"

emit() {
  node --import tsx benchmarks/differential/emit.ts "$1" >> "$OUT"
}

# Curated error-case corpus.
emit benchmarks/differential/fixtures

# Everything under the Phase 0 benchmark corpora and the examples.
for dir in benchmarks/fixtures/small benchmarks/fixtures/medium \
           benchmarks/fixtures/large/workspace \
           examples/raven examples/raven/workspace-demo/*; do
  emit "$dir" >/dev/null 2>&1 || true
done

# Inline `check(\`...\`)` snippets from the compiler test suite.
node --import tsx benchmarks/differential/from-tests.ts "$TMPDIR_BASE/raven-differential-tests.jsonl"
cat "$TMPDIR_BASE/raven-differential-tests.jsonl" >> "$OUT"

echo "total records: $(wc -l < "$OUT")"
bash benchmarks/differential/diff.sh "$OUT" "$RUST_BIN"