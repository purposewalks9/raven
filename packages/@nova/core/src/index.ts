// Option<T> / Result<T, E> — see language/type-system.md
export type Option<T> = { kind: "some"; value: T } | { kind: "none" };
export const Some = <T>(value: T): Option<T> => ({ kind: "some", value });
export const None: Option<never> = { kind: "none" };

export type Result<T, E> = { kind: "ok"; value: T } | { kind: "err"; error: E };
export const Ok = <T>(value: T): Result<T, never> => ({ kind: "ok", value });
export const Err = <E>(error: E): Result<never, E> => ({ kind: "err", error });
