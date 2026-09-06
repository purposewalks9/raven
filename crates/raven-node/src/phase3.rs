//! Phase 3 FFI additions for `raven-node`.
//!
//! I don't have your actual `crates/raven-node/src/lib.rs` in this session
//! (no repo checked out here), so this is a **new file** you merge in
//! rather than a diff against your real one. It follows the JSON-string
//! in/out convention described for `check_source`/`bindings_for`: every
//! function takes/returns `String` (serde_json underneath), so the napi
//! binding surface doesn't need typed structs on the Rust side.
//!
//! To wire this in:
//!   1. Drop this file in as `crates/raven-node/src/phase3.rs`.
//!   2. Add `mod phase3;` to your existing `lib.rs`.
//!   3. Add `pub use phase3::*;` (or re-export individually) if your existing
//!      `lib.rs` doesn't already glob-export submodules.
//!   4. Confirm the `raven_core::` paths below match your actual module
//!      layout — I've matched them to the `lib.rs` snippet you pasted
//!      earlier (`ast`, `optimizer`, `emitter`, `sourcemap`, `parser`,
//!      `lexer`, `checker`, `registry`), but I can't compile-check this
//!      against your real `raven-core::ast` types (`Program`, etc.) since
//!      I don't have that file. If a field/type name is off, it should be
//!      a one-line fix, not a redesign — the shape is right even if a name
//!      isn't.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use raven_core::ast::Program;
use raven_core::emitter::{Emitter, EmitWithSourceMapOptions};
use raven_core::optimizer::optimize;

/// Options accepted by `emit_program`, matching the TS caller's
/// `{ sourceMap, sourceFile, sourceContent }` shape.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EmitOptionsInput {
    #[serde(default)]
    source_map: bool,
    #[serde(default)]
    source_file: Option<String>,
    #[serde(default)]
    source_content: Option<String>,
}

/// Result shape returned by `emit_program`: `{ code, map }`. `map` is the
/// raw source-map JSON (already a JSON *value*, not a re-escaped string),
/// or `null` when `sourceMap` wasn't requested.
#[derive(Debug, Serialize)]
struct EmitResultOutput {
    code: String,
    map: Option<serde_json::Value>,
}

/// Runs the optimizer over a serialized AST and returns the optimized AST,
/// still serialized. Mirrors calling `optimize()` in
/// `compiler/src/optimizer/index.ts`.
///
/// ```ignore
/// const optimizedJson = optimizeProgram(JSON.stringify(ast));
/// const optimized = JSON.parse(optimizedJson);
/// ```
#[napi]
pub fn optimize_program(ast_json: String) -> Result<String> {
    let program: Program = serde_json::from_str(&ast_json)
        .map_err(|e| Error::from_reason(format!("invalid AST JSON: {e}")))?;
    let optimized = optimize(&program);
    serde_json::to_string(&optimized)
        .map_err(|e| Error::from_reason(format!("failed to serialize optimized AST: {e}")))
}

/// Emits JS (and optionally a source map) from a serialized AST. Mirrors
/// `Emitter#emit` / `Emitter#emitWithSourceMap` in `emitter/emitter.ts`.
///
/// `options_json`, when present, deserializes to
/// `{ sourceMap?: boolean, sourceFile?: string, sourceContent?: string }`.
/// Returns `{ code: string, map: object | null }` as a JSON string.
///
/// ```ignore
/// const resultJson = emitProgram(JSON.stringify(ast), JSON.stringify({
///   sourceMap: true,
///   sourceFile: "main.rv",
/// }));
/// const { code, map } = JSON.parse(resultJson);
/// ```
#[napi]
pub fn emit_program(ast_json: String, options_json: Option<String>) -> Result<String> {
    let program: Program = serde_json::from_str(&ast_json)
        .map_err(|e| Error::from_reason(format!("invalid AST JSON: {e}")))?;

    let options: EmitOptionsInput = match options_json {
        Some(raw) => serde_json::from_str(&raw)
            .map_err(|e| Error::from_reason(format!("invalid options JSON: {e}")))?,
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
        let map_value = serde_json::to_value(result.map.to_raw(None))
            .map_err(|e| Error::from_reason(format!("failed to serialize source map: {e}")))?;
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

    serde_json::to_string(&output)
        .map_err(|e| Error::from_reason(format!("failed to serialize emit result: {e}")))
}

/// Full pipeline in one native call: lex + parse + check + optimize + emit.
/// This is the Phase 3 goal call — it's what lets `compileFile` stop
/// round-tripping the AST across the FFI boundary (and stop re-parsing in
/// TS at all).
///
/// `options_json` mirrors `emit_program`'s options. `registry_json`, if your
/// `WorkspaceRegistry` has a serializable form, should be that; if cross-file
/// `model` resolution needs a live registry object rather than a snapshot,
/// this signature will need a real (non-JSON) registry handle instead — I
/// don't have `registry.rs` here to confirm which. Flagging rather than
/// guessing wrong.
///
/// Returns `{ diagnostics: [...], code: string | null, map: object | null }`
/// as a JSON string. `code`/`map` are `null` when there are blocking
/// diagnostics (mirrors the existing `compileFile` short-circuit behavior).
///
/// ```ignore
/// const resultJson = compileSource(source, "main.rv", JSON.stringify({
///   sourceMap: true,
/// }), registryJson);
/// const { diagnostics, code, map } = JSON.parse(resultJson);
/// ```
#[napi]
pub fn compile_source(
    source: String,
    file: String,
    options_json: Option<String>,
    registry_json: Option<String>,
) -> Result<String> {
    // NOTE: lexer/parser/checker entry points below are named to match the
    // module list you pasted (`lexer`, `parser`, `checker`, `registry`), but
    // I don't have those files' actual function signatures in this session,
    // so the calls are written as the most likely shape (`lex(&str)`,
    // `parse(tokens)`, `check(&Program, &Registry)`), not verified against
    // your real code. This is the one function in this file you should
    // read closely before trusting — the FFI plumbing around it (JSON in,
    // JSON out, error mapping) is solid either way.
    let _ = registry_json; // wire through to `checker`/`registry` once their real signature is confirmed

    let tokens = raven_core::lexer::lex(&source)
        .map_err(|e| Error::from_reason(format!("lex error: {e}")))?;
    let program = raven_core::parser::parse(tokens, &file)
        .map_err(|e| Error::from_reason(format!("parse error: {e}")))?;

    let diagnostics = raven_core::checker::check(&program)
        .map_err(|e| Error::from_reason(format!("check error: {e}")))?;

    let has_blocking = diagnostics.iter().any(|d| d.is_error());

    let (code, map) = if has_blocking {
        (None, None)
    } else {
        let optimized = optimize(&program);
        let options: EmitOptionsInput = match options_json {
            Some(raw) => serde_json::from_str(&raw)
                .map_err(|e| Error::from_reason(format!("invalid options JSON: {e}")))?,
            None => EmitOptionsInput::default(),
        };
        let mut emitter = Emitter::new();
        if options.source_map {
            let result = emitter.emit_with_source_map(
                &optimized,
                EmitWithSourceMapOptions {
                    source_file: options.source_file.unwrap_or(file),
                    generated_file: None,
                    source_content: options.source_content,
                },
            );
            let map_value = serde_json::to_value(result.map.to_raw(None))
                .map_err(|e| Error::from_reason(format!("failed to serialize source map: {e}")))?;
            (Some(result.code), Some(map_value))
        } else {
            (Some(emitter.emit(&optimized)), None)
        }
    };

    #[derive(Serialize)]
    struct CompileResultOutput {
        diagnostics: Vec<serde_json::Value>,
        code: Option<String>,
        map: Option<serde_json::Value>,
    }

    let diagnostics_json: Vec<serde_json::Value> = diagnostics
        .iter()
        .map(|d| serde_json::to_value(d).unwrap_or(serde_json::Value::Null))
        .collect();

    serde_json::to_string(&CompileResultOutput {
        diagnostics: diagnostics_json,
        code,
        map,
    })
    .map_err(|e| Error::from_reason(format!("failed to serialize compile result: {e}")))
}
