#!/usr/bin/env node
// Canonicalize JSON for the differential harness: values are deep-sorted by
// object key, so diagnostics emitted by different serializers (the TS wrapper
// through serde_json's key-sorted `Map`, and the Rust example's struct-order
// serializer) compare element-wise. Mirrors the "key-sorted, whitespace-
// normalized" contract documented in diff.sh.
//
// Usage: bench-json-sort.js <file>   (or pipe JSON on stdin)
let input = "";
if (process.argv[2]) {
  const { readFileSync } = require("fs");
  input = readFileSync(process.argv[2], "utf8");
} else {
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => process.stdout.write(JSON.stringify(sort(JSON.parse(input)))));
}
if (process.argv[2]) process.stdout.write(JSON.stringify(sort(JSON.parse(input))));

function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, sort(value[k])]),
    );
  }
  return value;
}