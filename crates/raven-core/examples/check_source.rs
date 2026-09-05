//! Source-text-in checker for differential testing (Phase 2).
//! Reads JSON `{"source": "...", "file": "..."}` on stdin, tokenizes, parses,
//! typechecks, and writes diagnostics as JSON on stdout. Mirrors the new
//! `check_source` FFI contract.

use std::io::{self, Read};

use raven_core::checker::{TypeChecker, TypeCheckerOptions};
use raven_core::diagnostics::diagnostics_to_json;
use serde::Deserialize;

#[derive(Deserialize)]
struct Input {
    source: String,
    file: Option<String>,
}

fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    let req: Input = serde_json::from_str(&input).expect("failed to parse input JSON");
    let file = req.file.unwrap_or_else(|| "<anonymous>".to_string());

    // Tokenize + parse, mapping lex/parse errors to diagnostics (same as FFI).
    let tokens = match raven_core::lexer::tokenize(&req.source, &file) {
        Ok(t) => t,
        Err(e) => {
            let diag = raven_core::diagnostics::Diagnostic {
                code: raven_core::diagnostics::codes::PARSE_ERROR.to_string(),
                severity: raven_core::diagnostics::Severity::Error,
                message: e.message,
                location: e.location,
                hint: None,
                suggestions: None,
            };
            print!("{}", diagnostics_to_json(&[diag]));
            return;
        }
    };
    let mut parser = raven_core::parser::Parser::new(tokens);
    let program = match parser.parse_program() {
        Ok(p) => p,
        Err(e) => {
            let diag = raven_core::diagnostics::Diagnostic {
                code: raven_core::diagnostics::codes::PARSE_ERROR.to_string(),
                severity: raven_core::diagnostics::Severity::Error,
                message: e.0,
                location: raven_core::ast::SourceLocation {
                    file: file.clone(),
                    line: 1,
                    column: 1,
                    start: 0,
                    end: 0,
                },
                hint: None,
                suggestions: None,
            };
            print!("{}", diagnostics_to_json(&[diag]));
            return;
        }
    };

    let mut checker = TypeChecker::new(TypeCheckerOptions {
        file: Some(file),
        ..Default::default()
    });
    let diagnostics = checker.check(&program);
    print!("{}", diagnostics_to_json(&diagnostics));
}
