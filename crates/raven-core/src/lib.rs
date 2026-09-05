//! `raven-core` — the pure Rust compiler core for Raven.
//!
//! This crate has **no** Node (`napi`) or WASM (`wasm-bindgen`) dependencies.
//! It is a plain library so it can be unit-tested and fuzzed independently of
//! any host. `raven-node` and `raven-wasm` provide the host bindings.

pub mod ast;
pub mod binder;
pub mod checker;
pub mod diagnostics;
pub mod registry;
pub mod symbol_table;
pub mod type_;
