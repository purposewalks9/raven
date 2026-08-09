# @raven/compiler

> A statically typed language for the JavaScript ecosystem that compiles to optimized JS.

Raven infers types from your data — you only name the ones you want to share across files.

```
let user = { id: 1, name: "Bro" }
```

The compiler already knows `user` is `{ id: number, name: string }`. No annotation needed.

## Install

```bash
npm install -g @raven/compiler
```

## Quick start

```bash
raven new my-app
cd my-app
raven run src/main.rv
```

## Commands

```
raven new <name>              scaffold a new project
raven run <file.rv>           compile and run a file
raven build <file.rv> [out]   compile to JavaScript
raven check <file | dir>      type-check without emitting
raven fmt <file.rv>           format a file
raven repl                    interactive REPL
raven version                 print the compiler version
```

## `let` vs `model`

- **`let` / `const`** — local. The shape is inferred and used inside this file only.
- **`model`** — published. The shape is inferred and made available to the *entire project*, with no import needed.

```
// user.rv
model user = { id: 1, name: "Bro" }
```

```
// auth.rv
fn login(id: number): string
    print(user.name)
    return user.name
end
```

`auth.rv` never imports a type — the compiler resolves `user` from the project's workspace registry.

## Using the compiler as a library

```ts
import { checkSource } from "@raven/compiler";

const result = checkSource(`let x: number = "oops"`);
console.log(result.diagnostics);
```

## Editor support

A VS Code extension (`raven-lang.raven-language`) provides hover, go-to-definition,
find references, and live diagnostics via the bundled language server. See the
[project README](https://github.com/purposewalks9/raven) for setup.

## Status

Early development. See the [main repo](https://github.com/purposewalks9/raven) for
the full roadmap and contributing guide.

## License

MIT
