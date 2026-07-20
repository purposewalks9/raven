# Nova Framework Runtime

Runtime packages that back the language-level constructs described in
`language/`. These are what the compiler's generated code actually imports
at runtime (see `compiler/src/emitter`).

| Folder      | Backs                                             | Spec |
|-------------|----------------------------------------------------|------|
| `router/`   | File-based route registration, `router.push(...)`   | `language/modules.md` |
| `ui/`       | Built-in UI node runtime (`card`, `input`, `button`, ...) | `language/syntax.md` |
| `server/`   | `server action` → RPC handler wiring                | `language/modules.md` |
| `auth/`     | `auth.login(...)`-style helpers used by generated actions | — |
| `database/` | Query helpers for server-side data access           | — |
| `state/`    | Compiler-managed state patch/subscribe runtime      | `language/state.md` |
| `forms/`    | Form-control bindings (`bind`, validation)           | `language/syntax.md` |

Each of these is intentionally thin — see "Zero Runtime Overhead" in the
root README. If a folder here is growing into something that looks like a
full framework (routing conventions, config files, etc.), that's a signal
the compiler should be doing more of the work instead.
