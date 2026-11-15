//! wasm-bindgen surface: the Engine API for the sys0 desktop view and the
//! portable web components. Colors are packed 0xRRGGBBAA.

use crate::engine::{Colors, Engine};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = FontZeroEngine)]
pub struct WasmEngine {
    engine: Engine,
    width: u32,
    height: u32,
}

fn rgba(v: u32) -> [u8; 4] {
    [(v >> 24) as u8, (v >> 16) as u8, (v >> 8) as u8, v as u8]
}

#[wasm_bindgen(js_class = FontZeroEngine)]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmEngine, JsError> {
        Ok(WasmEngine { engine: Engine::new().map_err(|e| JsError::new(&e))?, width: 0, height: 0 })
    }
    /// props as JSON text: {"settings":…, "design":bool, "selected":"…"}
    pub fn update(&mut self, props: &str) -> Result<(), JsError> {
        let value: serde_json::Value = serde_json::from_str(props).map_err(|e| JsError::new(&format!("Font Zero props are invalid: {}", e)))?;
        self.engine.update(&value).map_err(|e| JsError::new(&e))
    }
    pub fn ready(&self) -> bool {
        self.engine.ready()
    }
    pub fn set_viewport(&mut self, width: f64, height: f64, scale: f64) {
        self.engine.set_viewport(width, height, scale)
    }
    pub fn set_scroll(&mut self, x: f64, y: f64) {
        self.engine.set_scroll(x, y)
    }
    /// [width, height]
    pub fn content_size(&self) -> Vec<f64> {
        let (w, h) = self.engine.content_size();
        vec![w, h]
    }
    pub fn set_pointer(&mut self, x: Option<f64>, y: Option<f64>) {
        self.engine.set_pointer(match (x, y) {
            (Some(x), Some(y)) => Some((x, y)),
            _ => None,
        })
    }
    pub fn tick(&mut self, dt_seconds: f64) -> bool {
        self.engine.tick(dt_seconds)
    }
    /// Straight RGBA8 of the viewport at device pixels; see width()/height().
    pub fn render(&mut self, ink: u32, highlight: u32) -> Result<Vec<u8>, JsError> {
        let image = self.engine.render(Colors { ink: rgba(ink), highlight: rgba(highlight) }).map_err(|e| JsError::new(&e))?;
        self.width = image.width;
        self.height = image.height;
        Ok(image.rgba)
    }
    pub fn width(&self) -> u32 {
        self.width
    }
    pub fn height(&self) -> u32 {
        self.height
    }
    pub fn fit(&mut self) -> Result<f64, JsError> {
        self.engine.fit().map_err(|e| JsError::new(&e))
    }
    pub fn hit(&self, x: f64, y: f64) -> Option<String> {
        self.engine.hit(x, y)
    }
}
