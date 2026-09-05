//! Reference checker for differential testing: reads a JSON AST on stdin,
//! typechecks it, and writes diagnostics as JSON on stdout.

use std::io::{self, Read};

use raven_core::ast::Program;
use raven_core::checker::{TypeChecker, TypeCheckerOptions};
use raven_core::diagnostics::diagnostics_to_json;

fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    let program: Program = serde_json::from_str(&input).expect("failed to parse AST JSON");
    let mut checker = TypeChecker::new(TypeCheckerOptions::default());
    let diagnostics = checker.check(&program);
    print!("{}", diagnostics_to_json(&diagnostics));
}
