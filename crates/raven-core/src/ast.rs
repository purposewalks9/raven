//! AST node types, mirroring `compiler/src/ast/nodes.ts`.
//!
//! The serde shape is chosen to serialize *identically* to the TypeScript AST
//! so a JSON AST produced by the TypeScript lexer/parser can be deserialized
//! here and back without loss. Discriminated unions use `#[serde(tag = "type")]`
//! to match the TS `type` field. Every node carries a `location` (matching the
//! TS `Node` interface) because the typechecker needs locations for
//! diagnostics.

use indexmap::IndexMap;
use serde::de::Error as _;
use serde::{Deserialize, Serialize};

pub use crate::type_::LiteralValue;

/// A source location, matching `ast/nodes.ts`'s `SourceLocation`.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct SourceLocation {
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub start: usize,
    pub end: usize,
}

/// A type annotation, matching `ast/nodes.ts`'s `TypeAnnotation`.
///
/// The TS `TypeAnnotation` is a string-or-object union: primitives serialize
/// as plain strings (`"string"`), structural kinds as
/// `{ "kind": "array", "elementType": ... }`. Internally, `RavenType` mirrors
/// the same representation.
///
/// Deserialization is implemented by hand (via `serde_json::Value`) to accept
/// both the plain-string primitive form and the tagged structural objects.
/// Serialization keeps the discriminated-union shape used for diagnostics and
/// tests.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum TypeAnnotation {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "any")]
    Any,
    #[serde(rename = "none")]
    None,
    #[serde(rename_all = "camelCase")]
    Array { element_type: Box<TypeAnnotation> },
    #[serde(rename_all = "camelCase")]
    Record {
        fields: IndexMap<String, TypeAnnotation>,
    },
    #[serde(rename_all = "camelCase")]
    Optional { inner: Box<TypeAnnotation> },
    #[serde(rename_all = "camelCase")]
    Union { variants: Vec<TypeAnnotation> },
    #[serde(rename_all = "camelCase")]
    Function {
        params: Vec<TypeAnnotation>,
        return_type: Box<TypeAnnotation>,
    },
    #[serde(rename_all = "camelCase")]
    Literal { value: LiteralValue },
    #[serde(rename_all = "camelCase")]
    Tuple { elements: Vec<TypeAnnotation> },
    #[serde(rename_all = "camelCase")]
    Ref { name: String },
    #[serde(rename_all = "camelCase")]
    Named { name: String },
}

impl<'de> Deserialize<'de> for TypeAnnotation {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        parse_type_annotation(&value).map_err(D::Error::custom)
    }
}

fn parse_type_annotation(value: &serde_json::Value) -> Result<TypeAnnotation, serde_json::Error> {
    match value {
        serde_json::Value::String(s) => match s.as_str() {
            "string" => Ok(TypeAnnotation::String),
            "number" => Ok(TypeAnnotation::Number),
            "boolean" => Ok(TypeAnnotation::Boolean),
            "any" => Ok(TypeAnnotation::Any),
            "none" => Ok(TypeAnnotation::None),
            other => Ok(TypeAnnotation::Named {
                name: other.to_string(),
            }),
        },
        serde_json::Value::Object(map) => {
            let kind = map
                .get("kind")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| {
                    serde_json::Error::custom("type annotation object missing 'kind'")
                })?;
            match kind {
                "array" => Ok(TypeAnnotation::Array {
                    element_type: Box::new(parse_field(map, "elementType")?),
                }),
                "record" => {
                    let fields_obj = map
                        .get("fields")
                        .and_then(serde_json::Value::as_object)
                        .ok_or_else(|| {
                            serde_json::Error::custom("type annotation 'fields' missing")
                        })?;
                    let mut fields = IndexMap::new();
                    for (key, field_value) in fields_obj {
                        fields.insert(key.clone(), parse_type_annotation(field_value)?);
                    }
                    Ok(TypeAnnotation::Record { fields })
                }
                "optional" => Ok(TypeAnnotation::Optional {
                    inner: Box::new(parse_field(map, "inner")?),
                }),
                "union" => {
                    let variants_arr = map
                        .get("variants")
                        .and_then(serde_json::Value::as_array)
                        .ok_or_else(|| {
                            serde_json::Error::custom("type annotation 'variants' missing")
                        })?;
                    let variants = variants_arr
                        .iter()
                        .map(parse_type_annotation)
                        .collect::<Result<Vec<_>, _>>()?;
                    Ok(TypeAnnotation::Union { variants })
                }
                "function" => Ok(TypeAnnotation::Function {
                    params: parse_list_field(map, "params")?,
                    return_type: Box::new(parse_field(map, "returnType")?),
                }),
                "literal" => {
                    let val = map.get("value").ok_or_else(|| {
                        serde_json::Error::custom("type annotation 'value' missing")
                    })?;
                    let literal =
                        serde_json::from_value(val.clone()).map_err(serde_json::Error::custom)?;
                    Ok(TypeAnnotation::Literal { value: literal })
                }
                "tuple" => Ok(TypeAnnotation::Tuple {
                    elements: parse_list_field(map, "elements")?,
                }),
                "ref" => Ok(TypeAnnotation::Ref {
                    name: map
                        .get("name")
                        .and_then(serde_json::Value::as_str)
                        .ok_or_else(|| serde_json::Error::custom("type annotation 'name' missing"))?
                        .to_string(),
                }),
                other => Err(serde_json::Error::custom(format!(
                    "unknown type annotation kind '{other}'"
                ))),
            }
        }
        other => Err(serde_json::Error::custom(format!(
            "expected type annotation string or object, got {other}"
        ))),
    }
}

fn parse_field(
    map: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Result<TypeAnnotation, serde_json::Error> {
    let field = map.get(key).ok_or_else(|| {
        serde_json::Error::custom(format!("type annotation field '{key}' missing"))
    })?;
    parse_type_annotation(field)
}

fn parse_list_field(
    map: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Result<Vec<TypeAnnotation>, serde_json::Error> {
    let arr = map
        .get(key)
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| serde_json::Error::custom(format!("type annotation '{key}' missing")))?;
    arr.iter()
        .map(parse_type_annotation)
        .collect::<Result<Vec<_>, _>>()
}

impl From<crate::type_::RavenType> for TypeAnnotation {
    fn from(t: crate::type_::RavenType) -> Self {
        match t {
            crate::type_::RavenType::String => TypeAnnotation::String,
            crate::type_::RavenType::Number => TypeAnnotation::Number,
            crate::type_::RavenType::Boolean => TypeAnnotation::Boolean,
            crate::type_::RavenType::Any => TypeAnnotation::Any,
            crate::type_::RavenType::None => TypeAnnotation::None,
            crate::type_::RavenType::Array { element_type } => TypeAnnotation::Array {
                element_type: Box::new((*element_type).into()),
            },
            crate::type_::RavenType::Record { fields } => TypeAnnotation::Record {
                fields: fields.into_iter().map(|(k, v)| (k, v.into())).collect(),
            },
            crate::type_::RavenType::Optional { inner } => TypeAnnotation::Optional {
                inner: Box::new((*inner).into()),
            },
            crate::type_::RavenType::Union { variants } => TypeAnnotation::Union {
                variants: variants.into_iter().map(Into::into).collect(),
            },
            crate::type_::RavenType::Function {
                params,
                return_type,
            } => TypeAnnotation::Function {
                params: params.into_iter().map(Into::into).collect(),
                return_type: Box::new((*return_type).into()),
            },
            crate::type_::RavenType::Literal { value } => TypeAnnotation::Literal { value },
            crate::type_::RavenType::Tuple { elements } => TypeAnnotation::Tuple {
                elements: elements.into_iter().map(Into::into).collect(),
            },
            crate::type_::RavenType::Ref { name } => TypeAnnotation::Ref { name },
            crate::type_::RavenType::Named(name) => TypeAnnotation::Named { name },
        }
    }
}

impl From<TypeAnnotation> for crate::type_::RavenType {
    fn from(t: TypeAnnotation) -> Self {
        match t {
            TypeAnnotation::String => crate::type_::RavenType::String,
            TypeAnnotation::Number => crate::type_::RavenType::Number,
            TypeAnnotation::Boolean => crate::type_::RavenType::Boolean,
            TypeAnnotation::Any => crate::type_::RavenType::Any,
            TypeAnnotation::None => crate::type_::RavenType::None,
            TypeAnnotation::Array { element_type } => crate::type_::RavenType::Array {
                element_type: Box::new((*element_type).into()),
            },
            TypeAnnotation::Record { fields } => crate::type_::RavenType::Record {
                fields: fields.into_iter().map(|(k, v)| (k, v.into())).collect(),
            },
            TypeAnnotation::Optional { inner } => crate::type_::RavenType::Optional {
                inner: Box::new((*inner).into()),
            },
            TypeAnnotation::Union { variants } => crate::type_::RavenType::Union {
                variants: variants.into_iter().map(Into::into).collect(),
            },
            TypeAnnotation::Function {
                params,
                return_type,
            } => crate::type_::RavenType::Function {
                params: params.into_iter().map(Into::into).collect(),
                return_type: Box::new((*return_type).into()),
            },
            TypeAnnotation::Literal { value } => crate::type_::RavenType::Literal { value },
            TypeAnnotation::Tuple { elements } => crate::type_::RavenType::Tuple {
                elements: elements.into_iter().map(Into::into).collect(),
            },
            TypeAnnotation::Ref { name } => crate::type_::RavenType::Ref { name },
            TypeAnnotation::Named { name } => crate::type_::RavenType::Named(name),
        }
    }
}

macro_rules! statement {
    ($($variant:ident $( { $($field:ident : $t:ty),* $(,)? } )? ),* $(,)?) => {
        /// A top-level statement, matching `ast/nodes.ts`'s `Statement`.
        #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
        #[serde(tag = "type", rename_all_fields = "camelCase")]
        pub enum Statement {
            $(
                $variant {
                    #[serde(default = "default_source_location")]
                    location: SourceLocation,
                    $($($field: $t,)*)*
                }
            ),*
        }
    };
}

statement! {
    PrintStatement { argument: Box<Expression> },
    VariableDeclaration { name: String, value: Box<Expression>, type_annotation: Option<TypeAnnotation> },
    ConstantDeclaration { name: String, value: Box<Expression>, type_annotation: Option<TypeAnnotation> },
    Assignment { name: String, value: Box<Expression> },
    IfStatement { condition: Box<Expression>, consequent: Vec<Statement>, alternate: Option<Vec<Statement>> },
    WhileStatement { condition: Box<Expression>, body: Vec<Statement> },
    FunctionDeclaration { name: String, parameters: Vec<Parameter>, return_type: Option<TypeAnnotation>, body: Vec<Statement> },
    ReturnStatement { value: Box<Expression> },
    ExpressionStatement { expression: Box<Expression> },
    BreakStatement,
    ContinueStatement,
    ModelDeclaration { name: String, value: Box<Expression>, type_annotation: Option<TypeAnnotation>, external: bool },
    ImportDeclaration { names: Vec<String>, source: String },
}

impl Statement {
    #[must_use]
    pub fn location(&self) -> &SourceLocation {
        match self {
            Self::PrintStatement { location, .. }
            | Self::VariableDeclaration { location, .. }
            | Self::ConstantDeclaration { location, .. }
            | Self::Assignment { location, .. }
            | Self::IfStatement { location, .. }
            | Self::WhileStatement { location, .. }
            | Self::FunctionDeclaration { location, .. }
            | Self::ReturnStatement { location, .. }
            | Self::ExpressionStatement { location, .. }
            | Self::BreakStatement { location }
            | Self::ContinueStatement { location }
            | Self::ModelDeclaration { location, .. }
            | Self::ImportDeclaration { location, .. } => location,
        }
    }

    #[must_use]
    pub fn name(&self) -> Option<&str> {
        match self {
            Self::VariableDeclaration { name, .. }
            | Self::ConstantDeclaration { name, .. }
            | Self::Assignment { name, .. }
            | Self::FunctionDeclaration { name, .. }
            | Self::ModelDeclaration { name, .. } => Some(name),
            _ => None,
        }
    }
}

/// A fallback `SourceLocation` for AST nodes parsed from JSON that omit one
/// (the parser always emits locations; hand-built ASTs in JS tests may not).
#[must_use]
pub fn default_source_location() -> SourceLocation {
    SourceLocation {
        file: String::new(),
        line: 0,
        column: 0,
        start: 0,
        end: 0,
    }
}

/// A parameter in a function declaration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Parameter {
    pub name: String,
    #[serde(rename = "typeAnnotation")]
    pub type_annotation: Option<TypeAnnotation>,
    pub location: Option<SourceLocation>,
}

/// A property in an object literal.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectProperty {
    pub key: String,
    pub value: Expression,
}

macro_rules! expression {
    ($($variant:ident $( { $($field:ident : $t:ty),* $(,)? } )? ),* $(,)?) => {
        /// An expression, matching `ast/nodes.ts`'s `Expression`.
        #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
        #[serde(tag = "type", rename_all_fields = "camelCase")]
        pub enum Expression {
            $(
                $variant {
                    #[serde(default = "default_source_location")]
                    location: SourceLocation,
                    $($($field: $t,)*)*
                }
            ),*
        }
    };
}

expression! {
    StringLiteral { value: String },
    NumberLiteral { value: f64 },
    BooleanLiteral { value: bool },
    NoneLiteral,
    CallExpression { callee: String, arguments: Vec<Expression> },
    Identifier { name: String },
    ArrayLiteral { elements: Vec<Expression> },
    TupleLiteral { elements: Vec<Expression> },
    IndexExpression { array: Box<Expression>, index: Box<Expression> },
    ObjectLiteral { properties: Vec<ObjectProperty> },
    MemberExpression { object: Box<Expression>, property: String },
    BinaryExpression { operator: String, left: Box<Expression>, right: Box<Expression> },
    UnaryExpression { operator: String, argument: Box<Expression> },
}

impl Expression {
    #[must_use]
    pub fn location(&self) -> &SourceLocation {
        match self {
            Self::StringLiteral { location, .. }
            | Self::NumberLiteral { location, .. }
            | Self::BooleanLiteral { location, .. }
            | Self::NoneLiteral { location }
            | Self::CallExpression { location, .. }
            | Self::Identifier { location, .. }
            | Self::ArrayLiteral { location, .. }
            | Self::TupleLiteral { location, .. }
            | Self::IndexExpression { location, .. }
            | Self::ObjectLiteral { location, .. }
            | Self::MemberExpression { location, .. }
            | Self::BinaryExpression { location, .. }
            | Self::UnaryExpression { location, .. } => location,
        }
    }
}

/// The top-level program, matching `ast/nodes.ts`'s `Program`.
///
/// Note: the TS `Program` carries only `type` and `body` (no `location`), so we
/// mirror exactly that — the outer node is not a normal `Node` bearing a
/// location.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    #[serde(rename = "type")]
    pub node_type: String,
    pub body: Vec<Statement>,
}
