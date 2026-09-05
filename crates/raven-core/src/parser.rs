//! Parser, mirroring `compiler/src/parser/parser.ts`.
//!
//! Produces `crate::ast::Program` directly — no intermediate JSON step.

use thiserror::Error;

use crate::ast::{Expression, ObjectProperty, Parameter, Program, Statement, TypeAnnotation};
use crate::lexer::{Token, TokenKind};

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{0}")]
pub struct ParseError(pub String);

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    #[must_use]
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    pub fn parse_program(&mut self) -> Result<Program, ParseError> {
        let mut body: Vec<Statement> = Vec::new();
        while self.peek()?.kind != TokenKind::Eof {
            body.push(self.parse_statement()?);
        }
        Ok(Program {
            node_type: "Program".to_string(),
            body,
        })
    }

    fn parse_statement(&mut self) -> Result<Statement, ParseError> {
        if self.check_keyword("print") {
            return self.parse_print();
        }
        if self.check_keyword("let") {
            return self.parse_let();
        }
        if self.check_keyword("const") {
            return self.parse_const();
        }
        if self.check_keyword("model") {
            return self.parse_model();
        }
        if self.check_keyword("import") {
            return self.parse_import();
        }
        if self.check_keyword("if") {
            return self.parse_if();
        }
        if self.check_keyword("while") {
            return self.parse_while();
        }
        if self.check_keyword("fn") {
            return self.parse_function_declaration();
        }
        if self.check_keyword("return") {
            return self.parse_return();
        }
        if self.check_keyword("break") {
            let token = self.advance()?.clone();
            return Ok(Statement::BreakStatement {
                location: token.location.clone(),
            });
        }
        if self.check_keyword("continue") {
            let token = self.advance()?.clone();
            return Ok(Statement::ContinueStatement {
                location: token.location.clone(),
            });
        }
        if self.peek()?.kind == TokenKind::Identifier {
            if let Some(next) = self.tokens.get(self.pos + 1) {
                if next.value == "=" {
                    return self.parse_assignment();
                }
            }
        }
        if self.peek()?.kind == TokenKind::Identifier {
            if let Some(next) = self.tokens.get(self.pos + 1) {
                if next.value == "(" {
                    let expr = self.parse_expression()?;
                    let loc = expr.location().clone();
                    return Ok(Statement::ExpressionStatement {
                        location: loc,
                        expression: Box::new(expr),
                    });
                }
            }
        }
        let peek = self.peek()?;
        Err(ParseError(format!(
            "Expected a statement, got: {} ({})",
            peek.value,
            peek.kind.as_str()
        )))
    }

    fn parse_print(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("print")?;
        self.expect("(")?;
        let argument = self.parse_expression()?;
        self.expect(")")?;
        Ok(Statement::PrintStatement {
            location: start,
            argument: Box::new(argument),
        })
    }

    fn parse_let(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("let")?;
        let name_token = self.peek()?.clone();
        if name_token.kind != TokenKind::Identifier {
            return Err(ParseError("Expected an identifier after 'let'".to_string()));
        }
        self.advance()?;
        let mut type_annotation: Option<TypeAnnotation> = None;
        if self.peek()?.value == ":" {
            self.advance()?;
            type_annotation = Some(self.parse_type_annotation()?);
        }
        self.expect("=")?;
        let value = self.parse_expression()?;
        Ok(Statement::VariableDeclaration {
            location: start,
            name: name_token.value.clone(),
            value: Box::new(value),
            type_annotation,
        })
    }

    fn parse_const(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("const")?;
        let name_token = self.peek()?.clone();
        if name_token.kind != TokenKind::Identifier {
            return Err(ParseError(
                "Expected an identifier after 'const'".to_string(),
            ));
        }
        self.advance()?;
        let mut type_annotation: Option<TypeAnnotation> = None;
        if self.peek()?.value == ":" {
            self.advance()?;
            type_annotation = Some(self.parse_type_annotation()?);
        }
        self.expect("=")?;
        let value = self.parse_expression()?;
        Ok(Statement::ConstantDeclaration {
            location: start,
            name: name_token.value.clone(),
            value: Box::new(value),
            type_annotation,
        })
    }

    fn parse_model(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("model")?;
        let name_token = self.peek()?.clone();
        if name_token.kind != TokenKind::Identifier {
            return Err(ParseError(
                "Expected an identifier after 'model'".to_string(),
            ));
        }
        self.advance()?;
        let mut type_annotation: Option<TypeAnnotation> = None;
        if self.peek()?.value == ":" {
            self.advance()?;
            type_annotation = Some(self.parse_type_annotation()?);
        }
        self.expect("=")?;
        let value = self.parse_expression()?;
        let external = Self::is_external_binding(&value);
        Ok(Statement::ModelDeclaration {
            location: start,
            name: name_token.value.clone(),
            value: Box::new(value),
            type_annotation,
            external,
        })
    }

    fn is_external_binding(expr: &Expression) -> bool {
        if let Expression::CallExpression { callee, .. } = expr {
            return callee == "api" || callee == "database";
        }
        if let Expression::MemberExpression { object, .. } = expr {
            let mut root: &Expression = object;
            while let Expression::MemberExpression { object: inner, .. } = root {
                root = inner;
            }
            if let Expression::Identifier { name, .. } = root {
                return name == "database" || name == "api";
            }
        }
        false
    }

    fn parse_import(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("import")?;
        let mut names: Vec<String> = Vec::new();
        if self.peek()?.value == "{" {
            self.advance()?;
            while self.peek()?.value != "}" {
                let name_token = self.peek()?.clone();
                if name_token.kind != TokenKind::Identifier {
                    return Err(ParseError(
                        "Expected an identifier in import list".to_string(),
                    ));
                }
                self.advance()?;
                names.push(name_token.value.clone());
                if self.peek()?.value == "," {
                    self.advance()?;
                }
            }
            self.expect("}")?;
        } else {
            let name_token = self.peek()?.clone();
            if name_token.kind != TokenKind::Identifier {
                return Err(ParseError(
                    "Expected an identifier after 'import'".to_string(),
                ));
            }
            self.advance()?;
            names.push(name_token.value.clone());
        }
        self.expect_keyword("from")?;
        let source_token = self.peek()?.clone();
        if source_token.kind != TokenKind::String {
            return Err(ParseError(
                "Expected a string module path after 'from'".to_string(),
            ));
        }
        self.advance()?;
        Ok(Statement::ImportDeclaration {
            location: start,
            names,
            source: source_token.value.clone(),
        })
    }

    fn parse_assignment(&mut self) -> Result<Statement, ParseError> {
        let name_token = self.advance()?.clone();
        let start = name_token.location.clone();
        self.expect("=")?;
        let value = self.parse_expression()?;
        Ok(Statement::Assignment {
            location: start,
            name: name_token.value.clone(),
            value: Box::new(value),
        })
    }

    fn parse_if(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("if")?;
        let condition = self.parse_expression()?;
        self.expect_keyword("then")?;
        let consequent = self.parse_block_until(&["else", "end"])?;
        let mut alternate: Option<Vec<Statement>> = None;
        if self.check_keyword("else") {
            self.advance()?;
            alternate = Some(self.parse_block_until(&["end"])?);
        }
        self.expect_keyword("end")?;
        Ok(Statement::IfStatement {
            location: start,
            condition: Box::new(condition),
            consequent,
            alternate,
        })
    }

    fn parse_while(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("while")?;
        let condition = self.parse_expression()?;
        self.expect_keyword("do")?;
        let body = self.parse_block_until(&["end"])?;
        self.expect_keyword("end")?;
        Ok(Statement::WhileStatement {
            location: start,
            condition: Box::new(condition),
            body,
        })
    }

    fn parse_function_declaration(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("fn")?;
        let name_token = self.peek()?.clone();
        if name_token.kind != TokenKind::Identifier {
            return Err(ParseError(
                "Expected a function name after 'fn'".to_string(),
            ));
        }
        self.advance()?;
        self.expect("(")?;
        let mut parameters: Vec<Parameter> = Vec::new();
        while self.peek()?.value != ")" {
            let param_name = self.peek()?.clone();
            if param_name.kind != TokenKind::Identifier {
                return Err(ParseError("Expected a parameter name".to_string()));
            }
            self.advance()?;
            self.expect(":")?;
            let type_annotation = self.parse_type_annotation()?;
            parameters.push(Parameter {
                name: param_name.value.clone(),
                type_annotation: Some(type_annotation),
                location: Some(param_name.location.clone()),
            });
            if self.peek()?.value == "," {
                self.advance()?;
            }
        }
        self.expect(")")?;
        self.expect(":")?;
        let return_type = self.parse_type_annotation()?;
        let body = self.parse_block_until(&["end"])?;
        self.expect_keyword("end")?;
        Ok(Statement::FunctionDeclaration {
            location: start,
            name: name_token.value.clone(),
            parameters,
            return_type: Some(return_type),
            body,
        })
    }

    fn parse_return(&mut self) -> Result<Statement, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect_keyword("return")?;
        let value = self.parse_expression()?;
        Ok(Statement::ReturnStatement {
            location: start,
            value: Box::new(value),
        })
    }

    fn parse_block_until(&mut self, stop_keywords: &[&str]) -> Result<Vec<Statement>, ParseError> {
        let mut statements: Vec<Statement> = Vec::new();
        while !stop_keywords.iter().any(|w| self.check_keyword(w))
            && self.peek()?.kind != TokenKind::Eof
        {
            statements.push(self.parse_statement()?);
        }
        Ok(statements)
    }

    fn parse_expression(&mut self) -> Result<Expression, ParseError> {
        self.parse_logical()
    }

    fn parse_logical(&mut self) -> Result<Expression, ParseError> {
        let mut left = self.parse_comparison()?;
        while self.check_keyword("and") || self.check_keyword("or") {
            let operator = self.advance()?.value.clone();
            let right = self.parse_comparison()?;
            let loc = left.location().clone();
            left = Expression::BinaryExpression {
                location: loc,
                operator,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_comparison(&mut self) -> Result<Expression, ParseError> {
        let mut left = self.parse_additive()?;
        while ["==", "!=", "<", "<=", ">", ">="].contains(&self.peek()?.value.as_str()) {
            let operator = self.advance()?.value.clone();
            let right = self.parse_additive()?;
            let loc = left.location().clone();
            left = Expression::BinaryExpression {
                location: loc,
                operator,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<Expression, ParseError> {
        let mut left = self.parse_multiplicative()?;
        while self.peek()?.value == "+" || self.peek()?.value == "-" {
            let operator = self.advance()?.value.clone();
            let right = self.parse_multiplicative()?;
            let loc = left.location().clone();
            left = Expression::BinaryExpression {
                location: loc,
                operator,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> Result<Expression, ParseError> {
        let mut left = self.parse_primary()?;
        while self.peek()?.value == "*" || self.peek()?.value == "/" || self.peek()?.value == "%" {
            let operator = self.advance()?.value.clone();
            let right = self.parse_primary()?;
            let loc = left.location().clone();
            left = Expression::BinaryExpression {
                location: loc,
                operator,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_primary(&mut self) -> Result<Expression, ParseError> {
        let mut expr = self.parse_primary_base()?;
        while self.peek()?.value == "[" || self.peek()?.value == "." {
            if self.peek()?.value == "[" {
                self.advance()?;
                let index = self.parse_expression()?;
                self.expect("]")?;
                let loc = expr.location().clone();
                expr = Expression::IndexExpression {
                    location: loc,
                    array: Box::new(expr),
                    index: Box::new(index),
                };
            } else {
                self.advance()?;
                let property_token = self.peek()?.clone();
                if property_token.kind != TokenKind::Identifier {
                    return Err(ParseError(format!(
                        "Expected a property name after '.', got: {} ({})",
                        property_token.value,
                        property_token.kind.as_str()
                    )));
                }
                self.advance()?;
                let loc = expr.location().clone();
                expr = Expression::MemberExpression {
                    location: loc,
                    object: Box::new(expr),
                    property: property_token.value.clone(),
                };
            }
        }
        Ok(expr)
    }

    fn parse_primary_base(&mut self) -> Result<Expression, ParseError> {
        let token = self.peek()?.clone();
        if self.check_keyword("not") {
            self.advance()?;
            let argument = self.parse_primary()?;
            return Ok(Expression::UnaryExpression {
                location: token.location.clone(),
                operator: "not".to_string(),
                argument: Box::new(argument),
            });
        }
        if self.peek()?.value == "(" {
            let start = self.peek()?.location.clone();
            self.advance()?;
            let first = self.parse_expression()?;
            if self.peek()?.value == "," {
                let mut elements = vec![first];
                while self.peek()?.value == "," {
                    self.advance()?;
                    elements.push(self.parse_expression()?);
                }
                self.expect(")")?;
                return Ok(Expression::TupleLiteral {
                    location: start,
                    elements,
                });
            }
            self.expect(")")?;
            return Ok(first);
        }
        if token.kind == TokenKind::Identifier {
            if let Some(next) = self.tokens.get(self.pos + 1) {
                if next.value == "(" {
                    return self.parse_call();
                }
            }
        }
        if token.kind == TokenKind::String {
            self.advance()?;
            return Ok(Expression::StringLiteral {
                location: token.location.clone(),
                value: token.value.clone(),
            });
        }
        if token.kind == TokenKind::Identifier {
            self.advance()?;
            return Ok(Expression::Identifier {
                location: token.location.clone(),
                name: token.value.clone(),
            });
        }
        if token.kind == TokenKind::Number {
            self.advance()?;
            let value: f64 = token
                .value
                .parse()
                .map_err(|_| ParseError(format!("Invalid number '{}'", token.value)))?;
            return Ok(Expression::NumberLiteral {
                location: token.location.clone(),
                value,
            });
        }
        if token.kind == TokenKind::Keyword && (token.value == "true" || token.value == "false") {
            self.advance()?;
            return Ok(Expression::BooleanLiteral {
                location: token.location.clone(),
                value: token.value == "true",
            });
        }
        if self.check_keyword("none") {
            self.advance()?;
            return Ok(Expression::NoneLiteral {
                location: token.location.clone(),
            });
        }
        if self.peek()?.value == "[" {
            return self.parse_array_literal();
        }
        if self.peek()?.value == "{" {
            return self.parse_object_literal();
        }
        Err(ParseError(format!(
            "Expected a string, number, boolean, identifier, or function call, got: {} ({})",
            token.value,
            token.kind.as_str()
        )))
    }

    fn parse_call(&mut self) -> Result<Expression, ParseError> {
        let name_token = self.advance()?.clone();
        self.expect("(")?;
        let mut args: Vec<Expression> = Vec::new();
        while self.peek()?.value != ")" {
            args.push(self.parse_expression()?);
            if self.peek()?.value == "," {
                self.advance()?;
            }
        }
        self.expect(")")?;
        Ok(Expression::CallExpression {
            location: name_token.location.clone(),
            callee: name_token.value.clone(),
            arguments: args,
        })
    }

    fn parse_array_literal(&mut self) -> Result<Expression, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect("[")?;
        let mut elements: Vec<Expression> = Vec::new();
        while self.peek()?.value != "]" {
            elements.push(self.parse_expression()?);
            if self.peek()?.value == "," {
                self.advance()?;
            }
        }
        self.expect("]")?;
        Ok(Expression::ArrayLiteral {
            location: start,
            elements,
        })
    }

    fn parse_object_literal(&mut self) -> Result<Expression, ParseError> {
        let start = self.peek()?.location.clone();
        self.expect("{")?;
        let mut properties: Vec<ObjectProperty> = Vec::new();
        while self.peek()?.value != "}" {
            let key_token = self.peek()?.clone();
            if key_token.kind != TokenKind::Identifier {
                return Err(ParseError(format!(
                    "Expected a property name, got: {} ({})",
                    key_token.value,
                    key_token.kind.as_str()
                )));
            }
            self.advance()?;
            self.expect(":")?;
            let value = self.parse_expression()?;
            properties.push(ObjectProperty {
                key: key_token.value.clone(),
                value,
            });
            if self.peek()?.value == "," {
                self.advance()?;
            }
        }
        self.expect("}")?;
        Ok(Expression::ObjectLiteral {
            location: start,
            properties,
        })
    }

    fn parse_type_annotation(&mut self) -> Result<TypeAnnotation, ParseError> {
        let mut members: Vec<TypeAnnotation> = vec![self.parse_type_annotation_atom()?];
        while self.peek()?.value == "|" {
            self.advance()?;
            members.push(self.parse_type_annotation_atom()?);
        }
        if members.len() == 1 {
            Ok(members.remove(0))
        } else {
            Ok(Self::union_type(members))
        }
    }

    fn parse_type_annotation_atom(&mut self) -> Result<TypeAnnotation, ParseError> {
        let token = self.peek()?.clone();
        if token.kind == TokenKind::String {
            self.advance()?;
            return Self::finish_type_annotation_atom(
                TypeAnnotation::Literal {
                    value: crate::type_::LiteralValue::String(token.value.clone()),
                },
                self,
            );
        }
        if token.kind == TokenKind::Number {
            self.advance()?;
            let n: f64 = token
                .value
                .parse()
                .map_err(|_| ParseError(format!("Invalid number '{}'", token.value)))?;
            return Self::finish_type_annotation_atom(
                TypeAnnotation::Literal {
                    value: crate::type_::LiteralValue::Number(n),
                },
                self,
            );
        }
        if token.kind == TokenKind::Keyword && (token.value == "true" || token.value == "false") {
            self.advance()?;
            return Self::finish_type_annotation_atom(
                TypeAnnotation::Literal {
                    value: crate::type_::LiteralValue::Boolean(token.value == "true"),
                },
                self,
            );
        }
        if token.value == "(" {
            self.advance()?;
            let mut params: Vec<TypeAnnotation> = Vec::new();
            while self.peek()?.value != ")" {
                params.push(self.parse_type_annotation()?);
                if self.peek()?.value == "," {
                    self.advance()?;
                }
            }
            self.expect(")")?;
            self.expect("->")?;
            let return_type = self.parse_type_annotation()?;
            return Self::finish_type_annotation_atom(
                TypeAnnotation::Function {
                    params,
                    return_type: Box::new(return_type),
                },
                self,
            );
        }
        if token.kind != TokenKind::Identifier {
            return Err(ParseError(format!(
                "Expected a type name, got: {} ({})",
                token.value,
                token.kind.as_str()
            )));
        }
        if token.kind != TokenKind::Identifier {
            return Err(ParseError(format!(
                "Expected a type name, got: {} ({})",
                token.value,
                token.kind.as_str()
            )));
        }
        self.advance()?;
        let base = if token.value == "array" {
            self.expect("<")?;
            let element_type = self.parse_type_annotation()?;
            self.expect(">")?;
            TypeAnnotation::Array {
                element_type: Box::new(element_type),
            }
        } else if token.value == "tuple" {
            self.expect("<")?;
            let mut elements: Vec<TypeAnnotation> = vec![self.parse_type_annotation()?];
            while self.peek()?.value == "," {
                self.advance()?;
                elements.push(self.parse_type_annotation()?);
            }
            self.expect(">")?;
            TypeAnnotation::Tuple { elements }
        } else {
            match token.value.as_str() {
                "string" => TypeAnnotation::String,
                "number" => TypeAnnotation::Number,
                "boolean" => TypeAnnotation::Boolean,
                "any" => TypeAnnotation::Any,
                "none" => TypeAnnotation::None,
                other => TypeAnnotation::Named {
                    name: other.to_string(),
                },
            }
        };
        Self::finish_type_annotation_atom(base, self)
    }

    fn finish_type_annotation_atom(
        base: TypeAnnotation,
        parser: &mut Parser,
    ) -> Result<TypeAnnotation, ParseError> {
        if parser.peek()?.value == "?" {
            parser.advance()?;
            return Ok(Self::union_type(vec![base, TypeAnnotation::None]));
        }
        Ok(base)
    }

    fn union_type(members: Vec<TypeAnnotation>) -> TypeAnnotation {
        if members.len() == 1 {
            members.into_iter().next().unwrap()
        } else {
            TypeAnnotation::Union { variants: members }
        }
    }

    fn peek(&self) -> Result<&Token, ParseError> {
        self.tokens
            .get(self.pos)
            .ok_or_else(|| ParseError("Unexpected end of file".to_string()))
    }

    fn advance(&mut self) -> Result<&Token, ParseError> {
        let tok = self
            .tokens
            .get(self.pos)
            .ok_or_else(|| ParseError("Unexpected end of file".to_string()))?;
        self.pos += 1;
        Ok(tok)
    }

    fn check_keyword(&self, word: &str) -> bool {
        self.tokens
            .get(self.pos)
            .map(|t| t.kind == TokenKind::Keyword && t.value == word)
            .unwrap_or(false)
    }

    fn expect_keyword(&mut self, word: &str) -> Result<(), ParseError> {
        if !self.check_keyword(word) {
            return Err(ParseError(format!("Expected '{word}'")));
        }
        self.advance()?;
        Ok(())
    }

    fn expect(&mut self, value: &str) -> Result<(), ParseError> {
        let token = self.peek()?;
        if token.value != value {
            return Err(ParseError(format!("Expected '{value}'")));
        }
        self.advance()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;

    fn parse(src: &str) -> Program {
        let tokens = tokenize(src, "<test>").unwrap();
        Parser::new(tokens).parse_program().unwrap()
    }

    #[test]
    fn parses_let() {
        let prog = parse(r#"let x = "hi""#);
        assert_eq!(prog.body.len(), 1);
    }
}
