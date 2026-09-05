# Raven Compiler — Performance Rewrite: System Design

Status: proposal
Scope: `compiler/`, `vscode/language-server/`, `website/raven-site/`

## 1. Why this document exists

Raven's compiler was paused to "figure out the right optimization strategy"
before adding more features. This document turns that open-ended goal into a
gated, incremental plan: measure first, port only what's proven slow, never
run two implementations of the same stage in parallel for longer than one
phase.

## 2. Current state (measured, not guessed)

Lines of TypeScript per module, `compiler/src/`:

| Module | Lines | Role |
|---|---|---|
| `typechecker/` | 1286 | type inference, structural typing, `model` cross-file resolution |
| `parser/` | 605 | tokens → AST |
| `emitter/` | 425 | AST → JS |
| `cli/` | 297 | CLI commands, project orchestration |
| `ast/` | 222 | node type definitions |
| `sourcemap/` | 156 | sourcemap generation |
| `lexer/` | 151 | source → tokens |
| `project/` | 144 | workspace/project loading |
| `diagnostics/` | 135 | error reporting |
| `optimizer/` | 125 | AST-level optimization passes |
| `formatter/` | 15 | stub |

`vscode/` (extension + language server) is ~360 lines of TypeScript.

**Observation:** the whole compiler is ~3,400 lines. There is currently no
benchmark suite and no profiling data anywhere in the repo. `typechecker/` is
almost 40% of the codebase by itself and is the only stage that does
cross-file work (the workspace registry that backs `model`), which makes it
the most plausible source of any real slowdown as projects grow — but this is
a hypothesis, not a measurement. **Phase 0 exists to replace that hypothesis
with a number before any Rust is written.**

## 3. Goals / non-goals

**Goals**
- Know, with numbers, whether and where the compiler is actually slow.
- If a rewrite is justified, get the performance win without a multi-month
  rewrite freeze — ship incrementally, stage by stage.
- Keep `@raven/compiler`'s public TS API and the VS Code extension working,
  unchanged, throughout the migration.
- End up with a core that can be reused from Node (CLI, LSP) *and* the
  browser (`website/raven-site` playground) from one implementation.

**Non-goals**
- Rewriting for its own sake. A stage that isn't a measured bottleneck is not
  ported, no matter how nice it would look in Rust.
- Changing Raven language semantics as part of this work.
- Rewriting `compiler/src/cli` (argument parsing, file globbing, watch mode).
  There is no performance reason to move this out of TS.

## 4. Target architecture

```
raven/
├── crates/                        # NEW — Rust workspace
│   ├── raven-core/                # pure Rust compiler core, no Node/WASM deps
│   │   └── src/{lexer,parser,ast,typechecker,emitter,optimizer,sourcemap,project,diagnostics}/
│   ├── raven-node/                # napi-rs bindings → native .node addon for Node/CLI/LSP
│   ├── raven-wasm/                # wasm-bindgen bindings → website playground
│   └── raven-lsp/                 # (Phase 4) tower-lsp server, replaces vscode/language-server
├── compiler/                      # EXISTING TS package — shrinks over each phase
│   └── src/
│       ├── cli/                   # stays TS permanently
│       └── index.ts               # thin wrapper, calls into raven-node once ported
├── vscode/
│   ├── extension/                 # unchanged — spawns whatever LSP binary is configured
│   └── language-server/           # replaced by crates/raven-lsp in Phase 4
├── website/raven-site/            # loads raven-wasm for in-browser compile
└── benchmarks/                    # NEW — required before Phase 1 starts
    ├── fixtures/                  # tiny / medium / large synthetic .rv programs + multi-file workspace
    └── run.ts
```

**Why Rust, and why this split:**
- `napi-rs` gives a native Node addon (like SWC, lightningcss, Biome/oxc) —
  called from TS as a normal import, no subprocess/IPC overhead.
- `wasm-bindgen`/`wasm-pack` reuses the exact same `raven-core` crate for
  `website/raven-site`, with small, fast WASM output — a genuine advantage
  here since the website already exists.
- Keeping `raven-core` free of `napi`/`wasm-bindgen` dependencies means it can
  be unit-tested, fuzzed, and reasoned about as a normal Rust library,
  independent of which host is calling it.
- `tower-lsp` (Phase 4) lets the language server become pure Rust with no FFI
  boundary at all — LSP is JSON-RPC over stdio, so `vscode/extension` doesn't
  need to know or care what language the server binary is written in.

## 5. Migration phases

### Phase 0 — Benchmark & profile (no Rust written yet)

Deliverables:
- `benchmarks/fixtures/`: a small (~10 line), medium (~500 line, multi-file),
  and large (synthetic, 50+ files using `model`) Raven program set.
- `benchmarks/run.ts`: times each pipeline stage (lex, parse, bind, check,
  emit, optimize, sourcemap) individually, using `process.hrtime.bigint()`,
  on both a single file and the full synthetic workspace.
- A committed report (`benchmarks/results/YYYY-MM-DD.md`) with per-stage
  timings and % of total wall time.

**Exit criteria (hard gate):** either (a) a specific stage accounts for a
clear majority of wall time on the large fixture — proceed to Phase 1 on
*that* stage — or (b) nothing is actually slow at current scale, in which
case this whole effort is documented as "not needed yet" and the team goes
back to features.

### Phase 1 — Hybrid: port the bottleneck stage only

Assuming Phase 0 confirms `typechecker/` (most likely candidate, given its
size and its cross-file responsibilities):

- New `raven-core::typechecker` module, mirroring
  `types.ts` / `checker.ts` / `binder.ts` / `registry.ts` / `symbolTable.ts`.
- `RavenType` becomes a Rust enum. Structural equality goes through a
  **type-interning table** (canonical hash of a shape → a single id), so
  repeated comparisons become id comparisons instead of recursive structural
  walks. This is the single highest-leverage change in the whole plan — it's
  an algorithmic fix that Rust makes cheap and safe to implement, not
  something only Rust can do.
- FFI contract: serialized (untyped) AST in → typed AST + diagnostics out.
  Start with `serde_json` for simplicity; only move to a binary format
  (`bincode`, flatbuffers) if Phase-1 benchmarks show serialization itself is
  a cost.
- Exposed via `raven-node`: e.g. `checkProgram(ast) -> { types, diagnostics }`.
- `compiler/src/typechecker/checker.ts` becomes a thin wrapper calling the
  native binding. The TS implementation stays behind a flag until parity
  tests pass (see §6), then is deleted in the same PR that removes the flag.

### Phase 2 — Port lexer + parser

- Move `lexer/` and `parser/` into `raven-core` so the FFI boundary sits at
  "source text in, typed AST out" rather than serializing an untyped AST
  across the boundary twice.
- `ast/nodes.ts`'s discriminated unions map almost directly onto Rust enums.

### Phase 3 — Port emitter, optimizer, sourcemap

- Smaller, lower-risk modules (425 + 125 + 156 lines). Ported once the front
  end (Phases 1–2) is stable in production.
- `compiler/src/index.ts` becomes a thin shim over `raven-node`;
  `compiler/src/cli` remains TS permanently.

### Phase 4 — Language server (independent, can run in parallel with 1–3)

- Rewrite `vscode/language-server` as `crates/raven-lsp` using `tower-lsp`,
  calling directly into `raven-core` (no FFI needed once both are Rust).
- `vscode/extension` requires no changes — it spawns a configured binary and
  speaks LSP JSON-RPC regardless of implementation language.
- Lower risk than the compiler phases (a laggy/restarting language server is
  more forgiving than a broken build), so this is a reasonable place to
  prototype the Rust approach first if the team wants a smaller trial run.

### Phase 5 — WASM playground

- Build `raven-wasm` from the by-then-complete `raven-core` and wire it into
  `website/raven-site` for a server-round-trip-free in-browser playground.

## 6. Testing & parity strategy

- **Differential testing:** while a stage has both a TS and a Rust
  implementation, run both on every fixture in `examples/raven/` and
  `compiler/tests/` and diff the outputs (AST shape, inferred types,
  diagnostics, emitted JS). The TS implementation is only deleted once this
  has been green in CI for an agreed number of consecutive runs.
- **Golden files:** snapshot emitted JS + diagnostics per fixture; any diff
  requires explicit review.
- **Fuzz/property tests (optional, later):** generate small random `.rv`
  programs and assert both implementations agree, to catch cases the fixture
  suite misses — most useful during Phase 1 given how central structural
  typing is to the language.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `napi-rs` cross-platform prebuilds (win/mac/linux × x64/arm64) | Use napi-rs's own GitHub Actions CI templates; build matrix from day one of Phase 1 |
| Contributors need Rust now | Phase 0 is TS-only; CLI and workspace-registry glue stay TS permanently, so most contributions still don't need Rust |
| Scope creep back into "rewrite everything" | Hard phase gates — each phase ships and runs in production before the next starts |
| WASM bundle size for the website | `wasm-opt -Oz`, bundle-size check in CI before Phase 5 merges |
| Silent drift between TS and Rust implementations mid-migration | Differential tests are CI-blocking, not advisory; delete the old implementation in the same PR that turns them green |

## 8. Definition of done (per phase)

- [ ] Differential tests green against all existing fixtures
- [ ] Benchmark re-run, numbers committed to `benchmarks/results/`
- [ ] Old TS implementation for that stage deleted (no parallel copies left)
- [ ] Public API of `@raven/compiler` unchanged
- [ ] `vscode/extension` and `website/raven-site` still work unmodified (or, for Phases 4/5, updated exactly as scoped for that phase)