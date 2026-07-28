# Raven

> A language that compiles to JavaScript. It infers your types — you only name the ones you want to share.

**Status:** 🚧 Early development (v0.0.1)

---

## The idea

Every language with static types eventually asks you to write the same shape twice: once as data, once as a type. Raven's compiler infers the shape from the data itself, so most of the time you never write a type at all.

```
let user = { id: 1, name: "Bro" }
```

The compiler already knows `user` is `{ id: number, name: string }`. No annotation needed.

## `let` vs `model`

Raven has two levels of scope for inferred types:

- **`let` / `const`** — local. The shape is inferred and used inside this file only.
- **`model`** — published. The shape is inferred (or bound to an external source) and made available to the *entire project*, with no import needed.

```
// user.rv
model user = { id: 1, name: "Bro" }
```

```
// auth.rv
fn login(user)
    print(user.name)
end
```

`auth.rv` never imports a type. The compiler looks up `user` in the project's **workspace registry**, finds the shape published in `user.rv`, and type-checks against it directly.

Imports still exist — for *code*:

```
import login from "./auth"
```

What Raven removes is `import type { User } from "./types"`, not imports in general.

## External data

The same `model` keyword binds a name to an external source — a database, an API, a JSON file — anywhere the compiler can't infer a shape from source code alone:

```
model User = database.users
model User = api("/users")
```

This is the one place Raven asks you to be explicit, because the data genuinely doesn't live in your project.

## One rule that keeps this predictable

If two files publish `model` under the same name with different shapes, that's a compile error — not a merge, not a silent override:

```
Model 'user' is already published with a different shape.
```

One name, one canonical shape. If you need a different shape, give it a different name.

## Philosophy

> The programmer describes the data. The compiler manages the types.

Only two decisions are ever asked of a developer:
1. Should this shape stay local (`let`), or be shared project-wide (`model`)?
2. Is this data coming from outside the project, and if so, what shape should it have?

Everything else — inference, propagation, validation — is the compiler's job.

## Current status

- [x] Lexer, Parser, Emitter
- [x] Local type inference (`let`/`const`, functions, arrays, records)
- [ ] `model` keyword + Workspace Registry
- [ ] Cross-file type resolution
- [ ] External source binding (`database`, `api`)
- [ ] Language Server / editor tooling

## Contributing

Raven is early. Compiler engineering, language design, and testing contributions are all welcome — open an issue or a discussion.

## License

MIT