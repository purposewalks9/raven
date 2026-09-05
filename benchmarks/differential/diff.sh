#!/usr/bin/env bash
# Differential test: TypeScript typechecker (reference) vs Rust raven-core.
# Reads the emitted fixture bundle (one JSON record per line), feeds each AST
# to the Rust example checker, and compares diagnostics JSON element-wise
# after canonicalizing (key-sorted, whitespace-normalized) JSON text.
#
# Usage: diff.sh <fixtures.jsonl> [rust-check-binary]
set -euo pipefail

FIXTURES="${1:?usage: diff.sh <fixtures.jsonl> [rust-check-binary]}"
RUST_BIN="${2:-}"
if [[ -z "$RUST_BIN" ]]; then
  RUST_BIN="$(cd "$(dirname "$0")/../../crates" && echo "$PWD")"
  RUST_BIN="$RUST_BIN/target/debug/examples/check"
fi

REC=/tmp/diff_rec.json
AST=/tmp/diff_ast.json
TS=/tmp/diff_ts.json
SORT="$(cd "$(dirname "$0")" && pwd)/bench-json-sort.js"

fails=0
total=0
while IFS= read -r line; do
  total=$((total + 1))
  printf '%s\n' "$line" > "$REC"

  file="$(node -e 'const l=require(process.argv[1]);process.stdout.write(l.file)' "$REC")"
  node -e 'const l=require(process.argv[1]);process.stdout.write(JSON.stringify(l.ast))' "$REC" > "$AST"
  node -e 'const l=require(process.argv[1]);process.stdout.write(JSON.stringify(l.ts))' "$REC" > "$TS"

  if ! rust_json="$("$RUST_BIN" < "$AST" 2>/tmp/diff_err.txt)"; then
    echo "FAIL $file: rust checker errored: $(head -c 200 /tmp/diff_err.txt)"
    fails=$((fails + 1))
    continue
  fi

  ts_norm="$(node "$SORT" "$TS")"
  rust_norm="$(printf '%s' "$rust_json" | node "$SORT")"

  if [[ "$ts_norm" == "$rust_norm" ]]; then
    echo "PASS $file"
  else
    echo "FAIL $file"
    echo "  ts:   $ts_norm"
    echo "  rust: $rust_norm"
    fails=$((fails + 1))
  fi
done < "$FIXTURES"

echo ""
echo "differential: $((total - fails))/$total passed, $fails failed"
[[ "$fails" -eq 0 ]]