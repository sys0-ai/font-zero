//! font-zero-engine: Font Zero's canvas renderer as deterministic scalar Rust.
//! Same RGBA bytes on every target (native, wasm32). See engine.rs for the API.

pub mod blend;
pub mod curves;
pub mod design;
pub mod engine;
pub mod forms;
pub mod geom;
pub mod glyphs;
pub mod layout;
pub mod raster;
#[cfg(feature = "wasm")]
pub mod wasm;

pub use engine::{Colors, Engine, Image, Settings};
