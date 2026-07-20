# Cross-package / integration tests

Unit tests live next to their source (e.g. `compiler/src/parser/parser.test.ts`).
This folder is for tests that span multiple packages — e.g. "compile an
example app end-to-end and assert on the emitted JS" once `compiler/src/emitter`
is implemented (see `language/roadmap.md` Phase 0).
