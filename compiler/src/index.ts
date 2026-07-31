// src/index.ts
export { tokenize } from "./lexer/index.js";
export { Parser } from "./parser/index.js";
export { TypeChecker } from "./typechecker/checker.js";
export { Emitter } from "./emitter/emitter.js";
export * from "./diagnostics/index.js";
export * from "./formatter/index.js";
export { optimize } from "./optimizer/index.js";
// ADDED: the API surface the language server needs. checkSource is the
// in-memory entry point (source string -> diagnostics + binder); Binder
// and SymbolBinding are its query result types.
export { checkSource } from "./cli/pipeline.js";
export type { CheckResult } from "./cli/pipeline.js";
export { Binder } from "./typechecker/binder.js";
export type { SymbolBinding, SymbolKind } from "./typechecker/binder.js";
export type { TypeAnnotation } from "./ast/nodes.js";
export type { SourceLocation } from "./ast/nodes.js";
export { buildProject } from "./project/project.js";
export type { ProjectResult, ProjectFile, ProjectDiagnostic } from "./project/project.js";
export { WorkspaceRegistry } from "./typechecker/registry.js";
export type { PublishedModel } from "./typechecker/registry.js";