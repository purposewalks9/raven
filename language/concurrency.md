# Nova Structured Concurrency (Draft v0.1)

## Motivation
Raw `Promise` composition (`Promise.all`, unhandled rejections, orphaned
fire-and-forget async calls) is a major real-world bug source. Nova makes
task lifetime and cancellation part of the language.

## Core constructs (planned grammar — not yet in `grammar.ebnf`, track here)

```nova
async action loadDashboard() {
    task group {
        let profile = spawn fetchProfile(userId)
        let stats   = spawn fetchStats(userId)
        let feed    = spawn fetchFeed(userId)
    }
    // all three settle or the group cancels remaining tasks on first error
}
```

- `spawn` starts a child task scoped to the enclosing `task group` — it
  cannot outlive its parent scope (no orphaned promises).
- If any spawned task throws and isn't individually handled, the group
  cancels its siblings and propagates the error to the caller of the group.
- `race { ... }` resolves with the first settled task and cancels the rest.
- `timeout(ms) { ... }` wraps a block/task group with an automatic cancel.

## Compiling down
Each `task group` compiles to an `AbortController`-backed coordinator in
the emitted JS (`compiler/src/emitter`, runtime helper in
`compiler/src/runtime` / `packages/runtime`) — no external library required
at runtime for the common case.

## Open questions (roadmap)
- Structured concurrency across the server/client boundary — does a
  `spawn` inside a `server action` get the same cancellation semantics on
  client navigation-away?
- Backpressure primitives for streams (SSE/websocket) beyond simple tasks.
