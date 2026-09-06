//! AST-level optimization passes, mirroring `compiler/src/optimizer/index.ts`.
//!
//! Folds constant sub-expressions and drops statements that are unreachable
//! after an unconditional `return` within the same block. Runs purely on the
//! AST (no type information needed), after parsing and independently of the
//! typechecker.
//!
//! ## Intentional deviation from the TS implementation
//!
//! The TS `optimizeStatement` switch has no `case` for `ModelDeclaration` or
//! `ImportDeclaration` and no `default`, so those statements fall through
//! and the function implicitly returns `undefined` — silently deleting every
//! `model` and `import` statement whenever `optimize()` runs (which is the
//! default in `compileFile`). Confirmed by running the TS optimizer directly:
//! an `ImportDeclaration` + `ModelDeclaration` + `PrintStatement` program
//! comes back with only the `PrintStatement` surviving. The emitter *does*
//! know how to emit both (`emitModelDeclaration`, `emitImportDeclaration`),
//! so this is a bug, not a deliberate elision. This port fixes it by passing
//! both through unchanged (their contained expression is still folded),
//! matching how `BreakStatement`/`ContinueStatement` are already handled.
//! Per `AGENTS.md`'s golden-diff rule: this is the one intentional diff
//! against the pre-port TS output, called out explicitly rather than ported
//! silently.

use crate::ast::{Expression, Program, Statement};

/// Runs all optimization passes over `program`, returning a new, optimized
/// `Program`. Mirrors `optimize()` in `optimizer/index.ts`.
#[must_use]
pub fn optimize(program: &Program) -> Program {
    Program {
        node_type: program.node_type.clone(),
        body: optimize_statements(&program.body),
    }
}

fn optimize_statements(statements: &[Statement]) -> Vec<Statement> {
    let mut optimized: Vec<Statement> = Vec::new();
    for statement in statements {
        if optimized
            .iter()
            .any(|s| matches!(s, Statement::ReturnStatement { .. }))
        {
            break;
        }
        if let Some(next) = optimize_statement(statement) {
            optimized.push(next);
        }
    }
    optimized
}

fn optimize_statement(statement: &Statement) -> Option<Statement> {
    match statement {
        Statement::VariableDeclaration {
            location,
            name,
            value,
            type_annotation,
        } => Some(Statement::VariableDeclaration {
            location: location.clone(),
            name: name.clone(),
            value: Box::new(optimize_expression(value)),
            type_annotation: type_annotation.clone(),
        }),
        Statement::ConstantDeclaration {
            location,
            name,
            value,
            type_annotation,
        } => Some(Statement::ConstantDeclaration {
            location: location.clone(),
            name: name.clone(),
            value: Box::new(optimize_expression(value)),
            type_annotation: type_annotation.clone(),
        }),
        Statement::Assignment {
            location,
            name,
            value,
        } => Some(Statement::Assignment {
            location: location.clone(),
            name: name.clone(),
            value: Box::new(optimize_expression(value)),
        }),
        Statement::PrintStatement { location, argument } => Some(Statement::PrintStatement {
            location: location.clone(),
            argument: Box::new(optimize_expression(argument)),
        }),
        Statement::ExpressionStatement {
            location,
            expression,
        } => Some(Statement::ExpressionStatement {
            location: location.clone(),
            expression: Box::new(optimize_expression(expression)),
        }),
        Statement::ReturnStatement { location, value } => Some(Statement::ReturnStatement {
            location: location.clone(),
            value: Box::new(optimize_expression(value)),
        }),
        Statement::IfStatement {
            location,
            condition,
            consequent,
            alternate,
        } => {
            let condition = optimize_expression(condition);
            if let Expression::BooleanLiteral {
                value: cond_value, ..
            } = condition
            {
                return if cond_value {
                    Some(Statement::IfStatement {
                        location: location.clone(),
                        condition: Box::new(condition),
                        consequent: optimize_statements(consequent),
                        alternate: None,
                    })
                } else {
                    alternate.as_ref().map(|alt| Statement::IfStatement {
                        location: location.clone(),
                        condition: Box::new(condition),
                        consequent: optimize_statements(alt),
                        alternate: None,
                    })
                };
            }
            Some(Statement::IfStatement {
                location: location.clone(),
                condition: Box::new(condition),
                consequent: optimize_statements(consequent),
                alternate: alternate.as_ref().map(|alt| optimize_statements(alt)),
            })
        }
        Statement::WhileStatement {
            location,
            condition,
            body,
        } => {
            let condition = optimize_expression(condition);
            if matches!(condition, Expression::BooleanLiteral { value: false, .. }) {
                return None;
            }
            Some(Statement::WhileStatement {
                location: location.clone(),
                condition: Box::new(condition),
                body: optimize_statements(body),
            })
        }
        Statement::FunctionDeclaration {
            location,
            name,
            parameters,
            return_type,
            body,
        } => Some(Statement::FunctionDeclaration {
            location: location.clone(),
            name: name.clone(),
            parameters: parameters.clone(),
            return_type: return_type.clone(),
            body: optimize_statements(body),
        }),
        Statement::BreakStatement { location } => Some(Statement::BreakStatement {
            location: location.clone(),
        }),
        Statement::ContinueStatement { location } => Some(Statement::ContinueStatement {
            location: location.clone(),
        }),
        // See the module doc comment: the TS optimizer silently drops these
        // two. This port passes them through (folding the contained value)
        // instead of reproducing that bug.
        Statement::ModelDeclaration {
            location,
            name,
            value,
            type_annotation,
            external,
        } => Some(Statement::ModelDeclaration {
            location: location.clone(),
            name: name.clone(),
            value: Box::new(optimize_expression(value)),
            type_annotation: type_annotation.clone(),
            external: *external,
        }),
        Statement::ImportDeclaration { location, names, source } => {
            Some(Statement::ImportDeclaration {
                location: location.clone(),
                names: names.clone(),
                source: source.clone(),
            })
        }
    }
}

fn optimize_expression(expression: &Expression) -> Expression {
    match expression {
        Expression::BinaryExpression {
            location,
            operator,
            left,
            right,
        } => {
            let left = optimize_expression(left);
            let right = optimize_expression(right);
            if let (
                Expression::NumberLiteral { value: l, .. },
                Expression::NumberLiteral { value: r, .. },
            ) = (&left, &right)
            {
                if let Some(folded) = fold_numbers(operator, *l, *r) {
                    return match folded {
                        Folded::Number(n) => Expression::NumberLiteral {
                            location: location.clone(),
                            value: n,
                        },
                        Folded::Boolean(b) => Expression::BooleanLiteral {
                            location: location.clone(),
                            value: b,
                        },
                    };
                }
            }
            if let (
                Expression::BooleanLiteral { value: l, .. },
                Expression::BooleanLiteral { value: r, .. },
            ) = (&left, &right)
            {
                if let Some(folded) = fold_booleans(operator, *l, *r) {
                    return Expression::BooleanLiteral {
                        location: location.clone(),
                        value: folded,
                    };
                }
            }
            Expression::BinaryExpression {
                location: location.clone(),
                operator: operator.clone(),
                left: Box::new(left),
                right: Box::new(right),
            }
        }
        Expression::UnaryExpression {
            location,
            operator,
            argument,
        } => {
            let argument = optimize_expression(argument);
            if let Expression::BooleanLiteral { value, .. } = argument {
                Expression::BooleanLiteral {
                    location: location.clone(),
                    value: !value,
                }
            } else {
                Expression::UnaryExpression {
                    location: location.clone(),
                    operator: operator.clone(),
                    argument: Box::new(argument),
                }
            }
        }
        Expression::ArrayLiteral { location, elements } => Expression::ArrayLiteral {
            location: location.clone(),
            elements: elements.iter().map(optimize_expression).collect(),
        },
        Expression::IndexExpression {
            location,
            array,
            index,
        } => Expression::IndexExpression {
            location: location.clone(),
            array: Box::new(optimize_expression(array)),
            index: Box::new(optimize_expression(index)),
        },
        Expression::CallExpression {
            location,
            callee,
            arguments,
        } => Expression::CallExpression {
            location: location.clone(),
            callee: callee.clone(),
            arguments: arguments.iter().map(optimize_expression).collect(),
        },
        other => other.clone(),
    }
}

enum Folded {
    Number(f64),
    Boolean(bool),
}

fn fold_numbers(operator: &str, left: f64, right: f64) -> Option<Folded> {
    match operator {
        "+" => Some(Folded::Number(left + right)),
        "-" => Some(Folded::Number(left - right)),
        "*" => Some(Folded::Number(left * right)),
        "/" => {
            if right == 0.0 {
                None
            } else {
                Some(Folded::Number(left / right))
            }
        }
        "%" => {
            if right == 0.0 {
                None
            } else {
                Some(Folded::Number(left % right))
            }
        }
        "==" => Some(Folded::Boolean(left == right)),
        "!=" => Some(Folded::Boolean(left != right)),
        "<" => Some(Folded::Boolean(left < right)),
        "<=" => Some(Folded::Boolean(left <= right)),
        ">" => Some(Folded::Boolean(left > right)),
        ">=" => Some(Folded::Boolean(left >= right)),
        _ => None,
    }
}

fn fold_booleans(operator: &str, left: bool, right: bool) -> Option<bool> {
    match operator {
        "and" => Some(left && right),
        "or" => Some(left || right),
        "==" => Some(left == right),
        "!=" => Some(left != right),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::{Program, SourceLocation};

    fn loc() -> SourceLocation {
        SourceLocation::default()
    }

    fn num(n: f64) -> Expression {
        Expression::NumberLiteral {
            location: loc(),
            value: n,
        }
    }

    #[test]
    fn folds_constant_arithmetic() {
        let expr = Expression::BinaryExpression {
            location: loc(),
            operator: "+".into(),
            left: Box::new(num(1.0)),
            right: Box::new(num(2.0)),
        };
        let folded = optimize_expression(&expr);
        assert!(matches!(folded, Expression::NumberLiteral { value, .. } if value == 3.0));
    }

    #[test]
    fn does_not_fold_division_by_zero() {
        let expr = Expression::BinaryExpression {
            location: loc(),
            operator: "/".into(),
            left: Box::new(num(1.0)),
            right: Box::new(num(0.0)),
        };
        let folded = optimize_expression(&expr);
        assert!(matches!(folded, Expression::BinaryExpression { .. }));
    }

    #[test]
    fn drops_statements_after_return() {
        let program = Program {
            node_type: "Program".into(),
            body: vec![
                Statement::ReturnStatement {
                    location: loc(),
                    value: Box::new(num(1.0)),
                },
                Statement::PrintStatement {
                    location: loc(),
                    argument: Box::new(num(2.0)),
                },
            ],
        };
        let optimized = optimize(&program);
        assert_eq!(optimized.body.len(), 1);
    }

    #[test]
    fn preserves_model_and_import_declarations() {
        let program = Program {
            node_type: "Program".into(),
            body: vec![
                Statement::ImportDeclaration {
                    location: loc(),
                    names: vec!["login".into()],
                    source: "./auth".into(),
                },
                Statement::ModelDeclaration {
                    location: loc(),
                    name: "user".into(),
                    value: Box::new(Expression::ObjectLiteral {
                        location: loc(),
                        properties: vec![],
                    }),
                    type_annotation: None,
                    external: false,
                },
                Statement::PrintStatement {
                    location: loc(),
                    argument: Box::new(Expression::StringLiteral {
                        location: loc(),
                        value: "hi".into(),
                    }),
                },
            ],
        };
        let optimized = optimize(&program);
        assert_eq!(optimized.body.len(), 3);
    }
}
