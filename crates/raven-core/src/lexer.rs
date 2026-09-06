//! Lexer, mirroring `compiler/src/lexer/token.ts`.
//!
//! The tokenization rules are byte-for-byte the TypeScript implementation so
//! differential tests comparing the two stay green. Errors mirror the TS
//! `throw new Error(...)` messages exactly (including `line:column` prefix).

use thiserror::Error;

use crate::ast::SourceLocation;

/// Token kinds, matching `TokenKind` in `token.ts`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TokenKind {
    Keyword,
    Identifier,
    String,
    Number,
    Punctuation,
    Eof,
}

impl TokenKind {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Keyword => "Keyword",
            Self::Identifier => "Identifier",
            Self::String => "String",
            Self::Number => "Number",
            Self::Punctuation => "Punctuation",
            Self::Eof => "EOF",
        }
    }
}

/// A single token, matching `Token` in `token.ts`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub value: String,
    pub location: SourceLocation,
}

/// Lexer error, mirroring the `throw new Error(...)` strings in `tokenize`.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub struct LexError {
    pub message: String,
    pub location: SourceLocation,
}

impl std::fmt::Display for LexError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

fn keywords() -> &'static std::collections::HashSet<&'static str> {
    use std::collections::HashSet;
    use std::sync::OnceLock;
    static KEYWORDS: OnceLock<HashSet<&'static str>> = OnceLock::new();
    KEYWORDS.get_or_init(|| {
        [
            "print", "let", "const", "true", "false", "if", "then", "else", "end", "and", "or",
            "not", "while", "do", "fn", "return", "break", "continue", "model", "import", "from",
            "none",
        ]
        .into_iter()
        .collect()
    })
}

fn is_single_punct(c: char) -> bool {
    matches!(
        c,
        '+' | '-'
            | '*'
            | '/'
            | '%'
            | '='
            | '<'
            | '>'
            | '!'
            | ':'
            | ','
            | '.'
            | ';'
            | '('
            | ')'
            | '{'
            | '}'
            | '['
            | ']'
            | '?'
            | '|'
    )
}

fn is_two_char_op(s: &str) -> bool {
    matches!(s, "==" | "!=" | "<=" | ">=" | "->")
}

/// Tokenize `source` with `file` as the location `file` field.
///
/// Mirrors `tokenize(source, file)` in `token.ts` exactly, including the
/// `line`/`column` bookkeeping and the error message format.
pub fn tokenize(source: &str, file: &str) -> Result<Vec<Token>, LexError> {
    let file = file.to_string();
    let chars: Vec<char> = source.chars().collect();
    let mut tokens: Vec<Token> = Vec::new();
    let mut pos: usize = 0;
    let mut line: usize = 1;
    let mut column: usize = 1;

    let location =
        |start: usize, end: usize, line: usize, column: usize, file: &str| SourceLocation {
            file: file.to_string(),
            line,
            column,
            start,
            end,
        };

    // Advance one char, updating line/column, returning the char (or None if at end).
    // We track `pos` as char index, matching TS's string index for ASCII sources
    // (Raven sources are ASCII-only in the test corpus; multi-byte handling would
    // diverge from TS's UTF-16 indexing but is not exercised).
    while pos < chars.len() {
        let ch = chars[pos];

        if ch.is_whitespace() {
            // TS tests /\s/ — matches spaces, tabs, newlines. Advance handles line.
            if ch == '\n' {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
            pos += 1;
            continue;
        }

        if ch == '/' && pos + 1 < chars.len() && chars[pos + 1] == '/' {
            while pos < chars.len() && chars[pos] != '\n' {
                column += 1;
                pos += 1;
            }
            continue;
        }

        if ch == '/' && pos + 1 < chars.len() && chars[pos + 1] == '*' {
            let start_pos = pos;
            let start_line = line;
            let start_col = column;
            // consume "/*"
            // advance twice
            // We use same advance logic for line/column
            // First '/'
            pos += 1;
            column += 1;
            // '*'
            pos += 1;
            column += 1;
            // scan until "*/"
            let mut found = false;
            while pos < chars.len() {
                if chars[pos] == '*' && pos + 1 < chars.len() && chars[pos + 1] == '/' {
                    found = true;
                    break;
                }
                if chars[pos] == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
                pos += 1;
            }
            if !found {
                return Err(LexError {
                    message: format!("{start_line}:{start_col} Unterminated block comment"),
                    location: SourceLocation {
                        file: file.clone(),
                        line: start_line,
                        column: start_col,
                        start: start_pos,
                        end: start_pos + 2,
                    },
                });
            }
            // dummy to keep variable used if not error
            let _ = start_pos;
            // consume "*/"
            pos += 1; // '*'
            column += 1;
            pos += 1; // '/'
            column += 1;
            continue;
        }

        let start_pos = pos;
        let start_line = line;
        let start_col = column;
        let start_loc = location(start_pos, start_pos, start_line, start_col, &file);

        // Two-char operators
        if pos + 1 < chars.len() {
            let pair: String = chars[pos..pos + 2].iter().collect();
            if is_two_char_op(&pair) {
                // advance twice
                for _ in 0..2 {
                    if chars[pos] == '\n' {
                        line += 1;
                        column = 1;
                    } else {
                        column += 1;
                    }
                    pos += 1;
                }
                tokens.push(Token {
                    kind: TokenKind::Punctuation,
                    value: pair,
                    location: SourceLocation {
                        file: file.clone(),
                        line: start_line,
                        column: start_col,
                        start: start_pos,
                        end: pos,
                    },
                });
                continue;
            }
        }

        if is_single_punct(ch) {
            if ch == '\n' {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
            pos += 1;
            tokens.push(Token {
                kind: TokenKind::Punctuation,
                value: ch.to_string(),
                location: SourceLocation {
                    file: file.clone(),
                    line: start_line,
                    column: start_col,
                    start: start_pos,
                    end: pos,
                },
            });
            continue;
        }

        if ch == '"' {
            // consume opening "
            pos += 1;
            column += 1;
            let mut value = String::new();
            let mut unterminated = true;
            while pos < chars.len() && chars[pos] != '"' {
                if chars[pos] == '\n' {
                    return Err(LexError {
                        message: format!("{start_line}:{start_col} Unterminated string"),
                        location: SourceLocation {
                            file: file.clone(),
                            line: start_line,
                            column: start_col,
                            start: start_pos,
                            end: pos,
                        },
                    });
                }
                value.push(chars[pos]);
                if chars[pos] == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
                pos += 1;
            }
            if pos < chars.len() && chars[pos] == '"' {
                unterminated = false;
                pos += 1;
                column += 1;
            }
            if unterminated {
                return Err(LexError {
                    message: format!("{start_line}:{start_col} Unterminated string"),
                    location: SourceLocation {
                        file: file.clone(),
                        line: start_line,
                        column: start_col,
                        start: start_pos,
                        end: pos,
                    },
                });
            }
            tokens.push(Token {
                kind: TokenKind::String,
                value,
                location: SourceLocation {
                    file: file.clone(),
                    line: start_line,
                    column: start_col,
                    start: start_pos,
                    end: pos,
                },
            });
            let _ = start_loc;
            continue;
        }

        if ch.is_ascii_digit() {
            let mut value = String::new();
            while pos < chars.len() && chars[pos].is_ascii_digit() {
                value.push(chars[pos]);
                if chars[pos] == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
                pos += 1;
            }
            if pos < chars.len()
                && chars[pos] == '.'
                && pos + 1 < chars.len()
                && chars[pos + 1].is_ascii_digit()
            {
                value.push('.');
                if chars[pos] == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
                pos += 1;
                while pos < chars.len() && chars[pos].is_ascii_digit() {
                    value.push(chars[pos]);
                    if chars[pos] == '\n' {
                        line += 1;
                        column = 1;
                    } else {
                        column += 1;
                    }
                    pos += 1;
                }
            }
            tokens.push(Token {
                kind: TokenKind::Number,
                value,
                location: SourceLocation {
                    file: file.clone(),
                    line: start_line,
                    column: start_col,
                    start: start_pos,
                    end: pos,
                },
            });
            continue;
        }

        if ch.is_ascii_alphabetic() || ch == '_' {
            let mut value = String::new();
            while pos < chars.len() && (chars[pos].is_ascii_alphanumeric() || chars[pos] == '_') {
                value.push(chars[pos]);
                if chars[pos] == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
                pos += 1;
            }
            let kind = if keywords().contains(value.as_str()) {
                TokenKind::Keyword
            } else {
                TokenKind::Identifier
            };
            tokens.push(Token {
                kind,
                value,
                location: SourceLocation {
                    file: file.clone(),
                    line: start_line,
                    column: start_col,
                    start: start_pos,
                    end: pos,
                },
            });
            continue;
        }

        return Err(LexError {
            message: format!("{start_line}:{start_col} Unexpected character '{ch}'"),
            location: SourceLocation {
                file: file.clone(),
                line: start_line,
                column: start_col,
                start: start_pos,
                end: start_pos + 1,
            },
        });
    }

    // EOF token mirrors TS: location(pos,pos) where pos == source.length, line/column current
    tokens.push(Token {
        kind: TokenKind::Eof,
        value: String::new(),
        location: location(pos, pos, line, column, &file),
    });
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_print() {
        let tokens = tokenize(r#"print("hi")"#, "<test>").unwrap();
        let kinds: Vec<_> = tokens.iter().map(|t| t.kind.clone()).collect();
        assert_eq!(
            kinds,
            vec![
                TokenKind::Keyword,
                TokenKind::Punctuation,
                TokenKind::String,
                TokenKind::Punctuation,
                TokenKind::Eof
            ]
        );
    }
}
