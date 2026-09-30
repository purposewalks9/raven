use std::collections::HashMap;
use std::sync::Arc;

use raven_core::ast::SourceLocation;
use raven_core::checker::{TypeChecker, TypeCheckerOptions};
use raven_core::diagnostics::{Diagnostic, Severity};
use raven_core::lexer::tokenize;
use raven_core::parser::Parser;
use raven_core::type_::{LiteralValue, RavenType};
use tokio::sync::RwLock;
use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

#[derive(Default)]
struct State {
    documents: HashMap<Url, String>,
}

struct RavenLsp {
    client: Client,
    state: Arc<RwLock<State>>,
}

impl RavenLsp {
    fn new(client: Client) -> Self {
        Self {
            client,
            state: Arc::new(RwLock::new(State::default())),
        }
    }

    async fn validate(&self, uri: &Url, source: &str) {
        let diagnostics = analyze(source, uri.path()).0;
        self.client
            .publish_diagnostics(uri.clone(), diagnostics, None)
            .await;
    }
}

#[tower_lsp::async_trait]
impl LanguageServer for RavenLsp {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                definition_provider: Some(OneOf::Left(true)),
                references_provider: Some(OneOf::Left(true)),
                ..ServerCapabilities::default()
            },
            ..InitializeResult::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "Raven Rust language server ready")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let document = params.text_document;
        self.state
            .write()
            .await
            .documents
            .insert(document.uri.clone(), document.text.clone());
        self.validate(&document.uri, &document.text).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let Some(change) = params.content_changes.into_iter().last() else {
            return;
        };
        let uri = params.text_document.uri;
        self.state
            .write()
            .await
            .documents
            .insert(uri.clone(), change.text.clone());
        self.validate(&uri, &change.text).await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri;
        self.state.write().await.documents.remove(&uri);
        self.client.publish_diagnostics(uri, Vec::new(), None).await;
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let position = params.text_document_position_params.position;
        let uri = params.text_document_position_params.text_document.uri;
        let state = self.state.read().await;
        let Some(source) = state.documents.get(&uri) else {
            return Ok(None);
        };
        let (_, checker) = analyze(source, uri.path());
        let Some(checker) = checker else {
            return Ok(None);
        };
        let Some(binding) = checker.binder().binding_at(offset(source, position)) else {
            return Ok(None);
        };
        let keyword = match binding.kind().as_str() {
            "constant" => "const",
            "parameter" => "param",
            "function" => "fn",
            _ => "let",
        };
        let signature = if binding.kind().as_str() == "function" {
            format!(
                "fn {}(...): {}",
                binding.name(),
                format_type(binding.type_())
            )
        } else {
            format!(
                "{} {}: {}",
                keyword,
                binding.name(),
                format_type(binding.type_())
            )
        };
        Ok(Some(Hover {
            contents: HoverContents::Markup(MarkupContent {
                kind: MarkupKind::Markdown,
                value: format!("```raven\n{signature}\n```"),
            }),
            range: None,
        }))
    }

    async fn goto_definition(
        &self,
        params: GotoDefinitionParams,
    ) -> Result<Option<GotoDefinitionResponse>> {
        let position = params.text_document_position_params.position;
        let uri = params.text_document_position_params.text_document.uri;
        let state = self.state.read().await;
        let Some(source) = state.documents.get(&uri) else {
            return Ok(None);
        };
        let (_, checker) = analyze(source, uri.path());
        let Some(checker) = checker else {
            return Ok(None);
        };
        let Some(binding) = checker.binder().binding_at(offset(source, position)) else {
            return Ok(None);
        };
        Ok(Some(GotoDefinitionResponse::Scalar(Location {
            uri,
            range: range(binding.declaration()),
        })))
    }

    async fn references(&self, params: ReferenceParams) -> Result<Option<Vec<Location>>> {
        let position = params.text_document_position.position;
        let uri = params.text_document_position.text_document.uri;
        let state = self.state.read().await;
        let Some(source) = state.documents.get(&uri) else {
            return Ok(Some(Vec::new()));
        };
        let (_, checker) = analyze(source, uri.path());
        let Some(checker) = checker else {
            return Ok(Some(Vec::new()));
        };
        let Some(binding) = checker.binder().binding_at(offset(source, position)) else {
            return Ok(Some(Vec::new()));
        };
        let mut locations: Vec<Location> = binding
            .references()
            .iter()
            .map(|location| Location {
                uri: uri.clone(),
                range: range(location),
            })
            .collect();
        if params.context.include_declaration {
            locations.insert(
                0,
                Location {
                    uri,
                    range: range(binding.declaration()),
                },
            );
        }
        Ok(Some(locations))
    }
}

fn analyze(
    source: &str,
    file: &str,
) -> (Vec<tower_lsp::lsp_types::Diagnostic>, Option<TypeChecker>) {
    let tokens = match tokenize(source, file) {
        Ok(tokens) => tokens,
        Err(error) => return (vec![lsp_diagnostic(error.message, error.location)], None),
    };
    let mut parser = Parser::new(tokens);
    let program = match parser.parse_program() {
        Ok(program) => program,
        Err(error) => {
            return (
                vec![lsp_diagnostic(
                    error.0,
                    SourceLocation {
                        file: file.to_string(),
                        ..SourceLocation::default()
                    },
                )],
                None,
            )
        }
    };
    let mut checker = TypeChecker::new(TypeCheckerOptions {
        file: Some(file.to_string()),
        ..TypeCheckerOptions::default()
    });
    let diagnostics = checker
        .check(&program)
        .iter()
        .cloned()
        .map(lsp_from_raven)
        .collect();
    (diagnostics, Some(checker))
}

fn lsp_from_raven(diagnostic: Diagnostic) -> tower_lsp::lsp_types::Diagnostic {
    lsp_diagnostic(
        diagnostic.hint.map_or(diagnostic.message.clone(), |hint| {
            format!("{}\n{hint}", diagnostic.message)
        }),
        diagnostic.location,
    )
    .with_severity(if diagnostic.severity == Severity::Error {
        DiagnosticSeverity::ERROR
    } else {
        DiagnosticSeverity::WARNING
    })
}

trait WithSeverity {
    fn with_severity(self, severity: DiagnosticSeverity) -> Self;
}
impl WithSeverity for tower_lsp::lsp_types::Diagnostic {
    fn with_severity(mut self, severity: DiagnosticSeverity) -> Self {
        self.severity = Some(severity);
        self
    }
}

fn lsp_diagnostic(message: String, location: SourceLocation) -> tower_lsp::lsp_types::Diagnostic {
    tower_lsp::lsp_types::Diagnostic {
        range: range(&location),
        severity: Some(DiagnosticSeverity::ERROR),
        source: Some("raven".to_string()),
        message,
        ..tower_lsp::lsp_types::Diagnostic::default()
    }
}
fn range(location: &SourceLocation) -> Range {
    Range {
        start: Position::new(
            location.line.saturating_sub(1) as u32,
            location.column.saturating_sub(1) as u32,
        ),
        end: Position::new(
            location.line.saturating_sub(1) as u32,
            location.column.saturating_sub(1) as u32
                + location.end.saturating_sub(location.start) as u32,
        ),
    }
}
fn offset(source: &str, position: Position) -> usize {
    let mut line = 0_u32;
    let mut column = 0_u32;
    for (index, character) in source.char_indices() {
        if line == position.line && column == position.character {
            return index;
        }
        if character == '\n' {
            line += 1;
            column = 0;
        } else {
            column += 1;
        }
    }
    source.len()
}
fn format_type(type_: &RavenType) -> String {
    match type_ {
        RavenType::String => "string".to_string(),
        RavenType::Number => "number".to_string(),
        RavenType::Boolean => "boolean".to_string(),
        RavenType::Any => "any".to_string(),
        RavenType::None => "none".to_string(),
        RavenType::Array { element_type } => format!("{}[]", format_type(element_type)),
        RavenType::Optional { inner } => format!("{}?", format_type(inner)),
        RavenType::Union { variants } => variants
            .iter()
            .map(format_type)
            .collect::<Vec<_>>()
            .join(" | "),
        RavenType::Record { fields } => format!(
            "{{ {} }}",
            fields
                .iter()
                .map(|(name, value)| format!("{name}: {}", format_type(value)))
                .collect::<Vec<_>>()
                .join("; ")
        ),
        RavenType::Literal { value } => match value {
            LiteralValue::String(value) => format!("{value:?}"),
            LiteralValue::Number(value) => value.to_string(),
            LiteralValue::Boolean(value) => value.to_string(),
        },
        RavenType::Tuple { elements } => format!(
            "[{}]",
            elements
                .iter()
                .map(format_type)
                .collect::<Vec<_>>()
                .join(", ")
        ),
        RavenType::Function {
            params,
            return_type,
        } => format!(
            "fn({}): {}",
            params
                .iter()
                .map(format_type)
                .collect::<Vec<_>>()
                .join(", "),
            format_type(return_type)
        ),
        RavenType::Ref { name } | RavenType::Named(name) => name.clone(),
    }
}

#[tokio::main]
async fn main() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let (service, socket) = LspService::new(RavenLsp::new);
    Server::new(stdin, stdout, socket).serve(service).await;
}
