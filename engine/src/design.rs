//! attractor-font-design.ts (prepareDesignGlyph, fitDesignGlyph) and
//! render.ts prepareGlyph/prepareOutline's draw, plus canvas-glyph.ts.
//! Circle subtract/intersect happens in raster space; the centring bounds
//! of a masked glyph are computed from the outlines and circles directly.

use crate::blend::{Field, UniformCurves};
use crate::curves::group_contours;
use crate::forms::{constructions, Construction};
use crate::geom::*;
use crate::layout::{attraction_weights, attraction_weights_into, background_weights, Pole};

/// Outlines of one character in every font of a set.
pub struct Outline {
    pub character: String,
    pub shapes: Vec<Vec<Contour>>,
    pub advances: Vec<f64>,
    families: Vec<Construction>,
    family_curves: Vec<Option<UniformCurves>>,
    all_curves: Option<UniformCurves>,
}

impl Outline {
    pub fn new(character: char, shapes: Vec<Vec<Contour>>, advances: Vec<f64>, entries: &[(String, String)]) -> Outline {
        let character = character.to_string();
        let refs: Vec<&[Contour]> = shapes.iter().map(|s| s.as_slice()).collect();
        let families = constructions(&character, &refs, entries);
        let family_curves = families.iter().map(|_| None).collect();
        Outline { character, shapes, advances, families, family_curves, all_curves: None }
    }

    pub fn resolve(&self, weights: &[f64]) -> Result<usize, String> {
        let active: Vec<usize> = (0..self.families.len()).filter(|&f| self.families[f].sources.iter().any(|&i| weights[i] > 1e-12)).collect();
        if active.len() != 1 {
            return Err(format!("Cannot blend “{}”: the fonts have different letter constructions.", self.character));
        }
        Ok(active[0])
    }

    /// Aligned, compiled curves over every font (canvas-glyph.ts).
    pub fn all(&mut self) -> &UniformCurves {
        if self.all_curves.is_none() {
            self.all_curves = Some(UniformCurves::new(&group_contours(&self.shapes, true, &self.character), true));
        }
        self.all_curves.as_ref().unwrap()
    }

    /// render.ts draw(weights, 0, true): a pole's own outline, otherwise the
    /// structured blend of the construction family's sources.
    pub fn draw(&mut self, weights: &[f64]) -> Result<Vec<Contour>, String> {
        let family = self.resolve(weights)?;
        if let Some(pole) = weights.iter().position(|w| *w > 1.0 - 1e-10) {
            return Ok(self.shapes[pole].clone());
        }
        let sources = self.families[family].sources.clone();
        if self.family_curves[family].is_none() {
            let set: Vec<Vec<Contour>> = sources.iter().map(|&i| self.shapes[i].clone()).collect();
            self.family_curves[family] = Some(UniformCurves::new(&group_contours(&set, true, &self.character), true));
        }
        let sub: Vec<f64> = sources.iter().map(|&i| weights[i]).collect();
        Ok(self.family_curves[family].as_ref().unwrap().contours(&sub, None))
    }

    /// canvas-glyph.ts paint: the contours to fill for these weights.
    pub fn paint(&mut self, weights: &[f64], field: Option<Field>) -> Result<Vec<Contour>, String> {
        self.resolve(weights)?;
        let pole = weights.iter().position(|w| *w > 1.0 - 1e-10);
        if let (Some(pole), None) = (pole, field.as_ref()) {
            return Ok(self.shapes[pole].clone());
        }
        Ok(self.all().contours(weights, field))
    }
}

#[derive(Clone, Copy)]
pub struct Frame {
    pub width: f64,
    pub height: f64,
    pub size: f64,
}

pub enum DesignShape {
    Plain(Vec<Contour>),
    /// (original − circles) ∪ (blended ∩ circles); circles in glyph units.
    Masked { original: Vec<Contour>, blended: Vec<Contour>, circles: Vec<(f64, f64, f64)> },
}

pub struct DesignResult {
    pub shape: DesignShape,
    pub advance: f64,
    pub x: f64,
    pub y: f64,
    pub ink_width: f64,
    pub ink_height: f64,
}

fn bounds_or_zero(b: Option<[f64; 4]>) -> [f64; 4] {
    b.unwrap_or([0.0, 0.0, 0.0, 0.0])
}

/// prepareDesignGlyph(fonts, character)(poles, frame, within)
pub fn design_glyph(outline: &mut Outline, poles: &[Pole], frame: Frame, within: bool) -> Result<DesignResult, String> {
    let n = outline.shapes.len();
    let background = background_weights(poles, n);
    let mut advance = 0.0;
    for (i, a) in outline.advances.iter().enumerate() {
        advance += a * background[i];
    }
    if js_trim(&outline.character).is_empty() {
        return Ok(DesignResult { shape: DesignShape::Plain(Vec::new()), advance, x: frame.width / 2.0, y: frame.height / 2.0, ink_width: 0.0, ink_height: 0.0 });
    }
    let weights = if within { background.clone() } else { attraction_weights(poles, n, frame.width / 2.0, frame.height / 2.0) };
    let base = outline.draw(&weights)?;
    let b = bounds_or_zero(tight_bounds(&base));
    let scale = frame.size / 100.0;
    let (cx, cy) = ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0);
    let x = frame.width / 2.0 - cx * scale;
    let y = frame.height / 2.0 - cy * scale;
    let active: Vec<&Pole> = poles
        .iter()
        .filter(|p| !p.ambient && p.x + p.radius > x + b[0] * scale && p.x - p.radius < x + b[2] * scale && p.y + p.radius > y + b[1] * scale && p.y - p.radius < y + b[3] * scale)
        .collect();
    if !within || active.is_empty() || n == 1 {
        return Ok(DesignResult { shape: DesignShape::Plain(base), advance, x, y, ink_width: b[2] - b[0], ink_height: b[3] - b[1] });
    }
    let mut field = |gx: f64, gy: f64, out: &mut Vec<f64>| attraction_weights_into(poles, n, x + gx * scale, y + gy * scale, out);
    let center = attraction_weights(poles, n, x + cx * scale, y + cy * scale);
    let blended = outline.all().contours(&center, Some(&mut field));
    let circles: Vec<(f64, f64, f64)> = active.iter().map(|p| ((p.x - x) / scale, (p.y - y) / scale, p.radius / scale)).collect();
    let ink = bounds_or_zero(masked_bounds(&base, &blended, &circles));
    let preview_x = frame.width / 2.0 - (ink[0] + ink[2]) / 2.0 * scale;
    let preview_y = frame.height / 2.0 - (ink[1] + ink[3]) / 2.0 * scale;
    Ok(DesignResult {
        shape: DesignShape::Masked { original: base, blended, circles },
        advance,
        x: preview_x,
        y: preview_y,
        ink_width: ink[2] - ink[0],
        ink_height: ink[3] - ink[1],
    })
}

pub fn fit_design_glyph(outline: &mut Outline, poles: &[Pole], frame: Frame, padding: f64, max_size: f64, within: bool) -> Result<f64, String> {
    let width = jmax(1.0, frame.width - 2.0 * padding);
    let height = jmax(1.0, frame.height - 2.0 * padding);
    let mut low = 1.0;
    let mut high = max_size;
    for _ in 0..16 {
        let size = (low + high) / 2.0;
        let ink = design_glyph(outline, poles, Frame { size, ..frame }, within)?;
        if ink.ink_width * size / 100.0 <= width && ink.ink_height * size / 100.0 <= height {
            low = size;
        } else {
            high = size;
        }
    }
    Ok((low * 10.0).floor() / 10.0)
}

const SAMPLES: usize = 32;

fn flatten(contours: &[Contour]) -> Vec<Vec<Point>> {
    contours
        .iter()
        .map(|c| {
            let mut poly = Vec::with_capacity(c.len() * SAMPLES);
            for s in c {
                for i in 0..SAMPLES {
                    poly.push(at(s, i as f64 / SAMPLES as f64));
                }
            }
            poly
        })
        .collect()
}

fn winding(polys: &[Vec<Point>], p: Point) -> bool {
    let mut w = 0i32;
    for poly in polys {
        let n = poly.len();
        for i in 0..n {
            let a = poly[i];
            let b = poly[(i + 1) % n];
            if a[1] <= p[1] {
                if b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) > 0.0 {
                    w += 1;
                }
            } else if b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0.0 {
                w -= 1;
            }
        }
    }
    w != 0
}

/// Bounds of (original − circles) ∪ (blended ∩ circles): the outline parts on
/// their side of the circles, curve/circle crossings, and circle arcs where
/// exactly one of the two fills lies.
fn masked_bounds(original: &[Contour], blended: &[Contour], circles: &[(f64, f64, f64)]) -> Option<[f64; 4]> {
    let inside = |p: Point| circles.iter().any(|&(cx, cy, r)| hypot(p[0] - cx, p[1] - cy) < r);
    let mut b = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
    let mut any = false;
    let mut include = |p: Point| {
        any = true;
        b = [jmin(b[0], p[0]), jmin(b[1], p[1]), jmax(b[2], p[0]), jmax(b[3], p[1])];
    };
    for (contours, keep_inside) in [(original, false), (blended, true)] {
        for c in contours.iter().flatten() {
            let mut ts: Vec<f64> = (0..=SAMPLES).map(|i| i as f64 / SAMPLES as f64).collect();
            // Curve extrema on each axis.
            for axis in 0..2 {
                let (p0, p1, p2, p3) = (c[0][axis], c[1][axis], c[2][axis], c[3][axis]);
                let qa = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
                let qb = 2.0 * (p0 - 2.0 * p1 + p2);
                let qc = p1 - p0;
                if qa.abs() < 1e-12 {
                    if qb.abs() > 1e-12 {
                        ts.push(-qc / qb);
                    }
                } else {
                    let d = qb * qb - 4.0 * qa * qc;
                    if d >= 0.0 {
                        let s = d.sqrt();
                        ts.push((-qb + s) / (2.0 * qa));
                        ts.push((-qb - s) / (2.0 * qa));
                    }
                }
            }
            ts.retain(|t| *t >= 0.0 && *t <= 1.0);
            sort_numbers(&mut ts);
            let mut last: Option<(f64, bool)> = None;
            for &t in &ts {
                let p = at(c, t);
                let side = inside(p);
                if side == keep_inside {
                    include(p);
                }
                if let Some((lt, lside)) = last {
                    if lside != side {
                        // Bisect the crossing onto the circle boundary.
                        let (mut lo, mut hi) = (lt, t);
                        for _ in 0..24 {
                            let mid = (lo + hi) / 2.0;
                            if inside(at(c, mid)) == lside {
                                lo = mid;
                            } else {
                                hi = mid;
                            }
                        }
                        include(at(c, (lo + hi) / 2.0));
                    }
                }
                last = Some((t, side));
            }
        }
    }
    let o = flatten(original);
    let bl = flatten(blended);
    for (k, &(cx, cy, r)) in circles.iter().enumerate() {
        let steps = 720;
        for i in 0..steps {
            let a = i as f64 / steps as f64 * 2.0 * PI;
            let p = [cx + r * libm::cos(a), cy + r * libm::sin(a)];
            if circles.iter().enumerate().any(|(j, &(x, y, rr))| j != k && hypot(p[0] - x, p[1] - y) < rr) {
                continue;
            }
            if winding(&o, p) != winding(&bl, p) {
                include(p);
            }
        }
    }
    if any {
        Some(b)
    } else {
        None
    }
}
