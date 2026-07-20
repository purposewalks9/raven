# Nova Module System (Draft v0.1)

## Goals
Replace the accumulated config surface of a typical JS/TS project
(`tsconfig` paths, bundler aliases, barrel files, framework-specific
route-file conventions) with one predictable, compiler-driven system.

## File-based routing without config
A `page "/login" { ... }` block anywhere under `src/pages/**` is
automatically registered as a route by the compiler — no `routes.ts`,
no file-name convention beyond "it contains a `page` declaration". Route
param syntax: `page "/users/:id" { ... }` binds `id` as an in-scope
`string` inside the page.

## Server/client boundary as a module property, not a folder convention
Instead of `"use client"` / `"use server"` string directives (fragile,
easy to place wrong) or Next.js's folder-based server/client split, Nova
determines the boundary from the declaration itself:
- `server action` bodies never ship to the client bundle; calls to them
  compile to a generated `fetch` to an auto-created RPC endpoint.
- `action` bodies are client-only.
- Plain functions/types referenced by both are duplicated into both
  bundles (or shared via a `shared` module) — the compiler decides based
  on the reference graph, not the developer guessing.

## Imports
```nova
import { formatDate } from "./utils"
import Button from "@nova/ui"
import lodash from "lodash"   // plain npm/TS packages import unchanged
```
No path aliases needed for internal modules — Nova resolves relative to
project root by default (config escape hatch planned for large monorepos,
see `roadmap.md`).

## Interop with existing JS/TS
`.nova` modules can import `.ts`/`.js` directly; the compiler treats
Read/inferred `.d.ts` types as sound at the boundary and widens to
`unknown` where declarations are missing, rather than silently trusting
untyped JS (see `type-system.md`).
