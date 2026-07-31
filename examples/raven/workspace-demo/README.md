# Workspace / `model` feature demos

Six small, permanent example projects, each isolated in its own folder so
they don't interfere with each other. Run all commands from `~/raven/compiler`.

Every folder is a self-contained "project" as far as the compiler is
concerned — `raven check <folder>` scans everything inside it.

---

## 01-model-basics — the core feature

`user.rv` publishes `model user = {...}`. `auth.rv` uses `user.name` with
**zero import**. This is the whole point of `model`: shared across the
project automatically.

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/01-model-basics
```

Expected:
```
../examples/raven/workspace-demo/01-model-basics: ok (2 file(s), 1 model(s) published)
```

---

## 02-shape-conflict — field-level diff on conflict

`user.rv` and `billing.rv` both publish `model user`, but with different
shapes (`billing.rv` is missing `name`, and has `plan` as a `number`
instead of a `string`).

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/02-shape-conflict
```

Expected (note the `+`/`~` diff lines):
```
error: Model 'user' is already published with a different shape.
  + name: string
  ~ plan: number -> string
 --> .../user.rv:1:1
...
Hint: 'user' was first published in .../billing.rv. Give this one a different name, or make both shapes match.
```

Try editing `billing.rv` to only differ in ONE field and re-run — watch the
diff shrink to just that one line.

---

## 03-typo-suggestion — "did you mean?"

`auth.rv` misspells `user` as `usre`, and the built-in `toString` as
`toStrng`.

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/03-typo-suggestion
```

Expected:
```
error: Undeclared variable 'usre'
Hint: Did you mean 'user'?

error: Undeclared function 'toStrng'
Hint: Did you mean 'toString'?
```

---

## 04-local-scope — `let`/`const` never touch the model registry

`scratch.rv` declares `let session = { user: 1, expires: "..." }` — note
the field is literally named `user`, but it has nothing to do with the
published `user` model in `user.rv`. Also has a `const` type mismatch and
a bad reassignment.

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/04-local-scope
```

Expected: 2 errors — `MAX_RETRIES` type mismatch, and a `session`
reassignment mismatch. Neither error mentions the `user` model at all,
proving local stays local even when names collide.

---

## 05-model-immutability — models are read-only outside their file

`hacker.rv` tries to reassign `user` (published in `user.rv`).

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/05-model-immutability
```

Expected:
```
error: Cannot reassign 'user': it's a published model, which is read-only outside the file that declares it.
```

---

## 06-import-vs-model — `import` is for code, not models

`wrong-import.rv` tries `import user from "./user"` — but `user` is a
model, not a function, so it shouldn't need (or be allowed) an import.

```bash
node dist/cli/index.js check ../examples/raven/workspace-demo/06-import-vs-model
```

Expected:
```
error: 'user' is a published model, not code — models don't need an import, just use the name directly.
```

---

## Running all six at once

```bash
for d in ../examples/raven/workspace-demo/*/; do
  echo "=== $d ==="
  node dist/cli/index.js check "$d"
  echo
done
```

Folders `01` should print `ok`; folders `02` through `06` are intentionally
broken and should each print their specific error above.
