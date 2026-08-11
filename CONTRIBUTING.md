# Contributing to Raven

Raven is early — pre-1.0. The most useful contributions right now are on
the compiler core (`compiler/src`), not the framework or tooling layers,
since almost everything downstream depends on it.

## Where to start

1. Read the [README](./README.md) first — it explains *why* `model` and
   inferred `let`/`const` exist, which is the core design bet the rest of
   the compiler builds on.
2. If your change touches the type system (`compiler/src/typechecker`,
   `compiler/src/ast/nodes.ts`, or anything that changes what a program
   means, not just how it's written), read
   [`docs/type-intelligence-roadmap.md`](./docs/type-intelligence-roadmap.md)
   first. It lays out which problems the compiler should solve on its own
   vs. which genuinely need developer-facing syntax, and which order the
   underlying inference/flow/project machinery needs to land in. New type
   syntax proposed without reading this tends to get sent back for that
   reason, so it's worth the ten minutes.
3. Pick an open issue, or open one to propose a change if it's not listed.

## Local setup

```bash
git clone <your-fork-url>
cd raven/compiler
pnpm install
pnpm test                # run the vitest suite (lexer/parser/checker/emitter/optimizer)
pnpm build            # build the CLI + library
```

## Workflow

- Branch off `main`: `feature/<short-description>` or `fix/<short-description>`.
- Every change to `compiler/src/**` should come with a test in
  `compiler/tests/` (see `compiler/tests/parser.test.ts` for the pattern:
  tokenize → parse → assert on the AST shape, or `compiler/tests/optimizer.test.ts`
  for the source → optimize → emit → assert-on-JS pattern).
- Run `npm test` and `npx tsc --noEmit` in `compiler/` before opening a PR.
- If your change adds type-system surface area, answer the four questions
  in §6 of `docs/type-intelligence-roadmap.md` in your PR description.
- Update the relevant doc (`README.md`, `docs/`, or the roadmap doc) in the
  same PR if you're changing grammar or semantics — the docs and the parser
  should never drift apart.

## Commit style

Conventional-ish, not strictly enforced yet:
`feat(parser): support derived state declarations`
`fix(lexer): handle escaped quotes in string literals`
`docs(language): clarify task group cancellation semantics`

## Versioning

Uses [changesets](https://github.com/changesets/changesets). After a PR
that changes published package behavior:
```bash
pnpm changeset
```
and follow the prompts — don't hand-edit package versions.

## Code of conduct

Be direct about technical disagreements, kind about everything else. No
tolerance for personal attacks in issues/PRs/discussions.
