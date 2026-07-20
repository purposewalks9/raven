# Contributing to Nova

Nova is early — pre-Phase-0-complete (see `language/roadmap.md`). The most
useful contributions right now are on the compiler core, not the framework
or tooling layers, since almost everything downstream depends on it.

## Where to start

1. Read `language/specification.md` and `language/syntax.md` first —
   they explain *why* the grammar looks the way it does.
2. Check `language/roadmap.md` for the current phase and open questions.
3. Pick an unchecked item from the current phase, or open an issue to
   propose one if it's not listed.

## Local setup

```bash
git clone <your-fork-url>
cd nova
pnpm install
cd compiler && pnpm test        # run the parser test suite
pnpm build                       # build the compiler + packages
```

## Workflow

- Branch off `main`: `feature/<short-description>` or `fix/<short-description>`.
- Every change to `compiler/src/**` should come with a test in the same
  folder (see `compiler/src/parser/parser.test.ts` for the pattern:
  tokenize → parse → assert on the AST shape).
- Run `pnpm test` and `npx tsc --noEmit` in the affected package before
  opening a PR — CI (`.github/workflows/ci.yml`) runs both on every push.
- Update the relevant `language/*.md` doc in the same PR if you're changing
  grammar or semantics — the docs and the parser should never drift apart.

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
