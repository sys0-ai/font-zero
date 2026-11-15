//! Fixed frames rendered from the sys0 app's default settings. Their SHA-256
//! hashes are golden (tests/golden.json) and must match on native and wasm32
//! (wasm/harness.mjs renders the same frames through the wasm build).

use font_zero_engine::{Colors, Engine};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const INK: [u8; 4] = [0x1b, 0x1b, 0x1f, 0xff];
pub const HIGHLIGHT: [u8; 4] = [0x2f, 0x6f, 0xeb, 0xff];

fn defaults() -> Value {
    serde_json::from_str(include_str!("fixtures/settings.json")).unwrap()
}

/// (name, props, width, height, scale, fit-first)
/// The view model's marker colours for pole-1..4 (apps/font-zero/src/main.ts palette).
fn colors() -> Value {
    json!({"pole-1": "#d13415", "pole-2": "#0d74ce", "pole-3": "#2a7e3b", "pole-4": "#cc4e00"})
}

fn props(settings: &Value, design: bool, selected: &str, look: &str) -> Value {
    json!({"settings": settings, "design": design, "selected": selected, "look": look, "colors": colors()})
}

pub fn frames() -> Vec<(&'static str, Value, f64, f64, f64, bool)> {
    let s = defaults();
    let mut letter = s.clone();
    letter["within"] = json!(false);
    let mut redacted = s.clone();
    redacted["attractors"][3]["font"] = json!("redacted");
    let mut near = s.clone();
    near["attractors"][0]["radius"] = json!(240);
    vec![
        ("passage", props(&s, false, "pole-4", "theme"), 580.0, 580.0, 2.0, true),
        ("passage-28px", props(&s, false, "pole-4", "theme"), 580.0, 580.0, 1.0, false),
        ("passage-letter", props(&letter, false, "pole-1", "theme"), 580.0, 580.0, 2.0, true),
        ("passage-redacted", props(&redacted, false, "pole-4", "theme"), 580.0, 580.0, 2.0, true),
        ("passage-reach", props(&near, false, "pole-1", "theme"), 580.0, 580.0, 2.0, true),
        ("design-A", props(&s, true, "pole-4", "theme"), 580.0, 580.0, 2.0, true),
        ("passage-aqua", props(&s, false, "pole-4", "aqua"), 580.0, 580.0, 2.0, true),
        ("passage-jaguar", props(&s, false, "pole-4", "jaguar"), 580.0, 580.0, 1.0, false),
        ("design-A-tiger", props(&s, true, "pole-4", "tiger"), 580.0, 580.0, 2.0, true),
        ("design-A-rainbow", props(&s, true, "pole-4", "rainbow"), 580.0, 580.0, 1.0, true),
    ]
}

pub fn render(props: &Value, w: f64, h: f64, scale: f64, fit: bool) -> (u32, u32, Vec<u8>, f64) {
    let mut e = Engine::new().unwrap();
    e.set_viewport(w, h, scale);
    e.update(props).unwrap();
    let mut size = props["settings"]["size"].as_f64().unwrap();
    if fit {
        size = e.fit().unwrap();
        let mut p = props.clone();
        p["settings"]["size"] = json!(size);
        e.update(&p).unwrap();
    }
    let image = e.render(Colors { ink: INK, highlight: HIGHLIGHT }).unwrap();
    (image.width, image.height, image.rgba, size)
}

fn write_png(path: &str, w: u32, h: u32, rgba: &[u8]) {
    let file = std::fs::File::create(path).unwrap();
    let mut enc = png::Encoder::new(std::io::BufWriter::new(file), w, h);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    enc.write_header().unwrap().write_image_data(rgba).unwrap();
}

#[test]
fn golden_frames() {
    let golden: Value = serde_json::from_str(include_str!("golden.json")).unwrap();
    let out = std::env::var("FZ_PNG_DIR").ok();
    let mut actual = serde_json::Map::new();
    for (name, props, w, h, scale, fit) in frames() {
        let start = std::time::Instant::now();
        let (iw, ih, rgba, size) = render(&props, w, h, scale, fit);
        let hash = format!("{:x}", Sha256::digest(&rgba));
        eprintln!("{name}: {iw}x{ih} size {size} {hash} {:?}", start.elapsed());
        if let Some(dir) = &out {
            write_png(&format!("{dir}/{name}.png"), iw, ih, &rgba);
        }
        actual.insert(name.to_string(), json!(hash));
    }
    if std::env::var("FZ_BLESS").is_ok() {
        std::fs::write(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden.json"), serde_json::to_string_pretty(&actual).unwrap() + "\n").unwrap();
        return;
    }
    assert_eq!(Value::Object(actual), golden);
}
