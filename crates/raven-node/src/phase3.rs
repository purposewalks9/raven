//! Phase 3 FFI additions for `raven-node`: expose `raven-core`'s optimizer,
//! emitter and source-map generator to Node.
//!
//! Follows the same conventions as `check_source`/`bindings_for` in
//! `lib.rs`: JSON string in, JSON string out, errors mapped through the
//! same `Error::new(Status::GenericFailure, ...)` shape (mirrored here as
//! a local `jerr`, since the one in `lib.rs` is private to that module).

use napi::{Error, Result, Status};
use napi_derive::napi;
use raven_core::ast::Program;
use raven_core::emitter::{Emitter, EmitWithSourceMapOptions};
use raven_core::optimizer::optimize;
use serde::{Deserialize, Serialize};
use serde_json::Value;

fn jerr<E: std::fmt::Display>(err: E) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

/// Options accepted by `emit_program`, matching the TS
/// `EmitWithSourceMapOptions` shape (`{ sourceMap, sourceFile, sourceContent }`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EmitOptionsInput {
    #[serde(default)]
    source_map: bool,
    #[serde(default)]
    source_file: Option<String>,
    #[serde(default)]
    source_content: Option<String>,
    /// Only read by `compile_source` — `emit_program` has no optimize step
    /// of its own (the caller passes in whatever AST it wants emitted).
    /// Mirrors `compileFile`'s `shouldOptimize` parameter in `pipeline.ts`
    /// (default `true`, e.g. `raven check` passes `false`).
    #[serde(default = "default_true")]
    optimize: bool,
}

fn default_true() -> bool {
    true
}

impl Default for EmitOptionsInput {
    fn default() -> Self {
        Self {
            source_map: false,
            source_file: None,
            source_content: None,
            optimize: true,
        }
    }
}

/// Result shape returned by `emit_program`: `{ code, map }`. `map` is the
/// raw source-map JSON *value* (not re-escaped), or `null` when `sourceMap`
/// wasn't requested.
#[derive(Debug, Serialize)]
struct EmitResultOutput {
    code: String,
    map: Option<Value>,
}

/// Runs the optimizer over a serialized AST and returns the optimized AST,
/// still serialized. Mirrors `optimize()` in `compiler/src/optimizer/index.ts`.
///
/// Note the one intentional behavior difference from the pre-port TS
/// implementation, documented in `raven_core::optimizer`'s module doc
/// comment: `ModelDeclaration`/`ImportDeclaration` statements are preserved
/// instead of being silently dropped (a real bug in the TS switch, which has
/// no case and no default for those two variants).
///
/// # Example
/// ```js
/// const { optimizeProgram } = require("raven-node");
/// const optimizedJson = optimizeProgram(JSON.stringify(ast));
/// const optimized = JSON.parse(optimizedJson);
/// ```
#[napi(js_name = "optimizeProgram")]
pub fn optimize_program(ast_json: String) -> Result<String> {
    let program: Program = serde_json::from_str(&ast_json).map_err(jerr)?;
    let optimized = optimize(&program);
    serde_json::to_string(&optimized).map_err(jerr)
}

/// Emits JS (and optionally a v3 source map) from a serialized AST. Mirrors
/// `Emitter#emit` / `Emitter#emitWithSourceMap` in `emitter/emitter.ts`.
///
/// `options_json`, when present, deserializes to
/// `{ sourceMap?: boolean, sourceFile?: string, sourceContent?: string }`.
/// Returns `JSON.stringify({ code, map })` — `map` is `null` unless
/// `sourceMap: true` was passed.
///
/// # Example
/// ```js
/// const { emitProgram } = require("raven-node");
/// const resultJson = emitProgram(JSON.stringify(ast), JSON.stringify({
///   sourceMap: true,
///   sourceFile: "main.rv",
/// }));
/// const { code, map } = JSON.parse(resultJson);
/// ```
#[napi(js_name = "emitProgram")]
pub fn emit_program(ast_json: String, options_json: Option<String>) -> Result<String> {
    let program: Program = serde_json::from_str(&ast_json).map_err(jerr)?;
    let options: EmitOptionsInput = match options_json {
        Some(raw) => serde_json::from_str(&raw).map_err(jerr)?,
        None => EmitOptionsInput::default(),
    };

    let mut emitter = Emitter::new();

    let output = if options.source_map {
        let result = emitter.emit_with_source_map(
            &program,
            EmitWithSourceMapOptions {
                source_file: options.source_file.unwrap_or_else(|| "<unknown>".to_string()),
                generated_file: None,
                source_content: options.source_content,
            },
        );
        let map_value = serde_json::to_value(result.map.to_raw(None)).map_err(jerr)?;
        EmitResultOutput {
            code: result.code,
            map: Some(map_value),
        }
    } else {
        EmitResultOutput {
            code: emitter.emit(&program),
            map: None,
        }
    };

    serde_json::to_string(&output).map_err(jerr)
}

/// Full pipeline in one native call: lex + parse + check + optimize + emit.
/// This is the Phase 3 goal call — it lets `compileFile` stop parsing the
/// source twice (once in TS for `optimize`/`Emitter`, once in Rust for
/// diagnostics — see the comment on `compileFile` in `cli/pipeline.ts`).
///
/// `options_json` mirrors `emit_program`'s options. `registry` is the same
/// shared `Registry` object `check_source`/`bindings_for` already take —
/// cross-file `model` resolution goes through it exactly the same way.
///
/// Returns `JSON.stringify({ diagnostics, code, map })`. `code`/`map` are
/// `null` when there's at least one error-severity diagnostic, mirroring
/// `compileFile`'s existing short-circuit (`diagnostics.some(d => d.severity
/// === "error")`).
///
/// # Example
/// ```js
/// const { compileSource, Registry } = require("raven-node");
/// const registry = new Registry();
/// const resultJson = compileSource(source, "main.rv", JSON.stringify({
///   sourceMap: true,
///   sourceFile: "main.rv",
/// }), registry);
/// const { diagnostics, code, map } = JSON.parse(resultJson);
/// ```
#[napi(js_name = "compileSource")]
pub fn compile_source(
    source: String,
    file: String,
    options_json: Option<String>,
    registry: Option<&crate::Registry>,
) -> Result<String> {
    let tokens = raven_core::lexer::tokenize(&source, &file)
        .map_err(|e| jerr(format!("lex error: {}", e.message)))?;
    let mut parser = raven_core::parser::Parser::new(tokens);
    let program = parser
        .parse_program()
        .map_err(|e| jerr(format!("parse error: {}", e.0)))?;

    let mut shared = registry.map(crate::Registry::lock);
    let detached = shared.as_mut().map(|guard| std::mem::take(&mut **guard));

    let options: EmitOptionsInput = match &options_json {
        Some(raw) => serde_json::from_str(raw).map_err(jerr)?,
        None => EmitOptionsInput::default(),
    };

    let checker_options = raven_core::checker::TypeCheckerOptions {
        file: Some(file.clone()),
        registry: detached,
        ..raven_core::checker::TypeCheckerOptions::default()
    };
    let mut checker = raven_core::checker::TypeChecker::new(checker_options);
    let diagnostics = checker.check(&program);
    let has_error = diagnostics
        .iter()
        .any(|d| d.severity == raven_core::diagnostics::Severity::Error);

    if let Some(mut guard) = shared {
        if let Some(reg) = checker.take_registry() {
            *guard = reg;
        }
    }

    let (code, map) = if has_error {
        (None, None)
    } else {
        let optimized = if options.optimize {
            optimize(&program)
        } else {
            program
        };
        let mut emitter = Emitter::new();
        if options.source_map {
            let result = emitter.emit_with_source_map(
                &optimized,
                EmitWithSourceMapOptions {
                    source_file: options.source_file.unwrap_or_else(|| file.clone()),
                    generated_file: None,
                    source_content: options.source_content,
                },
            );
            let map_value = serde_json::to_value(result.map.to_raw(None)).map_err(jerr)?;
            (Some(result.code), Some(map_value))
        } else {
            (Some(emitter.emit(&optimized)), None)
        }
    };

    #[derive(Serialize)]
    struct CompileResultOutput {
        diagnostics: Value,
        code: Option<String>,
        map: Option<Value>,
    }

    let diagnostics_json = serde_json::to_value(&diagnostics).map_err(jerr)?;

    serde_json::to_string(&CompileResultOutput {
        diagnostics: diagnostics_json,
        code,
        map,
    })
    .map_err(jerr)
}
