//! `raven-node` — napi-rs bindings exposing `raven-core`'s typechecker to
//! Node.js.
//!
//! This crate is the native half of the Phase 1 typechecker port. The
//! TypeScript side (`compiler/src/typechecker/`) becomes a thin wrapper that
//! feeds the parser's JSON AST into [`check_program`] and receives back
//! diagnostics, symbol bindings and exported signatures as JSON.

use std::sync::Mutex;

use napi::{Error, Result, Status};
use napi_derive::napi;
use raven_core::ast::{Program, SourceLocation};
use raven_core::checker::{FunctionSignature, TypeChecker, TypeCheckerOptions};
use raven_core::registry::{PublishResult, WorkspaceRegistry};
use raven_core::type_::{LiteralValue, RavenType};
use serde_json::{json, Value};

fn jerr<E: std::fmt::Display>(err: E) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

/// Convert a `RavenType` to the TS `TypeAnnotation` JSON shape — the
/// string-or-object union the compiler and LSP already consume: primitives
/// serialize as bare strings, structural kinds as `{ "kind": ... }`.
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

/// Convert an interning-id-free `RavenType` value lying inside a `Value`
/// produced by JSON parsing (used for `importedFunctions` and registry
/// publishes) into a `RavenType`.
///
/// Reuses `TypeAnnotation`'s `Deserialize` implementation, which accepts both
/// the plain-string primitive form and the tagged structural objects.
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

/// A shared, mutable workspace registry, mirroring the TS `WorkspaceRegistry`.
///
/// Host bindings pass one `Registry` instance into successive
/// [`check_program`] calls so models published while checking one file are
/// visible while checking the next — exactly how `project.ts` shares a single
/// registry across every file in the project.
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

    /// Look up a published model by name, mirroring `WorkspaceRegistry.lookup`.
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

    /// Every published model, mirroring `WorkspaceRegistry.all`.
    #[napi]
    pub fn all(&self) -> Result<Vec<String>> {
        let guard = self.lock();
        guard
            .all()
            .iter()
            .map(|model| serde_json::to_string(&published_model_json(model)).map_err(jerr))
            .collect()
    }

    /// Every published model name, mirroring `WorkspaceRegistry.names`.
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

/// Typecheck a single program given its JSON AST. Mirrors the TS
/// `TypeChecker.check` + `getBinder` + `getExportedFunctions` combo and the
/// `checkSource` contract in `cli/pipeline.ts`.
///
/// Returns a JSON object:
///
/// ```json
/// {
///   "diagnostics": [{ "code": "RAV1001", "severity": "error", ... }],
///   "bindings": [{ "name": "x", "kind": "variable", "type": "number", ... }],
///   "types": { "foo": { "params": ["string"], "returnType": "number" } }
/// }
/// ```
///
/// When a [`Registry`] instance is supplied, the same registry is shared
/// across calls (taken out for the duration of the check and put back
/// afterwards), matching how `project.ts` maintains one registry across files.
///
/// # Example
///
/// ```js
/// const { checkProgram, Registry } = require("raven-node");
/// const registry = new Registry();
/// const result = JSON.parse(checkProgram(
///   JSON.stringify({ type: "Program", body: [] }),
///   JSON.stringify({ file: "empty.rv" }),
///   registry,
/// ));
/// result.diagnostics; // []
/// ```
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
