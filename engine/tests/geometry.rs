//! Geometry against fixtures dumped from the TypeScript implementation
//! (engine-fixtures.ts): groupContours, compiled uniform and field blends,
//! attractionWeights and passageLayout, within 1e-4.

use font_zero_engine::blend::UniformCurves;
use font_zero_engine::curves::group_contours;
use font_zero_engine::geom::Contour;
use font_zero_engine::layout::{attraction_weights, passage_layout, InkBounds, PassageMetrics, Pole};
use serde_json::Value;

fn contours(v: &Value) -> Vec<Contour> {
    v.as_array()
        .unwrap()
        .iter()
        .map(|c| {
            c.as_array()
                .unwrap()
                .iter()
                .map(|s| {
                    let p = |i: usize| [s[i][0].as_f64().unwrap(), s[i][1].as_f64().unwrap()];
                    [p(0), p(1), p(2), p(3)]
                })
                .collect()
        })
        .collect()
}

fn close(label: &str, a: &[Contour], b: &[Contour]) {
    assert_eq!(a.len(), b.len(), "{label}: contour count");
    for (i, (x, y)) in a.iter().zip(b).enumerate() {
        assert_eq!(x.len(), y.len(), "{label}: contour {i} segment count");
        for (j, (p, q)) in x.iter().zip(y).enumerate() {
            for k in 0..4 {
                for d in 0..2 {
                    assert!((p[k][d] - q[k][d]).abs() < 1e-4, "{label}: contour {i} segment {j} point {k}: {:?} vs {:?}", p[k], q[k]);
                }
            }
        }
    }
}

fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/geometry.json")).unwrap()
}

#[test]
fn group_and_blend_match_typescript() {
    let f = fixture();
    for case in f["cases"].as_array().unwrap() {
        let label = format!("{} {}", case["character"].as_str().unwrap(), case["fonts"]);
        let c = case["character"].as_str().unwrap();
        let input: Vec<Vec<Contour>> = case["input"].as_array().unwrap().iter().map(contours).collect();
        let groups = group_contours(&input, true, c);
        if let Some(expected) = case.get("groups").filter(|g| !g.is_null()) {
            let expected: Vec<Vec<Contour>> = expected.as_array().unwrap().iter().map(contours).collect();
            assert_eq!(groups.len(), expected.len(), "{label}: group count");
            for (g, e) in groups.iter().zip(&expected) {
                close(&format!("{label} groups"), g, e);
            }
        }
        let compiled = UniformCurves::new(&groups, true);
        let weights: Vec<f64> = case["weights"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).collect();
        close(&format!("{label} uniform"), &compiled.contours(&weights, None), &contours(&case["uniform"]));
        let poles: Vec<Pole> = case["poles"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| Pole {
                id: String::new(),
                source: p["source"].as_u64().unwrap() as usize,
                x: p["x"].as_f64().unwrap(),
                y: p["y"].as_f64().unwrap(),
                radius: p["radius"].as_f64().unwrap(),
                decay: p["decay"].as_f64().unwrap(),
                ambient: false,
            })
            .collect();
        let n = weights.len();
        let mut field = |x: f64, y: f64, out: &mut Vec<f64>| out.clone_from(&attraction_weights(&poles, n, x, y));
        close(&format!("{label} field"), &compiled.contours(&weights, Some(&mut field)), &contours(&case["field"]));
    }
}

struct Synthetic;
fn metric(c: char) -> f64 {
    if font_zero_engine::geom::is_js_space(c) {
        25.0
    } else {
        40.0 + (c as u32 % 17) as f64 * 2.0
    }
}
impl PassageMetrics for Synthetic {
    fn reference(&self, c: char) -> f64 {
        metric(c)
    }
    fn advance(&self, c: char) -> f64 {
        metric(c) * 0.97 + 1.0
    }
    fn ink(&self, c: char) -> Option<InkBounds> {
        if font_zero_engine::geom::is_js_space(c) {
            return None;
        }
        let u = c as u32;
        Some(InkBounds { left: -1.0 - (u % 3) as f64, right: metric(c) + (u % 5) as f64, top: -70.0 - (u % 7) as f64, bottom: 5.0 + (u % 11) as f64 })
    }
}

#[test]
fn passage_layout_matches_typescript() {
    let f = fixture();
    let text = f["layout"]["text"].as_str().unwrap();
    let expected = &f["layout"]["result"];
    let l = passage_layout(text, 28.0, 1.3, 48.0, 580.0, true, &Synthetic);
    assert!((l.width - expected["width"].as_f64().unwrap()).abs() < 1e-6);
    assert!((l.height - expected["height"].as_f64().unwrap()).abs() < 1e-6);
    let rows = expected["rows"].as_array().unwrap();
    assert_eq!(l.rows.len(), rows.len());
    for (r, e) in l.rows.iter().zip(rows) {
        let chars: String = e["chars"].as_array().unwrap().iter().map(|c| c.as_str().unwrap()).collect();
        assert_eq!(r.chars.iter().collect::<String>(), chars);
        assert!((r.baseline - e["baseline"].as_f64().unwrap()).abs() < 1e-6);
        for (x, ex) in r.xs.iter().zip(e["xs"].as_array().unwrap()) {
            assert!((x - ex.as_f64().unwrap()).abs() < 1e-6);
        }
    }
}

#[test]
fn construction_forms_match_typescript() {
    let lib = font_zero_engine::glyphs::Library::parse(font_zero_engine::engine::GLYPHS).unwrap();
    for case in fixture()["forms"].as_array().unwrap() {
        let fonts: Vec<&font_zero_engine::glyphs::FontData> = case["fonts"].as_array().unwrap().iter().map(|id| lib.font(id.as_str().unwrap()).unwrap()).collect();
        match font_zero_engine::forms::compatible_forms_for(&lib, &fonts, case["chars"].as_str()) {
            Ok(forms) => {
                let expected: Vec<String> = case["forms"].as_array().expect(&case.to_string()).iter().map(|v| v.as_str().unwrap().to_string()).collect();
                assert_eq!(forms, expected, "{} {}", case["fonts"], case["chars"]);
            }
            Err(e) => assert_eq!(Some(e.as_str()), case["error"].as_str(), "{} {}", case["fonts"], case["chars"]),
        }
    }
}
