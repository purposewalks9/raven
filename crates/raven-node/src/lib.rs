//! `raven-node` — napi-rs bindings exposing `raven-core` to Node.js.
//!
//! Phase 2 moves the FFI boundary from "JSON AST in" to "source text in"
//! (`check_source`). The old `check_program` (JSON AST in) is kept only as a
//! deprecated shim until the TS side is fully switched; new code must use
//! `check_source` (diagnostics only, cheap for the CLI) and `bindings_for`
//! (bindings+types, lazily called by the language server).

use std::sync::Mutex;

use napi::{Error, Result, Status};
use napi_derive::napi;
use raven_core::ast::{Program, SourceLocation};
use raven_core::checker::{FunctionSignature, TypeChecker, TypeCheckerOptions};
use raven_core::diagnostics::{codes, Diagnostic, Severity};
use raven_core::registry::{PublishResult, WorkspaceRegistry};
use raven_core::type_::{LiteralValue, RavenType};
use serde_json::{json, Value};

fn jerr<E: std::fmt::Display>(err: E) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

/// Convert a `RavenType` to the TS `TypeAnnotation` JSON shape.
fn type_annotation_json(t: &RavenType) -> Value {
    match t {
        RavenType::String => json!("string"),
        RavenType::Number => json!("number"),
        RavenType::Boolean => json!("boolean"),
        RavenType::Any => json!("any"),
        RavenType::None => json!("none"),
        RavenType::Named(name) => json!(name),
        RavenType::Array { element_type } => json!({
            "kind": "array",
            "elementType": type_annotation_json(element_type),
        }),
        RavenType::Record { fields } => {
            let fields: serde_json::Map<String, Value> = fields
                .iter()
                .map(|(name, ty)| (name.clone(), type_annotation_json(ty)))
                .collect();
            json!({ "kind": "record", "fields": fields })
        }
        RavenType::Optional { inner } => json!({
            "kind": "optional",
            "inner": type_annotation_json(inner),
        }),
        RavenType::Union { variants } => json!({
            "kind": "union",
            "variants": variants.iter().map(type_annotation_json).collect::<Vec<_>>(),
        }),
        RavenType::Function {
            params,
            return_type,
        } => json!({
            "kind": "function",
            "params": params.iter().map(type_annotation_json).collect::<Vec<_>>(),
            "returnType": type_annotation_json(return_type),
        }),
        RavenType::Literal { value } => json!({
            "kind": "literal",
            "value": match value {
                LiteralValue::String(s) => json!(s),
                LiteralValue::Number(n) => json!(n),
                LiteralValue::Boolean(b) => json!(b),
            },
        }),
        RavenType::Tuple { elements } => json!({
            "kind": "tuple",
            "elements": elements.iter().map(type_annotation_json).collect::<Vec<_>>(),
        }),
        RavenType::Ref { name } => json!({ "kind": "ref", "name": name }),
    }
}

fn raven_type_from_json(value: &Value) -> Result<RavenType> {
    serde_json::from_value::<raven_core::ast::TypeAnnotation>(value.clone())
        .map(Into::into)
        .map_err(jerr)
}

fn source_location_json(loc: &SourceLocation) -> Value {
    json!({
        "file": loc.file,
        "line": loc.line,
        "column": loc.column,
        "start": loc.start,
        "end": loc.end,
    })
}

fn binding_json(binding: &raven_core::binder::SymbolBinding) -> Value {
    let mut value = json!({
        "name": binding.name(),
        "kind": binding.kind().as_str(),
        "type": type_annotation_json(binding.type_()),
        "origin": binding.origin().as_str(),
        "declaration": source_location_json(binding.declaration()),
        "references": binding.references().iter().map(source_location_json).collect::<Vec<_>>(),
    });
    if let Some(source) = binding.source() {
        value["source"] = json!(source);
    }
    value
}

fn bindings_json(bindings: &[raven_core::binder::SymbolBinding]) -> Value {
    Value::Array(bindings.iter().map(binding_json).collect())
}

fn published_model_json(model: &raven_core::registry::PublishedModel) -> Value {
    json!({
        "name": model.name,
        "type": type_annotation_json(&model.type_),
        "external": model.external,
        "file": model.file,
        "location": source_location_json(&model.location),
    })
}

fn publish_result_json(result: PublishResult) -> Value {
    match result {
        PublishResult::Ok => json!({ "ok": true }),
        PublishResult::Err { message, existing } => json!({
            "ok": false,
            "message": message,
            "existing": published_model_json(&existing),
        }),
    }
}

/// A shared, mutable workspace registry.
#[napi]
pub struct Registry {
    inner: Mutex<WorkspaceRegistry>,
}

#[napi]
impl Registry {
    #[napi(constructor)]
    #[must_use]
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(WorkspaceRegistry::new()),
        }
    }

    /// Publish a model under `name`, mirroring `WorkspaceRegistry.publish`.
    ///
    /// # Example
    ///
    /// ```js
    /// const { Registry } = require("raven-node");
    /// const registry = new Registry();
    /// const result = JSON.parse(registry.publish(
    ///   "User", JSON.stringify({ kind: "record", fields: { id: "number" } }),
    ///   false, "models.rv", JSON.stringify({ file: "models.rv", start: 0, end: 4 })
    /// ));
    /// result.ok; // true
    /// ```
    #[napi]
    pub fn publish(
        &self,
        name: String,
        type_json: String,
        external: bool,
        file: String,
        location_json: String,
    ) -> Result<String> {
        let type_ = raven_type_from_json(&serde_json::from_str(&type_json).map_err(jerr)?)?;
        let location = serde_json::from_str(&location_json).map_err(jerr)?;
        let result = self.lock().publish(name, type_, external, file, location);
        serde_json::to_string(&publish_result_json(result)).map_err(jerr)
    }

    /// Look up a published model by name.
    #[napi]
    pub fn lookup(&self, name: String) -> Result<Option<String>> {
        let guard = self.lock();
        match guard.lookup(&name) {
            Some(model) => serde_json::to_string(&published_model_json(model))
                .map(Some)
                .map_err(jerr),
            None => Ok(None),
        }
    }

    /// Every published model.
    #[napi]
    pub fn all(&self) -> Result<Vec<String>> {
        let guard = self.lock();
        guard
            .all()
            .iter()
            .map(|model| serde_json::to_string(&published_model_json(model)).map_err(jerr))
            .collect()
    }

    /// Every published model name.
    #[napi]
    pub fn names(&self) -> Result<Vec<String>> {
        Ok(self.lock().names())
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, WorkspaceRegistry> {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

fn function_signature_json(sig: &FunctionSignature) -> Value {
    json!({
        "params": sig.params.iter().map(type_annotation_json).collect::<Vec<_>>(),
        "returnType": type_annotation_json(&sig.return_type),
    })
}

fn build_options(
    options: &Option<String>,
    registry: Option<WorkspaceRegistry>,
) -> Result<TypeCheckerOptions> {
    let mut opts = TypeCheckerOptions {
        registry,
        ..TypeCheckerOptions::default()
    };
    let Some(options) = options else {
        return Ok(opts);
    };
    let parsed: Value = serde_json::from_str(options).map_err(jerr)?;
    if let Some(file) = parsed.get("file").and_then(Value::as_str) {
        opts.file = Some(file.to_string());
    }
    if let Some(imports) = parsed.get("importedFunctions").and_then(Value::as_object) {
        for (name, sig) in imports {
            let params = sig
                .get("params")
                .and_then(Value::as_array)
                .ok_or_else(|| jerr(format!("imported function '{name}' missing 'params'")))?;
            let return_type = sig
                .get("returnType")
                .ok_or_else(|| jerr(format!("imported function '{name}' missing 'returnType'")))?;
            let params = params
                .iter()
                .map(raven_type_from_json)
                .collect::<Result<Vec<_>>>()?;
            opts.imported_functions.insert(
                name.clone(),
                FunctionSignature {
                    params,
                    return_type: raven_type_from_json(return_type)?,
                },
            );
        }
    }
    Ok(opts)
}

fn parse_error_diagnostic(
    message: String,
    file: &str,
    location: Option<SourceLocation>,
) -> Diagnostic {
    let loc = location.unwrap_or(SourceLocation {
        file: file.to_string(),
        line: 1,
        column: 1,
        start: 0,
        end: 0,
    });
    Diagnostic {
        code: codes::PARSE_ERROR.to_string(),
        severity: Severity::Error,
        message,
        location: loc,
        hint: None,
        suggestions: None,
    }
}

/// Check source text directly (Phase 2 boundary: source in, diagnostics out).
///
/// This is the new FFI contract — no JSON AST crosses the boundary. The
/// TypeScript `tokenize` + `Parser` step is now inside `raven-core`.
///
/// Returns `{"diagnostics": [...]}`. Bindings/types are intentionally not
/// included — the CLI path never needs them. Call `bindings_for` when hover/
/// go-to-def data is required.
///
/// # Example
///
/// ```js
/// const { checkSource, Registry } = require("raven-node");
/// const registry = new Registry();
/// const result = JSON.parse(checkSource(
///   'let x = "hi"',
///   "hello.rv",
///   JSON.stringify({ file: "hello.rv" }),
///   registry,
/// ));
/// result.diagnostics; // []
/// ```
#[napi]
pub fn check_source(
    source: String,
    file: String,
    options: Option<String>,
    registry: Option<&Registry>,
) -> Result<String> {
    // Tokenize with location-aware error handling to produce a diagnostic
    let tokens = match raven_core::lexer::tokenize(&source, &file) {
        Ok(t) => t,
        Err(e) => {
            let diag = parse_error_diagnostic(e.message, &file, Some(e.location));
            let diagnostics_json = serde_json::to_value(vec![diag]).map_err(jerr)?;
            return serde_json::to_string(&json!({ "diagnostics": diagnostics_json }))
                .map_err(jerr);
        }
    };
    let mut parser = raven_core::parser::Parser::new(tokens);
    let program = match parser.parse_program() {
        Ok(p) => p,
        Err(e) => {
            let diag = parse_error_diagnostic(e.0, &file, None);
            let diagnostics_json = serde_json::to_value(vec![diag]).map_err(jerr)?;
            return serde_json::to_string(&json!({ "diagnostics": diagnostics_json }))
                .map_err(jerr);
        }
    };

    let mut shared = registry.map(|reg| reg.lock());
    let detached = shared.as_mut().map(|guard| std::mem::take(&mut **guard));
    let checker_options = build_options(&options, detached)?;

    let mut checker = TypeChecker::new(checker_options);
    let diagnostics = checker.check(&program);
    let diagnostics_json: Value = serde_json::to_value(&diagnostics).map_err(jerr)?;

    if let Some(mut guard) = shared {
        if let Some(reg) = checker.take_registry() {
            *guard = reg;
        }
    }

    serde_json::to_string(&json!({ "diagnostics": diagnostics_json })).map_err(jerr)
}

/// Lazily fetch bindings and exported types for a file.
///
/// The CLI `compileFile` path never needs per-symbol bindings — only the
/// language server's hover/go-to-def does. Calling this separately avoids
/// building the 53–63 KB `bindings` JSON on every `check_source` call, which
/// was ~50% of the Phase 1 medium-file cost (`phase1-ffi-analysis.md:22`).
///
/// Returns `{"bindings": [...], "types": {...}, "diagnostics": [...]}`.
/// Diagnostics are included so the caller does not need to call both
/// `check_source` and `bindings_for` to get hover data on a file with errors.
///
/// # Example
///
/// ```js
/// const { bindingsFor, Registry } = require("raven-node");
/// const registry = new Registry();
/// const result = JSON.parse(bindingsFor(
///   'let x = 1',
///   "x.rv",
///   JSON.stringify({ file: "x.rv" }),
///   registry,
/// ));
/// result.bindings; // [{ name: "x", ... }]
/// ```
#[napi(js_name = "bindingsFor")]
pub fn bindings_for(
    source: String,
    file: String,
    options: Option<String>,
    registry: Option<&Registry>,
) -> Result<String> {
    let tokens = match raven_core::lexer::tokenize(&source, &file) {
        Ok(t) => t,
        Err(e) => {
            let diag = parse_error_diagnostic(e.message, &file, Some(e.location));
            let diagnostics_json = serde_json::to_value(vec![diag]).map_err(jerr)?;
            return serde_json::to_string(&json!({
                "diagnostics": diagnostics_json,
                "bindings": Value::Array(vec![]),
                "types": json!({}),
            }))
            .map_err(jerr);
        }
    };
    let mut parser = raven_core::parser::Parser::new(tokens);
    let program = match parser.parse_program() {
        Ok(p) => p,
        Err(e) => {
            let diag = parse_error_diagnostic(e.0, &file, None);
            let diagnostics_json = serde_json::to_value(vec![diag]).map_err(jerr)?;
            return serde_json::to_string(&json!({
                "diagnostics": diagnostics_json,
                "bindings": Value::Array(vec![]),
                "types": json!({}),
            }))
            .map_err(jerr);
        }
    };

    let mut shared = registry.map(|reg| reg.lock());
    let detached = shared.as_mut().map(|guard| std::mem::take(&mut **guard));
    let checker_options = build_options(&options, detached)?;

    let mut checker = TypeChecker::new(checker_options);
    let diagnostics = checker.check(&program);
    let bindings = bindings_json(checker.binder().all());
    let exported: serde_json::Map<String, Value> = checker
        .exported_functions()
        .iter()
        .map(|(name, sig)| (name.clone(), function_signature_json(sig)))
        .collect();
    let diagnostics_json: Value = serde_json::to_value(&diagnostics).map_err(jerr)?;

    if let Some(mut guard) = shared {
        if let Some(reg) = checker.take_registry() {
            *guard = reg;
        }
    }

    serde_json::to_string(&json!({
        "diagnostics": diagnostics_json,
        "bindings": bindings,
        "types": exported,
    }))
    .map_err(jerr)
}

/// Deprecated Phase 1 entry: JSON AST in → diagnostics+bindings+types out.
///
/// Kept only for the differential harness that tests checker-in-isolation
/// (AST-in). New code must use `check_source` / `bindings_for`. This will be
/// deleted once the TS side no longer calls it — no two live paths past this
/// PR (AGENTS.md phase discipline).
#[napi]
pub fn check_program(
    ast: String,
    options: Option<String>,
    registry: Option<&Registry>,
) -> Result<String> {
    let program: Program = serde_json::from_str(&ast).map_err(jerr)?;

    let mut shared = registry.map(|reg| reg.lock());
    let detached = shared.as_mut().map(|guard| std::mem::take(&mut **guard));
    let checker_options = build_options(&options, detached)?;

    let mut checker = TypeChecker::new(checker_options);
    let diagnostics = checker.check(&program);
    let bindings = bindings_json(checker.binder().all());
    let exported: serde_json::Map<String, Value> = checker
        .exported_functions()
        .iter()
        .map(|(name, sig)| (name.clone(), function_signature_json(sig)))
        .collect();
    let diagnostics_json: Value = serde_json::to_value(&diagnostics).map_err(jerr)?;

    if let Some(mut guard) = shared {
        if let Some(reg) = checker.take_registry() {
            *guard = reg;
        }
    }

    serde_json::to_string(&json!({
        "diagnostics": diagnostics_json,
        "bindings": bindings,
        "types": exported,
    }))
    .map_err(jerr)
}
