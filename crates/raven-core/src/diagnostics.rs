//! Diagnostics, mirroring `compiler/src/diagnostics/index.ts`.
//!
//! The serde shape matches the TS `Diagnostic` so differential tests can
//! compare Rust output byte-for-byte against the TypeScript typechecker's
//! output.

use serde::{Deserialize, Serialize};

use crate::ast::SourceLocation;

/// Stable, greppable identifier for a diagnostic kind (e.g. "RAV2002").
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub code: String,
    pub severity: Severity,
    pub message: String,
    pub location: SourceLocation,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub suggestions: Option<Vec<DiagnosticSuggestion>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticSuggestion {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub replacement: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub location: Option<SourceLocation>,
}

/// Diagnostic code constants, mirroring `CODES` in `diagnostics/index.ts`.
pub mod codes {
    pub const DUPLICATE_DECLARATION: &str = "RAV1001";
    pub const DUPLICATE_FUNCTION: &str = "RAV1002";
    pub const DUPLICATE_PARAMETER: &str = "RAV1003";

    pub const RETURN_TYPE_MISMATCH: &str = "RAV2001";
    pub const DECLARATION_TYPE_MISMATCH: &str = "RAV2002";
    pub const MODEL_TYPE_MISMATCH: &str = "RAV2003";
    pub const ASSIGNMENT_TYPE_MISMATCH: &str = "RAV2004";
    pub const ARGUMENT_TYPE_MISMATCH: &str = "RAV2005";

    pub const INVALID_IMPORT_TARGET: &str = "RAV3001";
    pub const UNRESOLVED_IMPORT: &str = "RAV3002";
    pub const UNDECLARED_VARIABLE: &str = "RAV3003";
    pub const UNDECLARED_FUNCTION: &str = "RAV3004";

    pub const READONLY_MODEL_REASSIGNMENT: &str = "RAV4001";
    pub const UNDECLARED_ASSIGNMENT_TARGET: &str = "RAV4002";
    pub const CONST_REASSIGNMENT: &str = "RAV4003";

    pub const NON_BOOLEAN_CONDITION: &str = "RAV5001";
    pub const INVALID_UNARY_OPERAND: &str = "RAV5002";
    pub const INVALID_LOGICAL_OPERANDS: &str = "RAV5003";
    pub const INCOMPARABLE_TYPES: &str = "RAV5004";
    pub const INVALID_PLUS_OPERANDS: &str = "RAV5005";
    pub const INVALID_ARITHMETIC_OPERANDS: &str = "RAV5006";

    pub const UNKNOWN_PROPERTY: &str = "RAV6001";
    pub const INVALID_PROPERTY_ACCESS: &str = "RAV6002";
    pub const INVALID_INDEX_TYPE: &str = "RAV6003";
    pub const INVALID_INDEX_TARGET: &str = "RAV6004";
    pub const TUPLE_INDEX_OUT_OF_BOUNDS: &str = "RAV6005";

    pub const RECURSIVE_MODEL_CYCLE: &str = "RECURSIVE_MODEL_CYCLE";
    pub const ARGUMENT_COUNT_MISMATCH: &str = "RAV7001";

    pub const MODEL_REGISTRY_CONFLICT: &str = "RAV8001";

    pub const PARSE_ERROR: &str = "RAV9001";
}

/// A collector of diagnostics, mirroring `DiagnosticBag`.
#[derive(Debug, Default, Clone)]
pub struct DiagnosticBag {
    diagnostics: Vec<Diagnostic>,
}

/// Extra context for a diagnostic (hint / suggestions), matching
/// `DiagnosticOptions` in the TS.
#[derive(Debug, Default, Clone)]
pub struct DiagnosticOptions {
    pub hint: Option<String>,
    pub suggestions: Vec<DiagnosticSuggestion>,
}

impl DiagnosticBag {
    #[must_use]
    pub fn new() -> Self {
        Self {
            diagnostics: Vec::new(),
        }
    }

    #[allow(clippy::needless_pass_by_value)]
    pub fn error(
        &mut self,
        code: &str,
        message: String,
        location: SourceLocation,
        options: DiagnosticOptions,
    ) {
        self.push(code, Severity::Error, message, location, options);
    }

    fn push(
        &mut self,
        code: &str,
        severity: Severity,
        message: String,
        location: SourceLocation,
        options: DiagnosticOptions,
    ) {
        let mut diag = Diagnostic {
            code: code.to_string(),
            severity,
            message,
            location,
            hint: None,
            suggestions: None,
        };
        if options.hint.is_some() {
            diag.hint = options.hint;
        }
        if !options.suggestions.is_empty() {
            diag.suggestions = Some(options.suggestions);
        }
        self.diagnostics.push(diag);
    }

    #[must_use]
    pub fn all(&self) -> Vec<Diagnostic> {
        self.diagnostics.clone()
    }

    pub fn iter(&self) -> impl Iterator<Item = &Diagnostic> {
        self.diagnostics.iter()
    }

    #[must_use]
    pub fn has_errors(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|d| d.severity == Severity::Error)
    }
}

/// Serialize diagnostics to the same JSON shape as the TS
/// `diagnosticsToJSON`.
#[must_use]
pub fn diagnostics_to_json(diagnostics: &[Diagnostic]) -> String {
    serde_json::to_string(diagnostics).unwrap_or_default()
}
