# Raven

> A modern programming language for the web with built-in type inference, zero TypeScript, and seamless JavaScript interoperability.

> **Status:** 🚧 Early Development (Compiler under active development)

---

## Why Raven?

JavaScript changed the web, but as applications grew, developers needed additional tools like TypeScript, ESLint, Prettier, Babel, and various frameworks to improve safety and developer experience.

Raven aims to provide a cleaner alternative by making these ideas part of the language itself.

The goals are simple:

* 🧠 Smart by default.
* ✨ Easy to read.
* 🔒 Safer than JavaScript.
* ⚡ Fast compilation.
* 🌍 Built for the modern web.
* ♻️ 100% JavaScript interoperability.

Write Raven.

Compile to JavaScript.

Run anywhere JavaScript runs.

---

# Example

### Raven

```raven
let name = "Raven"
let version = 1

if version >= 1
    print "Welcome to {name}"
end
```

### Compiled JavaScript

```javascript
const name = "Raven";
const version = 1;

if (version >= 1) {
    console.log(`Welcome to ${name}`);
}
```

---

# Philosophy

Raven is built around a few principles:

* Readability over clever syntax.
* Strong type inference without requiring TypeScript.
* Minimal punctuation.
* Helpful compiler diagnostics.
* Seamless access to the JavaScript ecosystem.
* Great developer experience out of the box.

---

# Features

### Language

* Variables
* Constants
* Functions
* Conditionals
* Loops
* Modules
* Pattern Matching
* Async/Await
* Type Inference
* Null Safety
* Standard Library

---

### Compiler

* Lexer
* Parser
* AST
* Semantic Analysis
* Type Checker
* Optimizer
* JavaScript Emitter

---

### CLI

```bash
raven new
raven run
raven build
raven test
raven format
raven add
raven publish
```

---

### Tooling

* Formatter
* Linter
* Language Server
* VS Code Extension
* Testing Framework
* Package Manager

---

### Web

Raven compiles directly to JavaScript, allowing applications to run in browsers, Node.js, Bun, Deno, and other JavaScript runtimes.

Future plans include a dedicated UI framework built specifically for Raven.

---

# Project Structure

```
raven/
│
├── lexer/
├── parser/
├── ast/
├── semantic/
├── optimizer/
├── emitter/
├── cli/
├── std/
├── tests/
└── docs/
```

---

# Roadmap

## Phase 1 — Compiler

* [ ] Lexer
* [ ] Parser
* [ ] AST
* [ ] JavaScript Emitter
* [ ] Error Reporting

## Phase 2 — Language

* [ ] Variables
* [ ] Functions
* [ ] Modules
* [ ] Loops
* [ ] Pattern Matching
* [ ] Type Inference

## Phase 3 — Developer Experience

* [ ] CLI
* [ ] Formatter
* [ ] Linter
* [ ] Testing Framework
* [ ] Standard Library

## Phase 4 — Ecosystem

* [ ] Package Manager
* [ ] Documentation
* [ ] VS Code Extension
* [ ] Language Server
* [ ] Playground

## Phase 5 — UI

* [ ] Raven UI Framework
* [ ] Reactive Components
* [ ] Hot Reloading
* [ ] Server-Side Rendering
* [ ] Static Site Generation

---

# Long-Term Vision

Raven is not intended to replace JavaScript.

Instead, it aims to become a better way to write applications that ultimately run on the JavaScript ecosystem.

The vision is to combine the simplicity of modern languages with the reach of JavaScript, giving developers a safer, cleaner, and more productive experience without sacrificing compatibility.

---

# Contributing

Raven is in its earliest stages of development.

Contributions, ideas, bug reports, and discussions are welcome as the language evolves.

---

# License

MIT License.
