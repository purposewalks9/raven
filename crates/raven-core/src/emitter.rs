//! AST → JS emitter, mirroring `compiler/src/emitter/emitter.ts`.
//!
//! Walks the AST and writes out equivalent JavaScript, optionally building a
//! v3 source map alongside it (see `sourcemap.rs`). Every `write`/`newline`
//! call tracks the generated line/column exactly like the TS `push()` does,
//! so mappings line up identically to the pre-port implementation.

use crate::ast::{Expression, ObjectProperty, Parameter, Program, SourceLocation, Statement};
use crate::sourcemap::{RawMapping, SourceMapGenerator};

/// Options for `Emitter::emit_with_source_map`, matching the TS
/// `EmitWithSourceMapOptions` interface.
#[derive(Debug, Clone, Default)]
pub struct EmitWithSourceMapOptions {
    pub source_file: String,
    /// Kept for parity with the TS interface; not read internally — the
    /// generated filename is only meaningful to whatever writes the `.map`
    /// file, same as in the original TS (`EmitWithSourceMapOptions.generatedFile`
    /// is likewise unused inside `Emitter`).
    pub generated_file: Option<String>,
    pub source_content: Option<String>,
}

/// Result of `Emitter::emit_with_source_map`.
pub struct EmitWithSourceMapResult {
    pub code: String,
    pub map: SourceMapGenerator,
}

/// Emits JavaScript source text from a Raven AST. Mirrors the `Emitter`
/// class in `emitter/emitter.ts` method-for-method.
#[derive(Debug, Default)]
pub struct Emitter {
    indent_level: usize,
    output: String,
    at_line_start: bool,
    source_map: Option<SourceMapGenerator>,
    source_map_file: String,
    gen_line: usize,
    gen_column: usize,
}

impl Emitter {
    #[must_use]
    pub fn new() -> Self {
        Self {
            at_line_start: true,
            source_map_file: "<unknown>".to_string(),
            ..Self::default()
        }
    }

    /// Emits `program` as plain JavaScript, with no source-map bookkeeping.
    #[must_use]
    pub fn emit(&mut self, program: &Program) -> String {
        self.output.clear();
        self.indent_level = 0;
        self.at_line_start = true;
        self.source_map = None;
        self.emit_program(program);
        std::mem::take(&mut self.output)
    }

    /// Emits `program` as JavaScript alongside a v3 source map.
    pub fn emit_with_source_map(
        &mut self,
        program: &Program,
        options: EmitWithSourceMapOptions,
    ) -> EmitWithSourceMapResult {
        self.output.clear();
        self.indent_level = 0;
        self.at_line_start = true;
        self.gen_line = 0;
        self.gen_column = 0;
        self.source_map_file = options.source_file.clone();
        let mut map = SourceMapGenerator::new();
        if let Some(content) = &options.source_content {
            map.set_source_content(&options.source_file, content);
        }
        self.source_map = Some(map);

        self.emit_program(program);

        let map = self.source_map.take().unwrap_or_default();
        EmitWithSourceMapResult {
            code: std::mem::take(&mut self.output),
            map,
        }
    }

    fn mark(&mut self, location: &SourceLocation) {
        if self.source_map.is_none() {
            return;
        }
        // Mirrors `(node.location?.line ?? 1) - 1`: a genuinely absent
        // location (line 0, our JSON-deserialization default for hand-built
        // ASTs) falls back to line/column 1 before the -1, same as the TS
        // optional-chaining fallback — never underflows.
        let line = if location.line == 0 { 1 } else { location.line };
        let column = if location.column == 0 {
            1
        } else {
            location.column
        };
        let source_line = line - 1;
        let source_column = column - 1;
        let file = self.source_map_file.clone();
        let gen_line = self.gen_line;
        let gen_column = self.gen_column;
        if let Some(map) = self.source_map.as_mut() {
            map.add_mapping(RawMapping {
                generated_line: gen_line,
                generated_column: gen_column,
                source: file,
                source_line,
                source_column,
                name: None,
            });
        }
    }

    fn emit_program(&mut self, node: &Program) {
        self.emit_statement_list(&node.body);
    }

    fn emit_statement_list(&mut self, statements: &[Statement]) {
        for stmt in statements {
            self.indent();
            self.mark(stmt.location());
            self.emit_statement(stmt);
        }
    }

    fn emit_statement(&mut self, node: &Statement) {
        match node {
            Statement::PrintStatement { argument, .. } => self.emit_print_statement(argument),
            Statement::VariableDeclaration { name, value, .. } => {
                self.emit_variable_declaration("let", name, value);
            }
            Statement::ConstantDeclaration { name, value, .. } => {
                self.emit_variable_declaration("const", name, value);
            }
            Statement::ModelDeclaration { name, value, .. } => {
                self.emit_variable_declaration("const", name, value);
            }
            Statement::ImportDeclaration { names, source, .. } => {
                self.emit_import_declaration(names, source);
            }
            Statement::Assignment { name, value, .. } => self.emit_assignment(name, value),
            Statement::IfStatement {
                condition,
                consequent,
                alternate,
                ..
            } => self.emit_if_statement(condition, consequent, alternate.as_deref()),
            Statement::WhileStatement {
                condition, body, ..
            } => self.emit_while_statement(condition, body),
            Statement::FunctionDeclaration {
                name,
                parameters,
                body,
                ..
            } => self.emit_function_declaration(name, parameters, body),
            Statement::ReturnStatement { value, .. } => self.emit_return_statement(value),
            Statement::ExpressionStatement { expression, .. } => {
                self.emit_expression(expression);
                self.write(";");
                self.newline();
            }
            Statement::BreakStatement { .. } => {
                self.write("break;");
                self.newline();
            }
            Statement::ContinueStatement { .. } => {
                self.write("continue;");
                self.newline();
            }
        }
    }

    fn emit_print_statement(&mut self, argument: &Expression) {
        self.write("console.log(");
        self.emit_expression(argument);
        self.write(");");
        self.newline();
    }

    fn emit_function_declaration(
        &mut self,
        name: &str,
        parameters: &[Parameter],
        body: &[Statement],
    ) {
        let params = parameters
            .iter()
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        self.write(&format!("function {name}({params}) {{"));
        self.newline();
        self.indent_level += 1;
        self.emit_statement_list(body);
        self.indent_level -= 1;
        self.indent();
        self.write("}");
        self.newline();
    }

    fn emit_return_statement(&mut self, value: &Expression) {
        self.write("return ");
        self.emit_expression(value);
        self.write(";");
        self.newline();
    }

    fn emit_variable_declaration(&mut self, keyword: &str, name: &str, value: &Expression) {
        self.write(&format!("{keyword} {name} = "));
        self.emit_expression(value);
        self.write(";");
        self.newline();
    }

    fn emit_import_declaration(&mut self, names: &[String], source: &str) {
        let joined = names.join(", ");
        let path = if source.starts_with('.') && !source.ends_with(".js") {
            format!("{source}.js")
        } else {
            source.to_string()
        };
        self.write(&format!("import {{ {joined} }} from \"{path}\";"));
        self.newline();
    }

    fn emit_while_statement(&mut self, condition: &Expression, body: &[Statement]) {
        self.write("while (");
        self.emit_expression(condition);
        self.write(") {");
        self.newline();
        self.indent_level += 1;
        self.emit_statement_list(body);
        self.indent_level -= 1;
        self.indent();
        self.write("}");
        self.newline();
    }

    fn emit_expression(&mut self, node: &Expression) {
        self.mark(node.location());
        match node {
            Expression::StringLiteral { value, .. } => self.emit_string_literal(value),
            Expression::Identifier { name, .. } => self.write(name),
            Expression::NumberLiteral { value, .. } => self.write(&format_number(*value)),
            Expression::BooleanLiteral { value, .. } => self.write(&value.to_string()),
            Expression::NoneLiteral { .. } => self.write("null"),
            Expression::BinaryExpression {
                operator,
                left,
                right,
                ..
            } => self.emit_binary_expression(operator, left, right),
            Expression::CallExpression {
                callee, arguments, ..
            } => self.emit_call_expression(callee, arguments),
            Expression::ObjectLiteral { properties, .. } => self.emit_object_literal(properties),
            Expression::UnaryExpression { argument, .. } => self.emit_unary_expression(argument),
            Expression::ArrayLiteral { elements, .. }
            | Expression::TupleLiteral { elements, .. } => {
                self.emit_array_literal(elements);
            }
            Expression::IndexExpression { array, index, .. } => {
                self.emit_index_expression(array, index);
            }
            Expression::MemberExpression {
                object, property, ..
            } => self.emit_member_expression(object, property),
        }
    }

    fn emit_string_literal(&mut self, value: &str) {
        let mut escaped = String::with_capacity(value.len() + 2);
        for ch in value.chars() {
            match ch {
                '\\' => escaped.push_str("\\\\"),
                '"' => escaped.push_str("\\\""),
                '\n' => escaped.push_str("\\n"),
                '\r' => escaped.push_str("\\r"),
                '\t' => escaped.push_str("\\t"),
                other => escaped.push(other),
            }
        }
        self.write("\"");
        self.write(&escaped);
        self.write("\"");
    }

    fn emit_object_literal(&mut self, properties: &[ObjectProperty]) {
        self.write("{ ");
        for (i, property) in properties.iter().enumerate() {
            if i > 0 {
                self.write(", ");
            }
            self.write(&format!("{}: ", property.key));
            self.emit_expression(&property.value);
        }
        self.write(" }");
    }

    fn emit_member_expression(&mut self, object: &Expression, property: &str) {
        self.emit_expression(object);
        self.write(&format!(".{property}"));
    }

    fn emit_if_statement(
        &mut self,
        condition: &Expression,
        consequent: &[Statement],
        alternate: Option<&[Statement]>,
    ) {
        self.write("if (");
        self.emit_expression(condition);
        self.write(") {");
        self.newline();
        self.indent_level += 1;
        self.emit_statement_list(consequent);
        self.indent_level -= 1;
        self.indent();
        self.write("}");
        if let Some(alternate) = alternate {
            self.write(" else {");
            self.newline();
            self.indent_level += 1;
            self.emit_statement_list(alternate);
            self.indent_level -= 1;
            self.indent();
            self.write("}");
        }
        self.newline();
    }

    fn emit_assignment(&mut self, name: &str, value: &Expression) {
        self.write(&format!("{name} = "));
        self.emit_expression(value);
        self.write(";");
        self.newline();
    }

    fn emit_call_expression(&mut self, callee: &str, arguments: &[Expression]) {
        if callee == "len" && arguments.len() == 1 {
            self.write("(");
            self.emit_expression(&arguments[0]);
            self.write(").length");
            return;
        }

        let js_name = match callee {
            "abs" => "Math.abs",
            "sqrt" => "Math.sqrt",
            "toString" => "String",
            other => other,
        };
        self.write(&format!("{js_name}("));
        for (i, arg) in arguments.iter().enumerate() {
            if i > 0 {
                self.write(", ");
            }
            self.emit_expression(arg);
        }
        self.write(")");
    }

    fn emit_unary_expression(&mut self, argument: &Expression) {
        self.write("(!");
        self.emit_expression(argument);
        self.write(")");
    }

    fn emit_binary_expression(&mut self, operator: &str, left: &Expression, right: &Expression) {
        let js_operator = match operator {
            "and" => "&&",
            "or" => "||",
            other => other,
        };
        self.write("(");
        self.emit_expression(left);
        self.write(&format!(" {js_operator} "));
        self.emit_expression(right);
        self.write(")");
    }

    fn emit_array_literal(&mut self, elements: &[Expression]) {
        self.write("[");
        for (i, el) in elements.iter().enumerate() {
            if i > 0 {
                self.write(", ");
            }
            self.emit_expression(el);
        }
        self.write("]");
    }

    fn emit_index_expression(&mut self, array: &Expression, index: &Expression) {
        self.emit_expression(array);
        self.write("[");
        self.emit_expression(index);
        self.write("]");
    }

    fn write(&mut self, text: &str) {
        self.push(text);
        self.at_line_start = text.ends_with('\n');
    }

    fn newline(&mut self) {
        self.push("\n");
        self.at_line_start = true;
    }

    fn indent(&mut self) {
        if self.at_line_start {
            let indent = "  ".repeat(self.indent_level);
            self.push(&indent);
            self.at_line_start = false;
        }
    }

    fn push(&mut self, text: &str) {
        self.output.push_str(text);
        for ch in text.chars() {
            if ch == '\n' {
                self.gen_line += 1;
                self.gen_column = 0;
            } else {
                self.gen_column += 1;
            }
        }
    }
}

/// Formats a Raven number literal as JS source, matching `String(node.value)`
/// in the TS emitter (which relies on JS's `Number#toString`). Integral
/// values print without a trailing `.0`; everything else uses the shortest
/// round-tripping decimal representation, same as JS.
fn format_number(value: f64) -> String {
    if value == value.trunc() && value.is_finite() && value.abs() < 1e21 {
        format!("{value:.0}")
    } else {
        let mut s = format!("{value}");
        if s.contains('e') {
            // Rust and JS both use exponential notation for very large/small
            // magnitudes, but with slightly different formatting; this is a
            // rare edge case for literals actually written in source, not
            // worth over-engineering here.
            s = format!("{value:e}");
        }
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::SourceLocation;

    fn loc() -> SourceLocation {
        SourceLocation::default()
    }

    fn program(body: Vec<Statement>) -> Program {
        Program {
            node_type: "Program".into(),
            body,
        }
    }

    #[test]
    fn emits_console_log_for_print_statement() {
        let ast = program(vec![Statement::PrintStatement {
            location: loc(),
            argument: Box::new(Expression::StringLiteral {
                location: loc(),
                value: "hi".into(),
            }),
        }]);
        let js = Emitter::new().emit(&ast);
        assert!(js.contains("console.log("));
        assert!(js.contains("\"hi\""));
    }

    #[test]
    fn emits_tuple_literal_as_plain_array() {
        let ast = program(vec![Statement::VariableDeclaration {
            location: loc(),
            name: "point".into(),
            type_annotation: None,
            value: Box::new(Expression::TupleLiteral {
                location: loc(),
                elements: vec![
                    Expression::NumberLiteral {
                        location: loc(),
                        value: 1.0,
                    },
                    Expression::StringLiteral {
                        location: loc(),
                        value: "a".into(),
                    },
                ],
            }),
        }]);
        let js = Emitter::new().emit(&ast);
        assert!(js.contains("[1,"));
        assert!(js.contains("\"a\""));
    }

    #[test]
    fn emits_none_as_null() {
        let ast = program(vec![Statement::VariableDeclaration {
            location: loc(),
            name: "middleName".into(),
            type_annotation: None,
            value: Box::new(Expression::NoneLiteral { location: loc() }),
        }]);
        let js = Emitter::new().emit(&ast);
        assert!(js.contains("null"));
    }

    #[test]
    fn emit_with_source_map_maps_statements_to_lines() {
        let ast = program(vec![
            Statement::VariableDeclaration {
                location: SourceLocation {
                    file: "test.rv".into(),
                    line: 1,
                    column: 1,
                    start: 0,
                    end: 9,
                },
                name: "x".into(),
                type_annotation: None,
                value: Box::new(Expression::NumberLiteral {
                    location: SourceLocation {
                        file: "test.rv".into(),
                        line: 1,
                        column: 9,
                        start: 8,
                        end: 9,
                    },
                    value: 1.0,
                }),
            },
            Statement::VariableDeclaration {
                location: SourceLocation {
                    file: "test.rv".into(),
                    line: 2,
                    column: 1,
                    start: 10,
                    end: 19,
                },
                name: "y".into(),
                type_annotation: None,
                value: Box::new(Expression::NumberLiteral {
                    location: SourceLocation {
                        file: "test.rv".into(),
                        line: 2,
                        column: 9,
                        start: 18,
                        end: 19,
                    },
                    value: 2.0,
                }),
            },
        ]);
        let result = Emitter::new().emit_with_source_map(
            &ast,
            EmitWithSourceMapOptions {
                source_file: "test.rv".into(),
                generated_file: None,
                source_content: None,
            },
        );
        assert!(result.code.starts_with("let x = 1;\nlet y = 2;\n"));
        let raw = result.map.to_raw(Some("test.js".into()));
        // Two generated lines, so at least one `;` separator in mappings.
        assert!(raw.mappings.contains(';'));
    }
}
