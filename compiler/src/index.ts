// src/index.ts
export { tokenize } from "./lexer/index.js";
export { Parser } from "./parser/index.js";
export { TypeChecker } from "./typechecker/checker.js";
export { Emitter } from "./emitter/emitter.js";
export * from "./diagnostics/index.js";
export * from "./formatter/index.js";
export { optimize } from "./optimizer/index.js";
