//! Raven's type system: the `RavenType` enum plus the type-interning table.
//!
//! Mirrors `compiler/src/typechecker/types.ts`. The serde shape of `RavenType`
//! is chosen to serialize *identically* to the TypeScript `TypeAnnotation`, so
//! a JSON AST produced by the (TypeScript) lexer/parser round-trips into this
//! crate and back without loss.
//!
//! Per AGENTS.md rule 2, **all structural type comparisons go through the
//! type-interning table** (`TypeInterner`) — never an ad-hoc recursive
//! deep-equality walk. To preserve the order-insensitive semantics of TS
//! structural typing (`number | string` == `string | number`, record keys in
//! any order), the interner canonicalizes types — sorting union variants and
//! record keys — before computing an id. Equal shapes intern to the same id.

use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};

use indexmap::IndexMap;

use serde::{Deserialize, Serialize};

/// A Raven type annotation, matching `compiler/src/ast/nodes.ts`'s
/// `TypeAnnotation` discriminated union.
///
/// Using serde's internally-tagged enum, unit variants serialize as plain
/// strings (`"string"`, `"number"`, ...) and struct variants serialize as
/// `{ "kind": "array", "elementType": ... }` — byte-for-byte the TS shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RavenType {
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
    Array {
        element_type: Box<RavenType>,
    },
    Record {
        fields: IndexMap<String, RavenType>,
    },
    Optional {
        inner: Box<RavenType>,
    },
    Union {
        variants: Vec<RavenType>,
    },
    Function {
        params: Vec<RavenType>,
        return_type: Box<RavenType>,
    },
    Literal {
        value: LiteralValue,
    },
    Tuple {
        elements: Vec<RavenType>,
    },
    Ref {
        name: String,
    },
    /// An opaque named type. The TypeScript parser passes through unknown
    /// identifiers in type position as bare strings (e.g. a `model foo: foo`
    /// self-reference serializes as the annotation `"foo"`); such types are
    /// treated as opaque names compared by equality.
    Named(String),
}

/// The value of a literal type. Mirrors the TS `string | number | boolean`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LiteralValue {
    String(String),
    Number(f64),
    Boolean(bool),
}

impl RavenType {
    #[must_use]
    pub fn is_any(&self) -> bool {
        matches!(self, Self::Any)
    }

    #[must_use]
    pub fn is_string(&self) -> bool {
        matches!(self, Self::String)
    }

    #[must_use]
    pub fn is_number(&self) -> bool {
        matches!(self, Self::Number)
    }

    #[must_use]
    pub fn is_boolean(&self) -> bool {
        matches!(self, Self::Boolean)
    }
}

/// A structural tag used to build order-insensitive canonical keys.
#[derive(Debug, PartialEq, Eq, Ord, PartialOrd, Hash)]
enum Key {
    None,
    Any,
    Bool,
    Num,
    Str,
    Array(Box<Key>),
    Record(BTreeMap<String, Key>),
    Optional(Box<Key>),
    Union(Vec<Key>),
    Function(Vec<Key>, Box<Key>),
    Literal(LiteralKey),
    Tuple(Vec<Key>),
    Ref(String),
    Named(String),
}

/// A comparable literal value for canonical ordering.
#[derive(Debug, PartialEq, Eq, Ord, PartialOrd, Hash)]
enum LiteralKey {
    Bool(bool),
    Num(IntOrFloat),
    Str(String),
}

#[derive(Debug, PartialEq, Eq, Ord, PartialOrd, Hash)]
enum IntOrFloat {
    Int(i64),
    Float(u64),
}

fn key_of(t: &RavenType) -> Key {
    match t {
        RavenType::String => Key::Str,
        RavenType::Number => Key::Num,
        RavenType::Boolean => Key::Bool,
        RavenType::Any => Key::Any,
        RavenType::None => Key::None,
        RavenType::Array { element_type } => Key::Array(Box::new(key_of(element_type))),
        RavenType::Record { fields } => {
            let mut m = BTreeMap::new();
            for (k, v) in fields {
                m.insert(k.clone(), key_of(v));
            }
            Key::Record(m)
        }
        RavenType::Optional { inner } => Key::Optional(Box::new(key_of(inner))),
        RavenType::Union { variants } => {
            let mut keys: Vec<Key> = variants.iter().map(key_of).collect();
            keys.sort();
            Key::Union(keys)
        }
        RavenType::Function {
            params,
            return_type,
        } => Key::Function(
            params.iter().map(key_of).collect(),
            Box::new(key_of(return_type)),
        ),
        RavenType::Literal { value } => Key::Literal(match value {
            LiteralValue::String(s) => LiteralKey::Str(s.clone()),
            LiteralValue::Number(f) => LiteralKey::Num(f64_key(*f)),
            LiteralValue::Boolean(b) => LiteralKey::Bool(*b),
        }),
        RavenType::Tuple { elements } => Key::Tuple(elements.iter().map(key_of).collect()),
        RavenType::Ref { name } => Key::Ref(name.clone()),
        RavenType::Named(name) => Key::Named(name.clone()),
    }
}

fn f64_key(f: f64) -> IntOrFloat {
    if f.fract() == 0.0 && f >= i64::MIN as f64 && f <= i64::MAX as f64 {
        IntOrFloat::Int(f as i64)
    } else {
        IntOrFloat::Float(f.to_bits())
    }
}

/// Build a canonical, order-insensitive key for the given type. Records are
/// keyed in a `BTreeMap` (sorted); union variants are sorted. Equal structural
/// shapes always yield equal keys.
#[must_use]
fn canonical_key(t: &RavenType) -> Key {
    key_of(t)
}

/// A type-interning table.
///
/// Every distinct normalized `RavenType` shape maps to a single unique `usize`
/// id. Two types are structurally equal iff they intern to the same id, so
/// repeated comparisons are O(1) id comparisons instead of recursive walks —
/// the single highest-leverage change described in SYSTEM_DESIGN.md §5
/// Phase 1.
#[derive(Debug, Default)]
pub struct TypeInterner {
    ids: RefCell<HashMap<Key, usize>>,
}

impl TypeInterner {
    /// Intern the type, returning its stable canonical id.
    pub fn intern(&self, t: &RavenType) -> usize {
        let key = canonical_key(t);
        let mut ids = self.ids.borrow_mut();
        if let Some(&existing) = ids.get(&key) {
            return existing;
        }
        let next = ids.len();
        ids.insert(key, next);
        next
    }
}

/// Structural equality through the interning table.
///
/// Mirrors `sameType` in `types.ts`: `any` absorbs, then ids are compared.
pub fn same_type(interner: &TypeInterner, left: &RavenType, right: &RavenType) -> bool {
    let l = normalize(left);
    let r = normalize(right);
    if l.is_any() || r.is_any() {
        return true;
    }
    interner.intern(&l) == interner.intern(&r)
}

/// Normalize a type: flatten nested unions, absorb `any`, dedupe variants.
/// Mirrors `normalizeType` in `types.ts`.
#[must_use]
pub fn normalize(t: &RavenType) -> RavenType {
    match t {
        RavenType::Union { variants } => {
            let mut flat: Vec<RavenType> = Vec::new();
            for v in variants {
                let n = normalize(v);
                if let RavenType::Union { variants: inner } = n {
                    flat.extend(inner);
                } else {
                    flat.push(n);
                }
            }
            if flat.iter().any(RavenType::is_any) {
                return RavenType::Any;
            }
            let mut unique: Vec<RavenType> = Vec::new();
            for v in flat {
                if !unique.iter().any(|u| structural_eq(u, &v)) {
                    unique.push(v);
                }
            }
            match unique.len() {
                0 => RavenType::Any,
                1 => unique.remove(0),
                _ => RavenType::Union { variants: unique },
            }
        }
        RavenType::Array { element_type } => RavenType::Array {
            element_type: Box::new(normalize(element_type)),
        },
        RavenType::Record { fields } => {
            let normalized: IndexMap<String, RavenType> = fields
                .iter()
                .map(|(k, v)| (k.clone(), normalize(v)))
                .collect();
            RavenType::Record { fields: normalized }
        }
        RavenType::Tuple { elements } => RavenType::Tuple {
            elements: elements.iter().map(normalize).collect(),
        },
        RavenType::Optional { inner } => RavenType::Optional {
            inner: Box::new(normalize(inner)),
        },
        RavenType::Function {
            params,
            return_type,
        } => RavenType::Function {
            params: params.iter().map(normalize).collect(),
            return_type: Box::new(normalize(return_type)),
        },
        other => other.clone(),
    }
}

/// Pure structural equality used while deduplicating union variants during
/// `normalize`. Record-vs-record compares order-insensitively by key set; all
/// other kinds compare by canonical key.
fn structural_eq(a: &RavenType, b: &RavenType) -> bool {
    canonical_key(a) == canonical_key(b)
}

/// Mirror of `optionalType` in `types.ts`.
#[must_use]
pub fn optional_type(inner: &RavenType) -> RavenType {
    match normalize(inner) {
        o @ RavenType::Optional { .. } => o,
        n => RavenType::Optional { inner: Box::new(n) },
    }
}

/// Mirror of `unionType` in `types.ts`.
#[must_use]
pub fn union_type(variants: &[RavenType]) -> RavenType {
    normalize(&RavenType::Union {
        variants: variants.to_vec(),
    })
}

/// Whether a type is optional, mirroring `isOptionalType` in `types.ts`.
#[must_use]
pub fn is_optional_type(t: &RavenType) -> bool {
    matches!(normalize(t), RavenType::Optional { .. })
}

/// Mirror of `isAssignableTo` in `types.ts`.
///
/// Order of checks follows the TS implementation exactly: any-absorption,
/// optional handling, union decomposition, literals, primitives, then
/// structural walk (`ref`/`array`/`record`/`tuple`/`function`).
#[must_use]
pub fn is_assignable_to(source: &RavenType, target: &RavenType) -> bool {
    let normalized_source = normalize(source);
    let normalized_target = normalize(target);

    if normalized_source.is_any() || normalized_target.is_any() {
        return true;
    }

    if let RavenType::Optional { inner } = &normalized_source {
        return if let RavenType::Optional {
            inner: target_inner,
        } = &normalized_target
        {
            is_assignable_to(inner, target_inner)
        } else {
            false
        };
    }
    if let RavenType::Optional { inner } = &normalized_target {
        return is_assignable_to(&normalized_source, inner);
    }
    if let RavenType::Union { variants } = &normalized_source {
        return variants
            .iter()
            .all(|variant| is_assignable_to(variant, &normalized_target));
    }
    if let RavenType::Union { variants } = &normalized_target {
        return variants
            .iter()
            .any(|variant| is_assignable_to(&normalized_source, variant));
    }
    if let RavenType::Literal { value } = &normalized_source {
        if let RavenType::Literal {
            value: target_value,
        } = &normalized_target
        {
            return value == target_value;
        }
        // A literal is assignable to its primitive: `"abc"` -> "string".
        if let RavenType::String = &normalized_target {
            return matches!(value, LiteralValue::String(_));
        }
        if let RavenType::Number = &normalized_target {
            return matches!(value, LiteralValue::Number(_));
        }
        if let RavenType::Boolean = &normalized_target {
            return matches!(value, LiteralValue::Boolean(_));
        }
        return false;
    }
    if let RavenType::Literal { .. } = &normalized_target {
        return false;
    }

    if is_primitive(&normalized_source) && is_primitive(&normalized_target) {
        return normalize(&normalized_source) == normalize(&normalized_target);
    }
    if is_primitive(&normalized_source) || is_primitive(&normalized_target) {
        return false;
    }

    if normalized_source.kind_name() != normalized_target.kind_name() {
        return false;
    }

    match (&normalized_source, &normalized_target) {
        (RavenType::Ref { name: a }, RavenType::Ref { name: b }) => a == b,
        (RavenType::Array { element_type: ea }, RavenType::Array { element_type: eb }) => {
            is_assignable_to(ea, eb)
        }
        (RavenType::Record { fields: sf }, RavenType::Record { fields: tf }) => {
            tf.iter().all(|(key, target_field)| match sf.get(key) {
                None => is_optional_type(target_field),
                Some(source_field) => is_assignable_to(source_field, target_field),
            })
        }
        (RavenType::Tuple { elements: se }, RavenType::Tuple { elements: te }) => {
            se.len() == te.len()
                && se
                    .iter()
                    .zip(te.iter())
                    .all(|(a, b)| is_assignable_to(a, b))
        }
        (
            RavenType::Function {
                params: sp,
                return_type: sr,
            },
            RavenType::Function {
                params: tp,
                return_type: tr,
            },
        ) => {
            if sp.len() != tp.len() {
                return false;
            }
            let params_assignable = sp
                .iter()
                .zip(tp.iter())
                .all(|(source_param, target_param)| is_assignable_to(target_param, source_param));
            if !params_assignable {
                return false;
            }
            is_assignable_to(sr, tr)
        }
        _ => false,
    }
}

fn is_primitive(t: &RavenType) -> bool {
    matches!(
        normalize(t),
        RavenType::String
            | RavenType::Number
            | RavenType::Boolean
            | RavenType::None
            | RavenType::Named(_)
    )
}

impl RavenType {
    #[must_use]
    fn kind_name(&self) -> &'static str {
        match normalize(self) {
            RavenType::Array { .. } => "array",
            RavenType::Record { .. } => "record",
            RavenType::Tuple { .. } => "tuple",
            RavenType::Function { .. } => "function",
            RavenType::Ref { .. } => "ref",
            RavenType::Optional { .. } => "optional",
            RavenType::Union { .. } => "union",
            RavenType::Literal { .. } => "literal",
            RavenType::String
            | RavenType::Number
            | RavenType::Boolean
            | RavenType::Any
            | RavenType::None
            | RavenType::Named(_) => "<primitive>",
        }
    }
}

/// Mirror of `formatType` in `types.ts`. Produces byte-identical strings so
/// diagnostic messages match the TS typechecker.
#[must_use]
pub fn format_type(type_: &RavenType) -> String {
    let normalized = normalize(type_);
    match &normalized {
        RavenType::Any => "any".to_string(),
        RavenType::String => "string".to_string(),
        RavenType::Number => "number".to_string(),
        RavenType::Boolean => "boolean".to_string(),
        RavenType::None => "none".to_string(),
        RavenType::Array { element_type } => {
            let element_normalized = normalize(element_type);
            let needs_parens = matches!(
                element_normalized,
                RavenType::Union { .. } | RavenType::Optional { .. }
            );
            let element_text = format_type(element_type);
            if needs_parens {
                format!("({element_text})[]")
            } else {
                format!("{element_text}[]")
            }
        }
        RavenType::Record { fields } => {
            let fields_text = fields
                .iter()
                .map(|(key, field)| format!("{key}: {}", format_type(field)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{ {fields_text} }}")
        }
        RavenType::Tuple { elements } => {
            let text = elements
                .iter()
                .map(format_type)
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{text}]")
        }
        RavenType::Optional { inner } => format!("{}?", format_type(inner)),
        RavenType::Union { variants } => variants
            .iter()
            .map(format_type)
            .collect::<Vec<_>>()
            .join(" | "),
        RavenType::Literal { value } => match value {
            LiteralValue::String(s) => serde_json::to_string(s).unwrap_or_default(),
            LiteralValue::Number(n) => format_number(*n),
            LiteralValue::Boolean(b) => b.to_string(),
        },
        RavenType::Function {
            params,
            return_type,
        } => {
            let params_text = params
                .iter()
                .map(format_type)
                .collect::<Vec<_>>()
                .join(", ");
            format!("({params_text}) -> {}", format_type(return_type))
        }
        RavenType::Ref { name } => format!("ref<{name}>"),
        RavenType::Named(name) => name.clone(),
    }
}

fn format_number(n: f64) -> String {
    // `String(n)` in JS omits the decimal when the value is integral and
    // finite; serde_json would otherwise print `5.0` for a literal `5`.
    if n.is_finite() && n.fract() == 0.0 && n.abs() <= 1e21 {
        format!("{}", n as i64)
    } else {
        n.to_string()
    }
}

fn levenshtein(a: &str, b: &str) -> usize {
    let rows = a.chars().count() + 1;
    let cols = b.chars().count() + 1;
    let mut grid = vec![vec![0usize; cols]; rows];
    for (i, row) in grid.iter_mut().enumerate() {
        row[0] = i;
    }
    for (j, cell) in grid[0].iter_mut().enumerate() {
        *cell = j;
    }
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    for i in 1..rows {
        for j in 1..cols {
            let cost = if a_chars[i - 1] == b_chars[j - 1] {
                0
            } else {
                1
            };
            grid[i][j] = (grid[i - 1][j] + 1)
                .min(grid[i][j - 1] + 1)
                .min(grid[i - 1][j - 1] + cost);
        }
    }
    grid[rows - 1][cols - 1]
}

/// Mirror of `closestMatch` in `types.ts`.
#[must_use]
pub fn closest_match(target: &str, candidates: &[String]) -> Option<String> {
    let mut best: Option<String> = None;
    let mut best_distance = usize::MAX;

    for candidate in candidates {
        if candidate.as_str() == target {
            continue;
        }
        let distance = levenshtein(target, candidate);
        if distance < best_distance {
            best_distance = distance;
            best = Some(candidate.clone());
        }
    }

    let threshold = usize::max(2, target.chars().count() / 3);
    if best_distance <= threshold {
        best
    } else {
        None
    }
}

/// A structural difference between two record shapes, mirroring
/// `ShapeDiffEntry` in `types.ts`.
#[derive(Debug, Clone)]
pub enum ShapeDiffEntry {
    Added {
        field: String,
        type_: RavenType,
    },
    Removed {
        field: String,
        type_: RavenType,
    },
    Changed {
        field: String,
        from: RavenType,
        to: RavenType,
    },
}

/// Mirror of `diffShapes` in `types.ts`. Only `record` vs `record` inputs
/// produce entries; included/excluded keys mirror the TS ordering.
#[must_use]
pub fn diff_shapes(previous: &RavenType, next: &RavenType) -> Vec<ShapeDiffEntry> {
    let previous = normalize(previous);
    let next = normalize(next);
    let (
        RavenType::Record {
            fields: previous_fields,
        },
        RavenType::Record {
            fields: next_fields,
        },
    ) = (&previous, &next)
    else {
        return Vec::new();
    };

    let mut entries: Vec<ShapeDiffEntry> = Vec::new();
    let previous_keys: Vec<&String> = previous_fields.keys().collect();
    let next_keys: Vec<&String> = next_fields.keys().collect();

    for key in &next_keys {
        if !previous_fields.contains_key(*key) {
            entries.push(ShapeDiffEntry::Added {
                field: (*key).clone(),
                type_: next_fields[*key].clone(),
            });
        }
    }
    for key in &previous_keys {
        if !next_fields.contains_key(*key) {
            entries.push(ShapeDiffEntry::Removed {
                field: (*key).clone(),
                type_: previous_fields[*key].clone(),
            });
        }
    }
    for key in &previous_keys {
        if next_fields.contains_key(*key)
            && !same_type(&self_interner(), &previous_fields[*key], &next_fields[*key])
        {
            entries.push(ShapeDiffEntry::Changed {
                field: (*key).clone(),
                from: previous_fields[*key].clone(),
                to: next_fields[*key].clone(),
            });
        }
    }

    entries
}

/// Mirror of `formatShapeDiff` in `types.ts`.
#[must_use]
pub fn format_shape_diff(entries: &[ShapeDiffEntry]) -> String {
    entries
        .iter()
        .map(|entry| match entry {
            ShapeDiffEntry::Added { field, type_ } => {
                format!("  + {field}: {}", format_type(type_))
            }
            ShapeDiffEntry::Removed { field, type_ } => {
                format!("  - {field}: {}", format_type(type_))
            }
            ShapeDiffEntry::Changed { from, to, field } => {
                format!("  ~ {field}: {} -> {}", format_type(from), format_type(to))
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// A temporary standalone interner for one-off `same_type` invocations
/// (e.g. `diff_shapes`), so structural comparisons route through the
/// interning table per AGENTS.md without threading external state in.
fn self_interner() -> TypeInterner {
    TypeInterner::default()
}
