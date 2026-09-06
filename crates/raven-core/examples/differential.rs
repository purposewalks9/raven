
use std::collections::BTreeMap;
use std::fs;

use raven_core::emitter::Emitter;
use raven_core::optimizer::optimize;

#[derive(serde::Serialize)]
struct FileResult {
    #[serde(rename = "optimizedJs")]
    optimized_js: String,
    #[serde(rename = "unoptimizedJs")]
    unoptimized_js: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn main() {
    let files: Vec<String> = std::env::args().skip(1).collect();
    let mut results: BTreeMap<String, FileResult> = BTreeMap::new();

    for file in &files {
        let outcome = (|| -> Result<(String, String), String> {
            let source = fs::read_to_string(file).map_err(|e| e.to_string())?;
            let tokens = raven_core::lexer::tokenize(&source, file).map_err(|e| e.to_string())?;
            let mut parser = raven_core::parser::Parser::new(tokens);
            let program = parser.parse_program().map_err(|e| e.0)?;
            let optimized = optimize(&program);
            let optimized_js = Emitter::new().emit(&optimized);
            let unoptimized_js = Emitter::new().emit(&program);
            Ok((optimized_js, unoptimized_js))
        })();

        match outcome {
            Ok((optimized_js, unoptimized_js)) => {
                results.insert(
                    file.clone(),
                    FileResult {
                        optimized_js,
                        unoptimized_js,
                        error: None,
                    },
                );
            }
            Err(e) => {
                results.insert(
                    file.clone(),
                    FileResult {
                        optimized_js: String::new(),
                        unoptimized_js: String::new(),
                        error: Some(e),
                    },
                );
            }
        }
    }

    let out_path =
        std::env::var("OUT_PATH").unwrap_or_else(|_| "/tmp/raven-phase3-new.json".to_string());
    let json = serde_json::to_string_pretty(&results).unwrap();
    fs::write(&out_path, json).unwrap();
    eprintln!(
        "Processed {} files (new Rust pipeline) -> {out_path}",
        files.len()
    );
}
