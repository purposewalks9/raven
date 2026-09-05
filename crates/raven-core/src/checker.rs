//! The type checker, mirroring `compiler/src/typechecker/checker.ts`.

use std::collections::HashMap;

use indexmap::{IndexMap, IndexSet};

use crate::ast::{Expression, Program, Statement};
use crate::binder::{Binder, SymbolKind, SymbolOrigin};
use crate::diagnostics::{
    codes, Diagnostic, DiagnosticBag, DiagnosticOptions, DiagnosticSuggestion,
};
use crate::registry::WorkspaceRegistry;
use crate::symbol_table::{SymbolInfo, SymbolTable};
use crate::type_::{
    closest_match, format_type, is_assignable_to as shared_is_assignable_to, normalize,
    optional_type, same_type as shared_same_type, union_type, RavenType, TypeInterner,
};

/// A function signature, mirroring `checker.ts`'s `FunctionSignature`.
#[derive(Debug, Clone)]
pub struct FunctionSignature {
    pub params: Vec<RavenType>,
    pub return_type: RavenType,
}

#[derive(Debug, Clone)]
struct FunctionSignatureEntry {
    params: Vec<RavenType>,
    return_type: RavenType,
    binding: Option<usize>,
}

/// Options for constructing a `TypeChecker`, mirroring `TypeCheckerOptions`.
#[derive(Debug, Default)]
pub struct TypeCheckerOptions {
    pub registry: Option<WorkspaceRegistry>,
    pub file: Option<String>,
    pub imported_functions: HashMap<String, FunctionSignature>,
}

/// Mirrors `TypeChecker` in `checker.ts`.
pub struct TypeChecker {
    symbol_table: SymbolTable,
    diagnostics: DiagnosticBag,
    binder: Binder,
    interner: TypeInterner,
    registry: Option<WorkspaceRegistry>,
    file: String,
    imported_functions: HashMap<String, FunctionSignature>,
    function_signatures: HashMap<String, FunctionSignatureEntry>,
    current_return_type: Option<RavenType>,
    inferred_return_types: Option<Vec<RavenType>>,
    external_model_bindings: HashMap<String, usize>,
}

impl TypeChecker {
    #[must_use]
    pub fn new(options: TypeCheckerOptions) -> Self {
        let mut function_signatures: HashMap<String, FunctionSignatureEntry> = HashMap::new();
        function_signatures.insert(
            "len".to_string(),
            FunctionSignatureEntry {
                params: vec![RavenType::Array {
                    element_type: Box::new(RavenType::Any),
                }],
                return_type: RavenType::Number,
                binding: None,
            },
        );
        function_signatures.insert(
            "abs".to_string(),
            FunctionSignatureEntry {
                params: vec![RavenType::Number],
                return_type: RavenType::Number,
                binding: None,
            },
        );
        function_signatures.insert(
            "sqrt".to_string(),
            FunctionSignatureEntry {
                params: vec![RavenType::Number],
                return_type: RavenType::Number,
                binding: None,
            },
        );
        function_signatures.insert(
            "toString".to_string(),
            FunctionSignatureEntry {
                params: vec![RavenType::Any],
                return_type: RavenType::String,
                binding: None,
            },
        );

        Self {
            symbol_table: SymbolTable::new(),
            diagnostics: DiagnosticBag::new(),
            binder: Binder::new(),
            interner: TypeInterner::default(),
            registry: options.registry,
            file: options.file.unwrap_or_else(|| "<anonymous>".to_string()),
            imported_functions: options.imported_functions,
            function_signatures,
            current_return_type: None,
            inferred_return_types: None,
            external_model_bindings: HashMap::new(),
        }
    }

    /// Check a whole program, mirroring `TypeChecker.check`.
    pub fn check(&mut self, program: &Program) -> Vec<Diagnostic> {
        self.diagnostics = DiagnosticBag::new();
        self.binder = Binder::new();
        self.external_model_bindings = HashMap::new();
        for stmt in &program.body {
            self.check_statement(stmt);
        }
        self.diagnostics.all()
    }

    /// The binder accumulated during the last `check`, mirroring
    /// `TypeChecker.getBinder`.
    #[must_use]
    pub fn binder(&self) -> &Binder {
        &self.binder
    }

    /// Detach the workspace registry, if any. Host bindings use this to share
    /// a single `WorkspaceRegistry` across many short-lived checkers — the way
    /// `project.ts` shares one registry across every file — taking it out for
    /// the duration of a single `check` and putting it back afterwards.
    #[must_use]
    pub fn take_registry(&mut self) -> Option<WorkspaceRegistry> {
        self.registry.take()
    }

    /// Get the set of exported (user-declared) functions, mirroring
    /// `TypeChecker.getExportedFunctions`.
    #[must_use]
    pub fn exported_functions(&self) -> HashMap<String, FunctionSignature> {
        let mut result = HashMap::new();
        for (name, sig) in &self.function_signatures {
            if sig.binding.is_some() {
                result.insert(
                    name.clone(),
                    FunctionSignature {
                        params: sig.params.clone(),
                        return_type: sig.return_type.clone(),
                    },
                );
            }
        }
        result
    }

    fn check_statement(&mut self, node: &Statement) {
        match node {
            Statement::VariableDeclaration { .. } | Statement::ConstantDeclaration { .. } => {
                self.check_declaration(node)
            }
            Statement::ModelDeclaration { .. } => self.check_model_declaration(node),
            Statement::ImportDeclaration { .. } => self.check_import_declaration(node),
            Statement::PrintStatement { argument, .. } => {
                self.infer_type(argument);
            }
            Statement::Assignment { .. } => self.check_assignment(node),
            Statement::IfStatement { .. } => self.check_if_statement(node),
            Statement::WhileStatement { .. } => self.check_while_statement(node),
            Statement::FunctionDeclaration { .. } => self.check_function_declaration(node),
            Statement::ReturnStatement { value, location } => {
                let return_type = if self.current_return_type.is_some() {
                    self.literal_aware_type(value)
                } else {
                    self.infer_type(value)
                };
                if self.inferred_return_types.is_some() {
                    if let Some(list) = self.inferred_return_types.as_mut() {
                        list.push(return_type.clone());
                    }
                } else if let Some(current) = &self.current_return_type {
                    if !self.is_assignable_to(&return_type, current) {
                        self.diagnostics.error(
                            codes::RETURN_TYPE_MISMATCH,
                            format!(
                                "Return type mismatch: expected '{}', got '{}'",
                                self.format_type(Some(current)),
                                self.format_type(Some(&return_type))
                            ),
                            location.clone(),
                            DiagnosticOptions::default(),
                        );
                    }
                }
            }
            Statement::ExpressionStatement { expression, .. } => {
                self.infer_type(expression);
            }
            Statement::BreakStatement { .. } | Statement::ContinueStatement { .. } => {}
        }
    }

    fn check_declaration(&mut self, node: &Statement) {
        let (name, value, type_annotation, constant, location) = match node {
            Statement::VariableDeclaration {
                name,
                value,
                type_annotation,
                location,
                ..
            } => (name, value, type_annotation, false, location),
            Statement::ConstantDeclaration {
                name,
                value,
                type_annotation,
                location,
                ..
            } => (name, value, type_annotation, true, location),
            _ => unreachable!(),
        };

        let annotation_rt: Option<RavenType> = type_annotation.clone().map(Into::into);
        let actual_type = if annotation_rt.is_some() {
            self.literal_aware_type(value)
        } else {
            self.infer_type(value)
        };

        if let Some(annot) = &annotation_rt {
            if !self.is_assignable_to(&actual_type, annot) {
                let suggested = format_type(&actual_type);
                let expected = format_type(annot);
                self.diagnostics.error(
                    codes::DECLARATION_TYPE_MISMATCH,
                    format!(
                        "Type mismatch in declaration of '{}': expected '{}', but got '{}'",
                        name, expected, suggested
                    ),
                    location.clone(),
                    DiagnosticOptions {
                        hint: Some(format!(
                            "Either change the annotation to '{suggested}' or change the value to match '{expected}'."
                        )),
                        suggestions: vec![
                            DiagnosticSuggestion {
                                message: format!("Change the annotation to '{suggested}'"),
                                replacement: None,
                                location: None,
                            },
                            DiagnosticSuggestion {
                                message: format!("Change the value to match '{expected}'"),
                                replacement: None,
                                location: None,
                            },
                        ],
                    },
                );
            }
        }

        let origin = if annotation_rt.is_some() {
            SymbolOrigin::Local
        } else {
            SymbolOrigin::Inferred
        };
        let type_ = annotation_rt.unwrap_or(actual_type);
        let binding = self.binder.declare(
            name.clone(),
            if constant {
                SymbolKind::Constant
            } else {
                SymbolKind::Variable
            },
            type_.clone(),
            location.clone(),
            origin.clone(),
            None,
        );
        let success = self.symbol_table.declare(
            name.clone(),
            SymbolInfo {
                type_,
                constant,
                binding: Some(binding),
                origin: Some(origin),
                source: None,
            },
        );

        if !success {
            self.diagnostics.error(
                codes::DUPLICATE_DECLARATION,
                format!("'{name}' has already been declared."),
                location.clone(),
                DiagnosticOptions::default(),
            );
        }
    }

    fn check_model_declaration(&mut self, node: &Statement) {
        let (name, value, type_annotation, external, location) = match node {
            Statement::ModelDeclaration {
                name,
                value,
                type_annotation,
                external,
                location,
            } => (name, value, type_annotation, *external, location),
            _ => unreachable!(),
        };

        let type_: RavenType;
        if external {
            type_ = type_annotation
                .clone()
                .map(Into::into)
                .unwrap_or(RavenType::Any);
        } else {
            let annotation_rt: Option<RavenType> = type_annotation.clone().map(Into::into);
            let actual_type = if annotation_rt.is_some() {
                self.literal_aware_type(value)
            } else {
                self.infer_type(value)
            };

            if let Some(annot) = &annotation_rt {
                if is_direct_self_alias(annot, name) {
                    self.diagnostics.error(
                        codes::RECURSIVE_MODEL_CYCLE,
                        format!(
                            "Model '{name}' cannot reference itself directly. Use a union or optional type instead."
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                    type_ = RavenType::Any;
                } else if !self.is_assignable_to(&actual_type, annot) {
                    self.diagnostics.error(
                        codes::MODEL_TYPE_MISMATCH,
                        format!(
                            "Type mismatch in model '{name}': expected '{}', but got '{}'",
                            self.format_type(Some(annot)),
                            self.format_type(Some(&actual_type))
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                    type_ = annot.clone();
                } else {
                    type_ = annot.clone();
                }
            } else {
                type_ = actual_type;
            }
        }

        let source = if external {
            Some("external".to_string())
        } else {
            Some(self.file.clone())
        };
        let binding = self.binder.declare(
            name.clone(),
            SymbolKind::Model,
            type_.clone(),
            location.clone(),
            SymbolOrigin::Model,
            source.clone(),
        );

        let success = self.symbol_table.declare(
            name.clone(),
            SymbolInfo {
                type_: type_.clone(),
                constant: true,
                binding: Some(binding),
                origin: Some(SymbolOrigin::Model),
                source,
            },
        );
        if !success {
            self.diagnostics.error(
                codes::DUPLICATE_DECLARATION,
                format!("'{name}' has already been declared."),
                location.clone(),
                DiagnosticOptions::default(),
            );
        }

        if let Some(registry) = self.registry.as_mut() {
            let result = registry.publish(
                name.clone(),
                type_.clone(),
                external,
                self.file.clone(),
                location.clone(),
            );
            match result {
                crate::registry::PublishResult::Ok => {}
                crate::registry::PublishResult::Err { message, existing } => {
                    self.diagnostics.error(
                        codes::MODEL_REGISTRY_CONFLICT,
                        message,
                        location.clone(),
                        DiagnosticOptions {
                            hint: Some(format!(
                                "'{name}' was first published in {}. Give this one a different name, or make both shapes match.",
                                existing.file
                            )),
                            suggestions: Vec::new(),
                        },
                    );
                }
            }
        }
    }

    fn check_import_declaration(&mut self, node: &Statement) {
        let (names, source, location) = match node {
            Statement::ImportDeclaration {
                names,
                source,
                location,
            } => (names, source, location),
            _ => unreachable!(),
        };
        for name in names {
            if let Some(imported) = self.imported_functions.get(name) {
                let function_type = RavenType::Function {
                    params: imported.params.clone(),
                    return_type: Box::new(imported.return_type.clone()),
                };
                let binding = self.binder.declare(
                    name.clone(),
                    SymbolKind::Function,
                    function_type,
                    location.clone(),
                    SymbolOrigin::Import,
                    Some(source.clone()),
                );
                self.function_signatures.insert(
                    name.clone(),
                    FunctionSignatureEntry {
                        params: imported.params.clone(),
                        return_type: imported.return_type.clone(),
                        binding: Some(binding),
                    },
                );
                continue;
            }

            let in_registry = self
                .registry
                .as_ref()
                .and_then(|r| r.lookup(name))
                .is_some();
            if in_registry {
                self.diagnostics.error(
                    codes::INVALID_IMPORT_TARGET,
                    format!(
                        "'{name}' is a published model, not code — models don't need an import, just use the name directly."
                    ),
                    location.clone(),
                    DiagnosticOptions {
                        hint: None,
                        suggestions: vec![DiagnosticSuggestion {
                            message: format!("Remove the import and reference '{name}' directly."),
                            replacement: None,
                            location: None,
                        }],
                    },
                );
                continue;
            }

            self.diagnostics.error(
                codes::UNRESOLVED_IMPORT,
                format!(
                    "Cannot resolve import '{name}' from '{source}'. Make sure it's declared as a top-level function there."
                ),
                location.clone(),
                DiagnosticOptions::default(),
            );
        }
    }

    fn check_assignment(&mut self, node: &Statement) {
        let (name, value, location) = match node {
            Statement::Assignment {
                name,
                value,
                location,
            } => (name, value, location),
            _ => unreachable!(),
        };

        let symbol = self.symbol_table.lookup(name).cloned();
        let symbol = match symbol {
            None => {
                let in_registry = self
                    .registry
                    .as_ref()
                    .and_then(|r| r.lookup(name))
                    .is_some();
                if in_registry {
                    self.diagnostics.error(
                        codes::READONLY_MODEL_REASSIGNMENT,
                        format!(
                            "Cannot reassign '{name}': it's a published model, which is read-only outside the file that declares it."
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                } else {
                    self.diagnostics.error(
                        codes::UNDECLARED_ASSIGNMENT_TARGET,
                        format!("Cannot assign to undeclared variable '{name}'"),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                }
                return;
            }
            Some(s) => s,
        };

        self.binder.reference(symbol.binding, location.clone());

        if symbol.constant {
            self.diagnostics.error(
                codes::CONST_REASSIGNMENT,
                format!("Cannot reassign constant '{name}' (declared with 'const')"),
                location.clone(),
                DiagnosticOptions {
                    hint: Some(format!(
                        "Use 'let' instead of 'const' if '{name}' needs to change later."
                    )),
                    suggestions: vec![DiagnosticSuggestion {
                        message: format!("Change 'const {name}' to 'let {name}'"),
                        replacement: Some("let".to_string()),
                        location: None,
                    }],
                },
            );
            return;
        }

        let value_type = self.literal_aware_type(value);
        if !self.is_assignable_to(&value_type, &symbol.type_) {
            self.diagnostics.error(
                codes::ASSIGNMENT_TYPE_MISMATCH,
                format!(
                    "Type mismatch in assignment to '{name}': expected '{}', got '{}'",
                    self.format_type(Some(&symbol.type_)),
                    self.format_type(Some(&value_type))
                ),
                location.clone(),
                DiagnosticOptions::default(),
            );
        }
    }

    fn check_if_statement(&mut self, node: &Statement) {
        let (condition, consequent, alternate) = match node {
            Statement::IfStatement {
                condition,
                consequent,
                alternate,
                ..
            } => (condition, consequent, alternate),
            _ => unreachable!(),
        };
        let condition_type = self.infer_type(condition);
        if !self.is_assignable_to(&condition_type, &RavenType::Boolean) {
            self.diagnostics.error(
                codes::NON_BOOLEAN_CONDITION,
                format!(
                    "If condition must be a boolean, got '{}'",
                    self.format_type(Some(&condition_type))
                ),
                condition.location().clone(),
                DiagnosticOptions::default(),
            );
        }

        self.symbol_table.enter_scope();
        for stmt in consequent {
            self.check_statement(stmt);
        }
        let _ = self.symbol_table.exit_scope();

        if let Some(alternate) = alternate {
            self.symbol_table.enter_scope();
            for stmt in alternate {
                self.check_statement(stmt);
            }
            let _ = self.symbol_table.exit_scope();
        }
    }

    fn check_while_statement(&mut self, node: &Statement) {
        let (condition, body) = match node {
            Statement::WhileStatement {
                condition, body, ..
            } => (condition, body),
            _ => unreachable!(),
        };
        let condition_type = self.infer_type(condition);
        if !self.is_assignable_to(&condition_type, &RavenType::Boolean) {
            self.diagnostics.error(
                codes::NON_BOOLEAN_CONDITION,
                format!(
                    "While condition must be a boolean, got '{}'",
                    self.format_type(Some(&condition_type))
                ),
                condition.location().clone(),
                DiagnosticOptions::default(),
            );
        }

        self.symbol_table.enter_scope();
        for stmt in body {
            self.check_statement(stmt);
        }
        let _ = self.symbol_table.exit_scope();
    }

    fn check_function_declaration(&mut self, node: &Statement) {
        let (name, parameters, return_type, body, location) = match node {
            Statement::FunctionDeclaration {
                name,
                parameters,
                return_type,
                body,
                location,
            } => (name, parameters, return_type, body, location),
            _ => unreachable!(),
        };

        if self.function_signatures.contains_key(name) {
            self.diagnostics.error(
                codes::DUPLICATE_FUNCTION,
                format!("Function '{name}' has already been declared"),
                location.clone(),
                DiagnosticOptions::default(),
            );
        }

        let param_types: Vec<RavenType> = parameters
            .iter()
            .map(|p| {
                p.type_annotation
                    .clone()
                    .map(Into::into)
                    .unwrap_or(RavenType::Any)
            })
            .collect();

        let is_return_type_inferred = return_type.is_none();
        let function_return = return_type
            .clone()
            .map(Into::into)
            .unwrap_or(RavenType::Any);

        let function_type = RavenType::Function {
            params: param_types.clone(),
            return_type: Box::new(function_return.clone()),
        };

        let function_binding = self.binder.declare(
            name.clone(),
            SymbolKind::Function,
            function_type,
            location.clone(),
            SymbolOrigin::Local,
            Some(self.file.clone()),
        );

        let mut signature = FunctionSignatureEntry {
            params: param_types.clone(),
            return_type: function_return.clone(),
            binding: Some(function_binding),
        };
        self.function_signatures
            .insert(name.clone(), signature.clone());

        self.symbol_table.enter_scope();
        let mut seen_parameters: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        let previous_return_type = self.current_return_type.clone();
        let previous_inferred_returns = self.inferred_return_types.take();
        self.current_return_type = if is_return_type_inferred {
            None
        } else {
            return_type.clone().map(Into::into)
        };
        self.inferred_return_types = if is_return_type_inferred {
            Some(Vec::new())
        } else {
            None
        };

        for param in parameters {
            if seen_parameters.contains(&param.name) {
                self.diagnostics.error(
                    codes::DUPLICATE_PARAMETER,
                    format!(
                        "Duplicate parameter name '{}' in function '{name}'",
                        param.name
                    ),
                    location.clone(),
                    DiagnosticOptions::default(),
                );
            }
            seen_parameters.insert(param.name.clone());

            let param_type = param
                .type_annotation
                .clone()
                .map(Into::into)
                .unwrap_or(RavenType::Any);
            let param_origin = if param.type_annotation.is_some() {
                SymbolOrigin::Local
            } else {
                SymbolOrigin::Inferred
            };
            let param_binding = self.binder.declare(
                param.name.clone(),
                SymbolKind::Parameter,
                param_type.clone(),
                param.location.clone().unwrap_or_else(|| location.clone()),
                param_origin.clone(),
                None,
            );
            let _ = self.symbol_table.declare(
                param.name.clone(),
                SymbolInfo {
                    type_: param_type,
                    constant: false,
                    binding: Some(param_binding),
                    origin: Some(param_origin),
                    source: None,
                },
            );
        }

        for stmt in body {
            self.check_statement(stmt);
        }

        if is_return_type_inferred {
            let returns = self.inferred_return_types.clone().unwrap_or_default();
            let inferred = if returns.is_empty() {
                RavenType::Any
            } else {
                self.best_common_type(returns)
            };

            signature.return_type = inferred.clone();
            self.function_signatures
                .insert(name.clone(), signature.clone());

            self.binder.update_type(
                function_binding,
                RavenType::Function {
                    params: signature.params.clone(),
                    return_type: Box::new(inferred),
                },
            );
        }

        let _ = self.symbol_table.exit_scope();
        self.current_return_type = previous_return_type;
        self.inferred_return_types = previous_inferred_returns;
    }

    fn literal_aware_type(&mut self, node: &Expression) -> RavenType {
        match node {
            Expression::StringLiteral { value, .. } => RavenType::Literal {
                value: crate::type_::LiteralValue::String(value.clone()),
            },
            Expression::NumberLiteral { value, .. } => RavenType::Literal {
                value: crate::type_::LiteralValue::Number(*value),
            },
            Expression::BooleanLiteral { value, .. } => RavenType::Literal {
                value: crate::type_::LiteralValue::Boolean(*value),
            },
            _ => self.infer_type(node),
        }
    }

    fn infer_type(&mut self, node: &Expression) -> RavenType {
        match node {
            Expression::StringLiteral { .. } => RavenType::String,
            Expression::NumberLiteral { .. } => RavenType::Number,
            Expression::BooleanLiteral { .. } => RavenType::Boolean,
            Expression::NoneLiteral { .. } => RavenType::None,

            Expression::Identifier { name, location } => {
                if let Some(symbol) = self.symbol_table.lookup(name).cloned() {
                    self.binder.reference(symbol.binding, location.clone());
                    return symbol.type_;
                }

                let published = self.registry.as_ref().and_then(|r| r.lookup(name).cloned());
                if let Some(published) = published {
                    let binding = self
                        .external_model_bindings
                        .get(name)
                        .copied()
                        .unwrap_or_else(|| {
                            let b = self.binder.declare(
                                name.clone(),
                                SymbolKind::Model,
                                published.type_.clone(),
                                published.location.clone(),
                                SymbolOrigin::Model,
                                Some(published.file.clone()),
                            );
                            self.external_model_bindings.insert(name.clone(), b);
                            b
                        });
                    self.binder.reference(Some(binding), location.clone());
                    return published.type_;
                }

                let mut candidates: Vec<String> = self.symbol_table.all_names();
                if let Some(registry) = &self.registry {
                    candidates.extend(registry.names());
                }
                let suggestion = closest_match(name, &candidates);
                self.emit_undeclared(name, location.clone(), suggestion);
                RavenType::Any
            }

            Expression::UnaryExpression {
                operator: _,
                argument,
                location,
            } => {
                let arg_type = self.infer_type(argument);
                if !self.is_assignable_to(&arg_type, &RavenType::Boolean) {
                    self.diagnostics.error(
                        codes::INVALID_UNARY_OPERAND,
                        format!(
                            "Operator 'not' requires a boolean operand, got '{}'",
                            self.format_type(Some(&arg_type))
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                }
                RavenType::Boolean
            }

            Expression::CallExpression {
                callee,
                arguments,
                location,
            } => {
                let signature = self.function_signatures.get(callee).cloned();
                let signature = match signature {
                    None => {
                        let candidates: Vec<String> =
                            self.function_signatures.keys().cloned().collect();
                        let suggestion = closest_match(callee, &candidates);
                        self.emit_undeclared_function(callee, location.clone(), suggestion);
                        return RavenType::Any;
                    }
                    Some(s) => s,
                };

                self.binder.reference(signature.binding, location.clone());
                if arguments.len() != signature.params.len() {
                    self.diagnostics.error(
                        codes::ARGUMENT_COUNT_MISMATCH,
                        format!(
                            "Function '{callee}' expects {} argument(s), but got {}",
                            signature.params.len(),
                            arguments.len()
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                }

                for (i, arg) in arguments.iter().enumerate() {
                    let expected_type = signature.params.get(i).cloned();
                    let arg_type = if expected_type.is_some() {
                        self.literal_aware_type(arg)
                    } else {
                        self.infer_type(arg)
                    };
                    if let Some(expected) = &expected_type {
                        if !expected.is_any() && !self.is_assignable_to(&arg_type, expected) {
                            self.diagnostics.error(
                                codes::ARGUMENT_TYPE_MISMATCH,
                                format!(
                                    "Argument {} of '{callee}': expected '{}', got '{}'",
                                    i + 1,
                                    self.format_type(Some(expected)),
                                    self.format_type(Some(&arg_type))
                                ),
                                arg.location().clone(),
                                DiagnosticOptions::default(),
                            );
                        }
                    }
                }
                signature.return_type
            }

            Expression::ArrayLiteral { elements, .. } => {
                if elements.is_empty() {
                    return RavenType::Array {
                        element_type: Box::new(RavenType::Any),
                    };
                }
                let element_types: Vec<RavenType> =
                    elements.iter().map(|e| self.infer_type(e)).collect();
                RavenType::Array {
                    element_type: Box::new(self.best_common_type(element_types)),
                }
            }

            Expression::TupleLiteral { elements, .. } => {
                let element_types: Vec<RavenType> =
                    elements.iter().map(|e| self.infer_type(e)).collect();
                RavenType::Tuple {
                    elements: element_types,
                }
            }

            Expression::ObjectLiteral { properties, .. } => {
                let mut fields: IndexMap<String, RavenType> = IndexMap::new();
                for property in properties {
                    let field_type = self.infer_type(&property.value);
                    fields.insert(property.key.clone(), field_type);
                }
                RavenType::Record { fields }
            }

            Expression::MemberExpression {
                object,
                property,
                location,
            } => {
                let inferred_object = self.infer_type(object);
                let object_type = self.resolve_ref(inferred_object);

                if object_type.is_any() {
                    return RavenType::Any;
                }

                if let RavenType::Record { fields } = &object_type {
                    if let Some(field_type) = fields.get(property) {
                        return field_type.clone();
                    }
                    self.diagnostics.error(
                        codes::UNKNOWN_PROPERTY,
                        format!(
                            "Property '{property}' does not exist on type '{}'",
                            self.format_type(Some(&object_type))
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                    return RavenType::Any;
                }

                self.diagnostics.error(
                    codes::INVALID_PROPERTY_ACCESS,
                    format!(
                        "Cannot access property '{property}' on non-record type '{}'",
                        self.format_type(Some(&object_type))
                    ),
                    location.clone(),
                    DiagnosticOptions::default(),
                );
                RavenType::Any
            }

            Expression::IndexExpression {
                array,
                index,
                location: _location,
            } => {
                let array_type = self.infer_type(array);
                let index_type = self.infer_type(index);

                if !matches!(normalize(&index_type), RavenType::Number)
                    && !matches!(normalize(&index_type), RavenType::Any)
                {
                    self.diagnostics.error(
                        codes::INVALID_INDEX_TYPE,
                        format!(
                            "Array index must be a number, got '{}'",
                            self.format_type(Some(&index_type))
                        ),
                        index.location().clone(),
                        DiagnosticOptions::default(),
                    );
                }
                if let RavenType::Tuple { elements } = array_type {
                    if let Expression::NumberLiteral { value, .. } = &**index {
                        let i = *value;
                        if i < 0.0 || i >= elements.len() as f64 {
                            self.diagnostics.error(
                                codes::TUPLE_INDEX_OUT_OF_BOUNDS,
                                format!(
                                    "Tuple index {} is out of bounds for '{}' (length {})",
                                    format_number_trunc(i),
                                    self.format_type(Some(&RavenType::Tuple {
                                        elements: elements.clone(),
                                    })),
                                    elements.len()
                                ),
                                index.location().clone(),
                                DiagnosticOptions::default(),
                            );
                            return RavenType::Any;
                        }
                        return elements.get(i as usize).cloned().unwrap_or(RavenType::Any);
                    }
                    return self.best_common_type(elements.clone());
                }

                if let RavenType::Array { element_type } = array_type {
                    return *element_type;
                }
                if array_type.is_any() {
                    return RavenType::Any;
                }
                self.diagnostics.error(
                    codes::INVALID_INDEX_TARGET,
                    format!(
                        "Cannot index a non-array value of type '{}'",
                        self.format_type(Some(&array_type))
                    ),
                    array.location().clone(),
                    DiagnosticOptions::default(),
                );
                RavenType::Any
            }

            Expression::BinaryExpression {
                operator,
                left,
                right,
                location,
            } => {
                let left_type = self.infer_type(left);
                let right_type = self.infer_type(right);

                if left_type.is_any() {
                    return right_type;
                }
                if right_type.is_any() {
                    return left_type;
                }

                if operator == "and" || operator == "or" {
                    if !left_type.is_boolean() || !right_type.is_boolean() {
                        self.diagnostics.error(
                            codes::INVALID_LOGICAL_OPERANDS,
                            format!(
                                "Operator '{operator}' requires two booleans. Got '{}' and '{}'",
                                self.format_type(Some(&left_type)),
                                self.format_type(Some(&right_type))
                            ),
                            location.clone(),
                            DiagnosticOptions::default(),
                        );
                    }
                    return RavenType::Boolean;
                }

                if ["==", "!=", "<", "<=", ">", ">="].contains(&operator.as_str()) {
                    let comparable = self.is_assignable_to(&left_type, &right_type)
                        || self.is_assignable_to(&right_type, &left_type);
                    if !comparable {
                        self.diagnostics.error(
                            codes::INCOMPARABLE_TYPES,
                            format!(
                                "Cannot compare '{}' with '{}'",
                                self.format_type(Some(&left_type)),
                                self.format_type(Some(&right_type))
                            ),
                            location.clone(),
                            DiagnosticOptions::default(),
                        );
                    }
                    return RavenType::Boolean;
                }

                if operator == "+" {
                    if let RavenType::Array {
                        element_type: left_element,
                    } = &left_type
                    {
                        if let RavenType::Array {
                            element_type: right_element,
                        } = &right_type
                        {
                            return RavenType::Array {
                                element_type: Box::new(union_type(&[
                                    *left_element.clone(),
                                    *right_element.clone(),
                                ])),
                            };
                        }
                        return RavenType::Array {
                            element_type: Box::new(union_type(&[
                                *left_element.clone(),
                                right_type.clone(),
                            ])),
                        };
                    }

                    if left_type.is_string() || right_type.is_string() {
                        return RavenType::String;
                    }

                    if !left_type.is_number() || !right_type.is_number() {
                        self.diagnostics.error(
                            codes::INVALID_PLUS_OPERANDS,
                            format!(
                                "Operator '+' requires numbers, strings, or arrays. Got '{}' and '{}'",
                                self.format_type(Some(&left_type)),
                                self.format_type(Some(&right_type))
                            ),
                            location.clone(),
                            DiagnosticOptions::default(),
                        );
                    }
                    return RavenType::Number;
                }

                if !left_type.is_number() || !right_type.is_number() {
                    self.diagnostics.error(
                        codes::INVALID_ARITHMETIC_OPERANDS,
                        format!(
                            "Operator '{operator}' requires two numbers. Got '{}' and '{}'",
                            self.format_type(Some(&left_type)),
                            self.format_type(Some(&right_type))
                        ),
                        location.clone(),
                        DiagnosticOptions::default(),
                    );
                }
                RavenType::Number
            }
        }
    }

    fn emit_undeclared(
        &mut self,
        name: &str,
        location: crate::ast::SourceLocation,
        suggestion: Option<String>,
    ) {
        self.diagnostics.error(
            codes::UNDECLARED_VARIABLE,
            format!("Undeclared variable '{name}'"),
            location.clone(),
            match suggestion {
                Some(s) => DiagnosticOptions {
                    hint: Some(format!("Did you mean '{s}'?")),
                    suggestions: vec![DiagnosticSuggestion {
                        message: format!("Did you mean '{s}'?"),
                        replacement: Some(s),
                        location: Some(location),
                    }],
                },
                None => DiagnosticOptions::default(),
            },
        );
    }

    fn emit_undeclared_function(
        &mut self,
        name: &str,
        location: crate::ast::SourceLocation,
        suggestion: Option<String>,
    ) {
        self.diagnostics.error(
            codes::UNDECLARED_FUNCTION,
            format!("Undeclared function '{name}'"),
            location.clone(),
            match suggestion {
                Some(s) => DiagnosticOptions {
                    hint: Some(format!("Did you mean '{s}'?")),
                    suggestions: vec![DiagnosticSuggestion {
                        message: format!("Did you mean '{s}'?"),
                        replacement: Some(s),
                        location: Some(location),
                    }],
                },
                None => DiagnosticOptions::default(),
            },
        );
    }

    fn best_common_type(&mut self, types: Vec<RavenType>) -> RavenType {
        if types.is_empty() {
            return RavenType::Any;
        }
        if types.iter().any(RavenType::is_any) {
            return RavenType::Any;
        }

        let first = &types[0];
        if types.iter().all(|t| self.same_type(t, first)) {
            return first.clone();
        }

        if types.iter().all(|t| matches!(t, RavenType::Record { .. })) {
            let records: Vec<RavenType> = types
                .iter()
                .filter(|t| matches!(t, RavenType::Record { .. }))
                .cloned()
                .collect();
            return self.merge_record_types(records);
        }

        union_type(&types)
    }

    fn merge_record_types(&mut self, records: Vec<RavenType>) -> RavenType {
        let mut all_keys: IndexSet<String> = IndexSet::new();
        for record in &records {
            if let RavenType::Record { fields } = record {
                for key in fields.keys() {
                    all_keys.insert(key.clone());
                }
            }
        }

        let mut fields: IndexMap<String, RavenType> = IndexMap::new();
        for key in all_keys {
            let mut present_types: Vec<RavenType> = Vec::new();
            for record in &records {
                if let RavenType::Record { fields: rec_fields } = record {
                    if let Some(t) = rec_fields.get(&key) {
                        present_types.push(t.clone());
                    }
                }
            }
            let present_count = present_types.len();
            let merged = self.best_common_type(present_types);
            fields.insert(
                key,
                if present_count == records.len() {
                    merged
                } else {
                    optional_type(&merged)
                },
            );
        }

        RavenType::Record { fields }
    }

    fn resolve_ref(&self, type_: RavenType) -> RavenType {
        if let RavenType::Ref { name } = &type_ {
            let published = self.registry.as_ref().and_then(|r| r.lookup(name));
            return published.map(|p| p.type_.clone()).unwrap_or(RavenType::Any);
        }
        type_
    }

    #[must_use]
    fn same_type(&self, left: &RavenType, right: &RavenType) -> bool {
        let l = self.resolve_ref(left.clone());
        let r = self.resolve_ref(right.clone());
        shared_same_type(&self.interner, &l, &r)
    }

    #[must_use]
    fn is_assignable_to(&self, source: &RavenType, target: &RavenType) -> bool {
        let s = self.resolve_ref(source.clone());
        let t = self.resolve_ref(target.clone());
        shared_is_assignable_to(&s, &t)
    }

    #[must_use]
    fn format_type(&self, type_: Option<&RavenType>) -> String {
        match type_ {
            None => "unknown".to_string(),
            Some(t) => format_type(t),
        }
    }
}

/// Mirror of `recursive.ts`'s `isDirectSelfAlias`.
fn is_direct_self_alias(type_: &RavenType, self_name: &str) -> bool {
    matches!(
        type_,
        RavenType::Ref { name } if name == self_name
    )
}

fn format_number_trunc(f: f64) -> String {
    if f.fract() == 0.0 && f.is_finite() {
        format!("{}", f as i64)
    } else {
        f.to_string()
    }
}
