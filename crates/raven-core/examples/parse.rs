//! Parse differential: reads source on stdin, outputs Program JSON.

use std::io::{self, Read};

use raven_core::lexer::tokenize;
use raven_core::parser::Parser;

fn main() {
    let mut source = String::new();
    io::stdin().read_to_string(&mut source).expect("read");
    let file = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "<anonymous>".to_string());
    let tokens = tokenize(&source, &file).unwrap_or_else(|e| {
        eprintln!("{}", e.message);
        std::process::exit(1);
    });
    let mut parser = Parser::new(tokens);
    match parser.parse_program() {
        Ok(prog) => print!("{}", serde_json::to_string(&prog).unwrap()),
        Err(e) => {
            eprintln!("{}", e.0);
            std::process::exit(1);
        }
    }
}
