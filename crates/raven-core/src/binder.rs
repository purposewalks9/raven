//! Symbol binding, mirroring `compiler/src/typechecker/binder.ts`.

use crate::ast::SourceLocation;
use crate::type_::RavenType;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SymbolKind {
    Variable,
    Constant,
    Parameter,
    Function,
    Model,
}

impl SymbolKind {
    /// The string form used in the TS `SymbolKind` union.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Variable => "variable",
            Self::Constant => "constant",
            Self::Parameter => "parameter",
            Self::Function => "function",
            Self::Model => "model",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SymbolOrigin {
    Local,
    Inferred,
    Import,
    Model,
    Builtin,
}

impl SymbolOrigin {
    /// The string form used in the TS `SymbolOrigin` union.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Inferred => "inferred",
            Self::Import => "import",
            Self::Model => "model",
            Self::Builtin => "builtin",
        }
    }
}

/// A symbol binding, mirroring the TS `SymbolBinding`.
#[derive(Debug, Clone)]
pub struct SymbolBinding {
    name: String,
    kind: SymbolKind,
    type_: RavenType,
    declaration: SourceLocation,
    references: Vec<SourceLocation>,
    origin: SymbolOrigin,
    source: Option<String>,
}

impl SymbolBinding {
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    #[must_use]
    pub fn kind(&self) -> &SymbolKind {
        &self.kind
    }

    #[must_use]
    pub fn type_(&self) -> &RavenType {
        &self.type_
    }

    #[must_use]
    pub fn declaration(&self) -> &SourceLocation {
        &self.declaration
    }

    #[must_use]
    pub fn references(&self) -> &[SourceLocation] {
        &self.references
    }

    #[must_use]
    pub fn origin(&self) -> &SymbolOrigin {
        &self.origin
    }

    #[must_use]
    pub fn source(&self) -> Option<&str> {
        self.source.as_deref()
    }
}

/// A binder that owns symbol bindings and hands out opaque ids.
#[derive(Debug, Default)]
pub struct Binder {
    bindings: Vec<SymbolBinding>,
}

impl Binder {
    #[must_use]
    pub fn new() -> Self {
        Self {
            bindings: Vec::new(),
        }
    }

    /// Declare a binding and return its id.
    pub fn declare(
        &mut self,
        name: String,
        kind: SymbolKind,
        type_: RavenType,
        location: SourceLocation,
        origin: SymbolOrigin,
        source: Option<String>,
    ) -> usize {
        self.bindings.push(SymbolBinding {
            name,
            kind,
            type_,
            declaration: location,
            references: Vec::new(),
            origin,
            source,
        });
        self.bindings.len() - 1
    }

    /// Record a reference at the given location.
    pub fn reference(&mut self, id: Option<usize>, location: SourceLocation) {
        if let Some(id) = id {
            if let Some(binding) = self.bindings.get_mut(id) {
                binding.references.push(location);
            }
        }
    }

    /// Update a binding's type (used for inferred function return types).
    pub fn update_type(&mut self, id: usize, type_: RavenType) {
        if let Some(binding) = self.bindings.get_mut(id) {
            binding.type_ = type_;
        }
    }

    #[must_use]
    pub fn get(&self, id: usize) -> Option<&SymbolBinding> {
        self.bindings.get(id)
    }

    #[must_use]
    pub fn all(&self) -> &[SymbolBinding] {
        &self.bindings
    }

    /// Find the binding whose declaration or a reference wraps `offset`,
    /// mirroring `bindingAt`.
    #[must_use]
    pub fn binding_at(&self, offset: usize) -> Option<&SymbolBinding> {
        let mut match_: Option<&SymbolBinding> = None;
        for binding in &self.bindings {
            if contains(&binding.declaration, offset)
                || binding.references.iter().any(|r| contains(r, offset))
            {
                match_ = Some(binding);
            }
        }
        match_ // last match wins, like the TS loop
    }
}

fn contains(loc: &SourceLocation, offset: usize) -> bool {
    offset >= loc.start && offset <= loc.end
}
