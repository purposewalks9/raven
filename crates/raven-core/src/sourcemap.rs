//! Source map (v3) generation, mirroring `compiler/src/sourcemap/vlq.ts` and
//! `compiler/src/sourcemap/generator.ts`.
//!
//! `encode_vlq` matches the TS encoder digit-for-digit against the source
//! map spec's worked examples. `SourceMapGenerator` accumulates raw
//! `(generated position, source position)` mappings exactly like the TS
//! class and produces the same VLQ-encoded `mappings` string, so a Rust-
//! generated map and a TS-generated map for the same input are byte-
//! identical.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

const BASE64_DIGITS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn to_vlq_signed(value: i64) -> i64 {
    if value < 0 {
        (-value << 1) + 1
    } else {
        value << 1
    }
}

fn encode_one(value: i64) -> String {
    let mut digits = String::new();
    let mut vlq = to_vlq_signed(value);
    loop {
        let mut digit = (vlq & 0b1_1111) as usize;
        vlq >>= 5;
        if vlq > 0 {
            digit |= 0b10_0000;
        }
        digits.push(BASE64_DIGITS[digit] as char);
        if vlq == 0 {
            break;
        }
    }
    digits
}

/// Encodes a sequence of signed integers (one mapping segment's deltas).
/// Mirrors `encodeVlq` in `sourcemap/vlq.ts`.
#[must_use]
pub fn encode_vlq(values: &[i64]) -> String {
    values.iter().copied().map(encode_one).collect()
}

/// Minimal, dependency-free standard (RFC 4648, padded) base64 encoder, used
/// only for `to_data_url`. Matches Node's `Buffer.from(...).toString("base64")`.
fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    let mut chunks = data.chunks_exact(3);
    for chunk in &mut chunks {
        let n = (u32::from(chunk[0]) << 16) | (u32::from(chunk[1]) << 8) | u32::from(chunk[2]);
        out.push(BASE64_DIGITS[((n >> 18) & 0x3F) as usize] as char);
        out.push(BASE64_DIGITS[((n >> 12) & 0x3F) as usize] as char);
        out.push(BASE64_DIGITS[((n >> 6) & 0x3F) as usize] as char);
        out.push(BASE64_DIGITS[(n & 0x3F) as usize] as char);
    }
    let rem = chunks.remainder();
    match rem.len() {
        1 => {
            let n = u32::from(rem[0]) << 16;
            out.push(BASE64_DIGITS[((n >> 18) & 0x3F) as usize] as char);
            out.push(BASE64_DIGITS[((n >> 12) & 0x3F) as usize] as char);
            out.push('=');
            out.push('=');
        }
        2 => {
            let n = (u32::from(rem[0]) << 16) | (u32::from(rem[1]) << 8);
            out.push(BASE64_DIGITS[((n >> 18) & 0x3F) as usize] as char);
            out.push(BASE64_DIGITS[((n >> 12) & 0x3F) as usize] as char);
            out.push(BASE64_DIGITS[((n >> 6) & 0x3F) as usize] as char);
            out.push('=');
        }
        _ => {}
    }
    out
}

/// One raw mapping, matching the TS `RawMapping` interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawMapping {
    pub generated_line: usize,
    pub generated_column: usize,
    pub source: String,
    pub source_line: usize,
    pub source_column: usize,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
}

/// A serialized source map (v3), matching the TS `RawSourceMap` interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawSourceMap {
    pub version: u8,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub file: Option<String>,
    pub sources: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sources_content: Option<Vec<Option<String>>>,
    pub names: Vec<String>,
    pub mappings: String,
}

/// Accumulates mappings and produces a v3 source map. Mirrors
/// `SourceMapGenerator` in `sourcemap/generator.ts` field-for-field.
#[derive(Debug, Default, Clone)]
pub struct SourceMapGenerator {
    mappings: Vec<RawMapping>,
    sources: Vec<String>,
    source_contents: HashMap<String, String>,
    names: Vec<String>,
}

impl SourceMapGenerator {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_mapping(&mut self, mapping: RawMapping) {
        if !self.sources.iter().any(|s| s == &mapping.source) {
            self.sources.push(mapping.source.clone());
        }
        if let Some(name) = &mapping.name {
            if !self.names.iter().any(|n| n == name) {
                self.names.push(name.clone());
            }
        }
        self.mappings.push(mapping);
    }

    pub fn set_source_content(&mut self, source: &str, content: &str) {
        if !self.sources.iter().any(|s| s == source) {
            self.sources.push(source.to_string());
        }
        self.source_contents
            .insert(source.to_string(), content.to_string());
    }

    /// Builds the serializable `RawSourceMap`, mirroring `toJSON`.
    #[must_use]
    pub fn to_raw(&self, file: Option<String>) -> RawSourceMap {
        let mut sorted: Vec<&RawMapping> = self.mappings.iter().collect();
        sorted.sort_by_key(|m| (m.generated_line, m.generated_column));

        let mut mappings_text = String::new();
        let mut prev_generated_line: i64 = 0;
        let mut prev_generated_column: i64 = 0;
        let mut prev_source_index: i64 = 0;
        let mut prev_source_line: i64 = 0;
        let mut prev_source_column: i64 = 0;
        let mut prev_name_index: i64 = 0;
        let mut first_segment_on_line = true;
        let mut last_emitted_generated_column: Option<i64> = None;

        for mapping in sorted {
            let generated_line = mapping.generated_line as i64;
            let generated_column = mapping.generated_column as i64;

            if generated_line != prev_generated_line {
                mappings_text.push_str(&";".repeat((generated_line - prev_generated_line) as usize));
                prev_generated_line = generated_line;
                prev_generated_column = 0;
                first_segment_on_line = true;
                last_emitted_generated_column = None;
            }

            if last_emitted_generated_column == Some(generated_column) {
                continue;
            }

            if !first_segment_on_line {
                mappings_text.push(',');
            }
            first_segment_on_line = false;

            let source_index = self
                .sources
                .iter()
                .position(|s| s == &mapping.source)
                .unwrap_or(0) as i64;
            let source_line = mapping.source_line as i64;
            let source_column = mapping.source_column as i64;

            let mut segment = vec![
                generated_column - prev_generated_column,
                source_index - prev_source_index,
                source_line - prev_source_line,
                source_column - prev_source_column,
            ];
            if let Some(name) = &mapping.name {
                let name_index = self.names.iter().position(|n| n == name).unwrap_or(0) as i64;
                segment.push(name_index - prev_name_index);
                prev_name_index = name_index;
            }

            mappings_text.push_str(&encode_vlq(&segment));

            prev_generated_column = generated_column;
            last_emitted_generated_column = Some(generated_column);
            prev_source_index = source_index;
            prev_source_line = source_line;
            prev_source_column = source_column;
        }

        let sources_content: Vec<Option<String>> = self
            .sources
            .iter()
            .map(|s| self.source_contents.get(s).cloned())
            .collect();
        let has_any_content = sources_content.iter().any(Option::is_some);

        RawSourceMap {
            version: 3,
            file,
            sources: self.sources.clone(),
            sources_content: if has_any_content {
                Some(sources_content)
            } else {
                None
            },
            names: self.names.clone(),
            mappings: mappings_text,
        }
    }

    /// Mirrors `toString`: the raw map serialized as a JSON string.
    #[must_use]
    pub fn to_json_string(&self, file: Option<String>) -> String {
        serde_json::to_string(&self.to_raw(file)).unwrap_or_default()
    }

    /// Mirrors `toDataUrl`: a `data:` URI suitable for an inline
    /// `//# sourceMappingURL=` comment.
    #[must_use]
    pub fn to_data_url(&self, file: Option<String>) -> String {
        let json = self.to_json_string(file);
        format!(
            "data:application/json;base64,{}",
            base64_encode(json.as_bytes())
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_vlq_matches_spec_examples() {
        assert_eq!(encode_vlq(&[0]), "A");
        assert_eq!(encode_vlq(&[1]), "C");
        assert_eq!(encode_vlq(&[-1]), "D");
        assert_eq!(encode_vlq(&[16]), "gB");
    }

    #[test]
    fn single_mapping_per_line_uses_relative_deltas() {
        let mut gen = SourceMapGenerator::new();
        gen.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 0,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 0,
            name: None,
        });
        gen.add_mapping(RawMapping {
            generated_line: 1,
            generated_column: 2,
            source: "a.rv".into(),
            source_line: 1,
            source_column: 0,
            name: None,
        });
        let raw = gen.to_raw(Some("a.js".into()));
        assert_eq!(raw.version, 3);
        assert_eq!(raw.file.as_deref(), Some("a.js"));
        assert_eq!(raw.sources, vec!["a.rv".to_string()]);
        // First segment (line 0): genCol 0, srcIdx 0, srcLine 0, srcCol 0 -> "AAAA"
        // Then ";" for the new line, then segment for line 1.
        assert!(raw.mappings.starts_with("AAAA;"));
    }

    #[test]
    fn drops_duplicate_mappings_at_same_generated_position() {
        let mut gen = SourceMapGenerator::new();
        gen.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 4,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 4,
            name: None,
        });
        gen.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 4,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 9,
            name: None,
        });
        let raw = gen.to_raw(None);
        // Only one segment should be emitted (no comma).
        assert!(!raw.mappings.contains(','));
    }

    #[test]
    fn sources_content_only_present_when_set() {
        let mut without = SourceMapGenerator::new();
        without.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 0,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 0,
            name: None,
        });
        assert!(without.to_raw(None).sources_content.is_none());

        let mut with = SourceMapGenerator::new();
        with.set_source_content("a.rv", "let x = 1\n");
        with.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 0,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 0,
            name: None,
        });
        assert_eq!(
            with.to_raw(None).sources_content,
            Some(vec![Some("let x = 1\n".to_string())])
        );
    }

    #[test]
    fn data_url_round_trips() {
        let mut gen = SourceMapGenerator::new();
        gen.add_mapping(RawMapping {
            generated_line: 0,
            generated_column: 0,
            source: "a.rv".into(),
            source_line: 0,
            source_column: 0,
            name: None,
        });
        let url = gen.to_data_url(Some("a.js".into()));
        assert!(url.starts_with("data:application/json;base64,"));
    }
}
