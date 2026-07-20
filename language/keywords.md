# Nova Keywords (Draft v0.1)

## Structural
`page`, `component`, `import`, `from`, `export`, `type`, `enum`, `interface`

## State & actions
`state`, `action`, `server`, `client`, `shared`, `async`, `await`

## Control flow
`if`, `else`, `match`, `for`, `while`, `return`, `break`, `continue`

## Concurrency
`spawn`, `task`, `race`, `all`, `timeout`, `cancel`

## Error handling
`try`, `catch`, `throws`, `Result`, `Ok`, `Err`, `Option`, `Some`, `None`

## Types / literals
`true`, `false`, `null`, `void`, `never`, `any`, `unknown`

## Reserved for future use
`use`, `with`, `where`, `derive`, `pub`

## Notes
- Keywords are reserved in all contexts — no contextual-keyword tricks in v0.1
  (revisit once the grammar stabilizes; contextual keywords add parser
  complexity that isn't worth it before there are real users).
- UI block names (`card`, `input`, `button`, `heading`, ...) are **not**
  keywords — they're ordinary identifiers resolved against the `@nova/ui`
  component registry at typecheck time. This keeps the core language small
  and lets user-defined components use the same call syntax as built-ins.
