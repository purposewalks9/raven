//! Scoped symbol table, mirroring `compiler/src/typechecker/symbolTable.ts`.

use std::collections::HashMap;

use crate::type_::RavenType;

use super::binder::SymbolOrigin;

/// A symbol entry, mirroring the TS `SymbolInfo`.
#[derive(Debug, Clone)]
pub struct SymbolInfo {
    pub type_: RavenType,
    pub constant: bool,
    pub binding: Option<usize>,
    pub origin: Option<SymbolOrigin>,
    pub source: Option<String>,
}

/// A stack of scoped symbol maps, mirroring `SymbolTable`.
#[derive(Debug)]
pub struct SymbolTable {
    scopes: Vec<HashMap<String, SymbolInfo>>,
}

impl Default for SymbolTable {
    fn default() -> Self {
        Self {
            scopes: vec![HashMap::new()],
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SymbolTableError {
    CannotExitGlobalScope,
    NoActiveScope,
}

impl SymbolTable {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn enter_scope(&mut self) {
        self.scopes.push(HashMap::new());
    }

    pub fn exit_scope(&mut self) -> Result<(), SymbolTableError> {
        if self.scopes.len() == 1 {
            return Err(SymbolTableError::CannotExitGlobalScope);
        }
        self.scopes.pop();
        Ok(())
    }

    /// Declare in the current scope. Returns `false` if the name is already
    /// declared in the current scope.
    pub fn declare(&mut self, name: String, info: SymbolInfo) -> bool {
        let current = self
            .scopes
            .last_mut()
            .ok_or(SymbolTableError::NoActiveScope)
            .expect("scope stack is never empty");
        if current.contains_key(&name) {
            return false;
        }
        current.insert(name, info);
        true
    }

    pub fn lookup(&self, name: &str) -> Option<&SymbolInfo> {
        for scope in self.scopes.iter().rev() {
            if let Some(symbol) = scope.get(name) {
                return Some(symbol);
            }
        }
        None
    }

    #[must_use]
    pub fn has(&self, name: &str) -> bool {
        self.lookup(name).is_some()
    }

    #[must_use]
    pub fn is_constant(&self, name: &str) -> bool {
        self.lookup(name).is_some_and(|s| s.constant)
    }

    #[must_use]
    pub fn scope_depth(&self) -> usize {
        self.scopes.len()
    }

    #[must_use]
    pub fn has_in_current_scope(&self, name: &str) -> bool {
        self.scopes
            .last()
            .is_some_and(|scope| scope.contains_key(name))
    }

    /// All visible names across all scopes (deduplicated).
    #[must_use]
    pub fn all_names(&self) -> Vec<String> {
        let mut names = std::collections::BTreeSet::new();
        for scope in &self.scopes {
            for name in scope.keys() {
                names.insert(name.clone());
            }
        }
        names.into_iter().collect()
    }
}
