//! Tokenize differential: reads source on stdin, outputs tokens JSON.

use std::io::{self, Read};

use raven_core::lexer::tokenize;

fn main() {
    let mut source = String::new();
    io::stdin().read_to_string(&mut source).expect("read");
    let file = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "<anonymous>".to_string());
    match tokenize(&source, &file) {
        Ok(tokens) => {
            let json: Vec<serde_json::Value> = tokens
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "kind": t.kind.as_str(),
                        "value": t.value,
                        "location": {
                            "file": t.location.file,
                            "line": t.location.line,
                            "column": t.location.column,
                            "start": t.location.start,
                            "end": t.location.end,
                        }
                    })
                })
                .collect();
            print!("{}", serde_json::to_string(&json).unwrap());
        }
        Err(e) => {
            eprintln!("{}", e.message);
            std::process::exit(1);
        }
    }
}
