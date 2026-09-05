//! Workspace-wide model registry, mirroring `checker/registry.ts`.

use std::collections::HashMap;

use crate::ast::SourceLocation;

use super::type_::{diff_shapes, format_shape_diff, same_type, RavenType, TypeInterner};

/// A published model, mirroring the TS `PublishedModel`.
#[derive(Debug, Clone)]
pub struct PublishedModel {
    pub name: String,
    pub type_: RavenType,
    pub external: bool,
    pub file: String,
    pub location: SourceLocation,
}

/// The result of attempting to publish a model, mirroring `PublishResult`.
#[derive(Debug, Clone)]
pub enum PublishResult {
    Ok,
    Err {
        message: String,
        existing: Box<PublishedModel>,
    },
}

/// Cross-file workspace registry, mirroring `WorkspaceRegistry`.
#[derive(Debug, Default)]
pub struct WorkspaceRegistry {
    models: HashMap<String, PublishedModel>,
    interner: TypeInterner,
}

impl WorkspaceRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self {
            models: HashMap::new(),
            interner: TypeInterner::default(),
        }
    }

    pub fn publish(
        &mut self,
        name: String,
        type_: RavenType,
        external: bool,
        file: String,
        location: SourceLocation,
    ) -> PublishResult {
        if let Some(existing) = self.models.get(&name) {
            if existing.file == file || external || existing.external {
                return PublishResult::Ok;
            }
            if same_type(&self.interner, &existing.type_, &type_) {
                return PublishResult::Ok;
            }
            let diff = diff_shapes(&existing.type_, &type_);
            let diff_text = if diff.is_empty() {
                String::new()
            } else {
                format!("\n{}", format_shape_diff(&diff))
            };
            return PublishResult::Err {
                message: format!(
                    "Model '{}' is already published with a different shape.{}",
                    name, diff_text
                ),
                existing: Box::new(existing.clone()),
            };
        }
        self.models.insert(
            name.clone(),
            PublishedModel {
                name,
                type_,
                external,
                file,
                location,
            },
        );
        PublishResult::Ok
    }

    #[must_use]
    pub fn lookup(&self, name: &str) -> Option<&PublishedModel> {
        self.models.get(name)
    }

    #[must_use]
    pub fn all(&self) -> Vec<&PublishedModel> {
        self.models.values().collect()
    }

    #[must_use]
    pub fn names(&self) -> Vec<String> {
        self.models.keys().cloned().collect()
    }
}
