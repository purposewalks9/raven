# Nova Type System (Draft v0.1)

## Goals
Sound, inferred, structural-with-nominal-escape-hatches — close to
TypeScript's ergonomics but without `any`-shaped holes in the sound core.

## Inference
- Local type inference (Hindley-Milner-ish, not full HM) — `state count = 0`
  infers `number` with no annotation.
- Bidirectional checking for function args/returns against declared types.

## Null safety
- No implicit `null`/`undefined` in a type unless written as `T | null`.
- `Option<T>` (`Some(T)` / `None`) is the idiomatic "maybe absent" type in
  logic code; plain `T | null` is allowed for JS interop boundaries.

## Exhaustive pattern matching
```nova
type Status = Loading | Success(User) | Failure(string)

match (status) {
    Status.Loading => spinner {}
    Status.Success(user) => text { user.name }
    Status.Failure(msg) => errorBanner { msg }
}
```
The typechecker rejects a `match` that doesn't cover every variant of an
`enum`/union unless a `_ => ...` catch-all is present.

## Generics
`interface Repo<T> { get(id: string): Option<T>; save(item: T): void }` —
standard bounded generics, no HKTs in v0.1.

## Result-based error handling
See `modern error handling` in `specification.md` and this snippet:
```nova
server action login(email: string, password: string) -> Result<User, AuthError> {
    ...
}
```
Callers must handle both `Ok`/`Err` (via `match`) or explicitly propagate
with `?` (planned, not yet in grammar — track in `roadmap.md`).

## JS/TS interop typing
- `.d.ts` files can be imported directly; their types are lifted into Nova's
  type system with `unknown`-widening at unsound edges (e.g. untyped JS
  functions) rather than silently trusting them.
