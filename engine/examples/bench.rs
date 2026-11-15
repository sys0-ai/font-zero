//! cargo run --release --example bench: time the default passage frame.
use font_zero_engine::{Colors, Engine};
use serde_json::json;
fn main() {
    let settings: serde_json::Value = serde_json::from_str(include_str!("../tests/fixtures/settings.json")).unwrap();
    let mut e = Engine::new().unwrap();
    e.set_viewport(580.0, 580.0, 2.0);
    let t = std::time::Instant::now();
    e.update(&json!({"settings": settings, "design": false, "selected": "pole-4"})).unwrap();
    println!("prepare {:?}", t.elapsed());
    let t = std::time::Instant::now();
    let size = e.fit().unwrap();
    println!("fit {} {:?}", size, t.elapsed());
    let mut s = settings.clone();
    s["size"] = json!(size);
    e.update(&json!({"settings": s, "design": false, "selected": "pole-4"})).unwrap();
    let colors = Colors { ink: [0, 0, 0, 255], highlight: [0, 0, 255, 255] };
    for _ in 0..std::env::var("N").ok().and_then(|v| v.parse().ok()).unwrap_or(3) {
        let t = std::time::Instant::now();
        e.render(colors).unwrap();
        println!("render {:?}", t.elapsed());
    }
}
