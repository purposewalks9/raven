#!/usr/bin/env python3
"""Phase 3 differential diff — compares OLD (TS) vs NEW (Rust) results.

Usage: python3 benchmarks/differential/phase3-diff.py old.json new.json

Both inputs are the JSON files written by `phase3-old.mts` and the
`differential` Rust example respectively (see
`benchmarks/differential/results/phase3-differential.md` for how they're
produced). Paths in each file are relative to wherever that side was run
from, so this script normalizes on everything after "examples/" before
comparing.
"""
import json
import sys


def normalize(path: str) -> str:
    return path.split("examples/", 1)[1] if "examples/" in path else path


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    with open(sys.argv[1]) as f:
        old = json.load(f)
    with open(sys.argv[2]) as f:
        new = json.load(f)

    old_n = {normalize(k): v for k, v in old.items()}
    new_n = {normalize(k): v for k, v in new.items()}

    only_old = set(old_n) - set(new_n)
    only_new = set(new_n) - set(old_n)
    if only_old or only_new:
        print(f"FIXTURE SET MISMATCH: only in old={only_old}, only in new={only_new}")
        return 1

    matches = 0
    diffs = []
    for k in sorted(old_n):
        o, n = old_n[k], new_n[k]
        if o.get("error") or n.get("error"):
            diffs.append((k, "ERROR", o.get("error"), n.get("error")))
            continue
        if o["unoptimizedJs"] != n["unoptimizedJs"]:
            diffs.append((k, "unoptimized mismatch", o["unoptimizedJs"], n["unoptimizedJs"]))
            continue
        if o["optimizedJs"] != n["optimizedJs"]:
            diffs.append((k, "optimized mismatch", o["optimizedJs"], n["optimizedJs"]))
            continue
        matches += 1

    print(f"{matches}/{len(old_n)} files: IDENTICAL output (unoptimized AND optimized)")
    print(f"{len(diffs)} files differ:\n")
    for k, kind, o, n in diffs:
        print(f"--- {k} [{kind}] ---")
        if kind == "ERROR":
            print("  old error:", o)
            print("  new error:", n)
        else:
            print("  OLD:", repr(o[:300]))
            print("  NEW:", repr(n[:300]))
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
