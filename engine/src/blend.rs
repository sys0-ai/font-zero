//! counter-guard.ts (protectCounters) and uniform-curves.ts
//! (compileUniformCurves): blending aligned contour groups.

use crate::curves::limit_blended_handle;
use crate::geom::*;

fn sample_polygon(c: &[Cubic]) -> Vec<Point> {
    let mut out = Vec::with_capacity(c.len() * 2);
    for s in c {
        let (p, q, r, t) = (s[0], s[1], s[2], s[3]);
        out.push(p);
        out.push([(p[0] + 3.0 * q[0] + 3.0 * r[0] + t[0]) / 8.0, (p[1] + 3.0 * q[1] + 3.0 * r[1] + t[1]) / 8.0]);
    }
    out
}

fn signed(ps: &[Point]) -> f64 {
    let n = ps.len();
    let mut sum = 0.0;
    for i in 0..n {
        let p = ps[i];
        let q = ps[(i + 1) % n];
        sum += p[0] * q[1] - p[1] * q[0];
    }
    sum / 2.0
}

struct Containment {
    min_y: f64,
    max_y: f64,
    span: f64,
    bins: Vec<Vec<(Point, Point)>>,
}

impl Containment {
    fn new(poly: &[Point]) -> Containment {
        let mut min_y = f64::INFINITY;
        let mut max_y = f64::NEG_INFINITY;
        for p in poly {
            min_y = jmin(min_y, p[1]);
            max_y = jmax(max_y, p[1]);
        }
        let span = max_y - min_y;
        let mut bins: Vec<Vec<(Point, Point)>> = (0..16).map(|_| Vec::new()).collect();
        if span > 0.0 {
            let n = poly.len();
            let mut j = n - 1;
            for i in 0..n {
                let a = poly[i];
                let b = poly[j];
                if a[1] != b[1] {
                    let from = jmax(0.0, ((jmin(a[1], b[1]) - min_y) / span * 16.0).floor()) as usize;
                    let to = jmin(15.0, ((jmax(a[1], b[1]) - min_y) / span * 16.0).floor()) as usize;
                    for row in from..=to {
                        bins[row].push((a, b));
                    }
                }
                j = i;
            }
        }
        Containment { min_y, max_y, span, bins }
    }
    fn contains(&self, p: Point) -> bool {
        if self.span <= 0.0 || p[1] < self.min_y || p[1] >= self.max_y {
            return false;
        }
        let mut yes = false;
        let bin = jmin(15.0, ((p[1] - self.min_y) / self.span * 16.0).floor()) as usize;
        for (a, b) in &self.bins[bin] {
            if (a[1] > p[1]) != (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0] {
                yes = !yes;
            }
        }
        yes
    }
}

pub fn protect_counters(contours: Vec<Contour>) -> Vec<Contour> {
    if contours.len() < 2 {
        return contours;
    }
    let polygons: Vec<Vec<Point>> = contours.iter().map(|c| sample_polygon(c)).collect();
    let areas: Vec<f64> = polygons.iter().map(|p| signed(p)).collect();
    let mut largest = 0;
    for (i, a) in areas.iter().enumerate() {
        if a.abs() > areas[largest].abs() {
            largest = i;
        }
    }
    let outers: Vec<&Vec<Point>> = polygons.iter().enumerate().filter(|(i, _)| areas[*i] * areas[largest] > 0.0).map(|(_, p)| p).collect();
    let containment: Vec<Containment> = outers.iter().map(|p| Containment::new(p)).collect();
    let contains = |p: Point| containment.iter().any(|c| c.contains(p));
    let mut out = Vec::with_capacity(contours.len());
    for (index, c) in contours.into_iter().enumerate() {
        if areas[index] * areas[largest] >= 0.0 || areas[index].abs() < 1e-9 {
            out.push(c);
            continue;
        }
        let ps = &polygons[index];
        let stride = core::cmp::max(1, ps.len() / 48);
        let probes: Vec<Point> = ps.iter().enumerate().filter(|(i, _)| i % stride == 0).map(|(_, p)| *p).collect();
        if probes.iter().all(|p| contains(*p)) {
            out.push(c);
            continue;
        }
        let mut sx = 0.0;
        for p in ps {
            sx += p[0];
        }
        let mut sy = 0.0;
        for p in ps {
            sy += p[1];
        }
        let center: Point = [sx / ps.len() as f64, sy / ps.len() as f64];
        let mut target = center;
        if !contains(center) {
            let mut best = f64::INFINITY;
            for poly in &outers {
                let low = min_of(poly.iter().map(|p| p[1]));
                let high = max_of(poly.iter().map(|p| p[1]));
                for row in 0..=24 {
                    let y = if row == 0 { center[1] } else { low + (high - low) * (row as f64 - 0.5) / 24.0 };
                    let mut xs: Vec<f64> = Vec::new();
                    let n = poly.len();
                    let mut j = n - 1;
                    for i in 0..n {
                        let a = poly[i];
                        let b = poly[j];
                        if (a[1] > y) != (b[1] > y) {
                            xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
                        }
                        j = i;
                    }
                    sort_numbers(&mut xs);
                    let mut i = 0;
                    while i + 1 < xs.len() {
                        let x = (xs[i] + xs[i + 1]) / 2.0;
                        let d = (x - center[0]) * (x - center[0]) + (y - center[1]) * (y - center[1]);
                        if d < best {
                            best = d;
                            target = [x, y];
                        }
                        i += 2;
                    }
                }
            }
        }
        if !contains(target) {
            continue;
        }
        let transform = |p: Point, scale: f64| -> Point { [target[0] + (p[0] - center[0]) * scale, target[1] + (p[1] - center[1]) * scale] };
        let mut low = 0.0;
        let mut high = 1.0;
        for _ in 0..12 {
            let mid = (low + high) / 2.0;
            if probes.iter().all(|p| contains(transform(*p, mid))) {
                low = mid;
            } else {
                high = mid;
            }
        }
        // Leave a small interior margin, rather than touching through the outer stroke.
        let scale = low * (1.0 - 0.08 * (1.0 - low));
        if scale < 1e-5 {
            continue;
        }
        let moved: Contour = c.iter().map(|s| [transform(s[0], scale), transform(s[1], scale), transform(s[2], scale), transform(s[3], scale)]).collect();
        if !moved.is_empty() {
            out.push(moved);
        }
    }
    out.into_iter().filter(|c| !c.is_empty()).collect()
}

struct Compiled {
    count: usize,
    sources: usize,
    coords: Vec<f64>,
    handles: Vec<f64>,
}

/// Compile the source coordinates and tangent directions once. A uniform blend
/// does not need to sample a spatial field at every control point.
pub struct UniformCurves {
    compiled: Vec<Compiled>,
    structured: bool,
}

/// A spatial weight field: writes the weights at (x, y) into the vector.
pub type Field<'a> = &'a mut dyn FnMut(f64, f64, &mut Vec<f64>);

impl UniformCurves {
    pub fn new(groups: &[Vec<Contour>], structured: bool) -> UniformCurves {
        let compiled = groups
            .iter()
            .map(|group| {
                let count = group[0].len();
                let sources = group.len();
                let mut coords = vec![0.0; count * 8 * sources];
                let mut handles = vec![0.0; count * 6 * sources];
                for i in 0..count {
                    for k in 0..sources {
                        let c = group[k][i];
                        for j in 0..4 {
                            coords[(i * 8 + j * 2) * sources + k] = c[j][0];
                            coords[(i * 8 + j * 2 + 1) * sources + k] = c[j][1];
                        }
                        for side in 0..2 {
                            let (a, h) = if side == 0 { (0, 1) } else { (3, 2) };
                            let dx = c[h][0] - c[a][0];
                            let dy = c[h][1] - c[a][1];
                            let length = hypot(dx, dy);
                            let index = (i * 6 + side * 3) * sources + k;
                            handles[index] = if length > 1e-9 { dx / length } else { 0.0 };
                            handles[index + sources] = if length > 1e-9 { dy / length } else { 0.0 };
                            handles[index + sources * 2] = length;
                        }
                    }
                }
                Compiled { count, sources, coords, handles }
            })
            .collect();
        UniformCurves { compiled, structured }
    }

    pub fn contours(&self, weights: &[f64], mut field: Option<Field>) -> Vec<Contour> {
        let mut weights: Vec<f64> = weights.to_vec();
        // The field is a pure function of the point: reuse the weights of a
        // recently sampled identical point (shared anchors, handle bases).
        let mut memo: [(u64, u64, usize); 4] = [(u64::MAX, u64::MAX, usize::MAX); 4];
        let mut memo_weights: [Vec<f64>; 4] = Default::default();
        let mut memo_next = 0usize;
        let mut sample = |f: &mut dyn FnMut(f64, f64, &mut Vec<f64>), mx: f64, my: f64, out: &mut Vec<f64>| {
            let key = (mx.to_bits(), my.to_bits());
            for (i, m) in memo.iter().enumerate() {
                if m.0 == key.0 && m.1 == key.1 && m.2 != usize::MAX {
                    out.clone_from(&memo_weights[i]);
                    return;
                }
            }
            f(mx, my, out);
            memo[memo_next] = (key.0, key.1, 0);
            memo_weights[memo_next].clone_from(out);
            memo_next = (memo_next + 1) % 4;
        };
        let mut contours: Vec<Contour> = Vec::with_capacity(self.compiled.len());
        for g in &self.compiled {
            let (count, sources, coords, handles) = (g.count, g.sources, &g.coords, &g.handles);
            let mut contour: Contour = Vec::with_capacity(count);
            for i in 0..count {
                let mut curve: Cubic = [[0.0; 2]; 4];
                for j in 0..4 {
                    let mut x = 0.0;
                    let mut y = 0.0;
                    let index = (i * 8 + j * 2) * sources;
                    if let Some(f) = field.as_mut() {
                        let mut mx = 0.0;
                        let mut my = 0.0;
                        for k in 0..sources {
                            mx += coords[index + k] / sources as f64;
                            my += coords[index + sources + k] / sources as f64;
                        }
                        sample(&mut **f, mx, my, &mut weights);
                    }
                    for k in 0..sources {
                        x += coords[index + k] * weights[k];
                        y += coords[index + sources + k] * weights[k];
                    }
                    curve[j] = [x, y];
                }
                if self.structured {
                    for side in 0..2 {
                        let mut dx = 0.0;
                        let mut dy = 0.0;
                        let mut length = 0.0;
                        let index = (i * 6 + side * 3) * sources;
                        if let Some(f) = field.as_mut() {
                            let a = (i * 8 + if side == 0 { 0 } else { 6 }) * sources;
                            let mut mx = 0.0;
                            let mut my = 0.0;
                            for k in 0..sources {
                                mx += coords[a + k] / sources as f64;
                                my += coords[a + sources + k] / sources as f64;
                            }
                            sample(&mut **f, mx, my, &mut weights);
                        }
                        for k in 0..sources {
                            dx += handles[index + k] * weights[k];
                            dy += handles[index + sources + k] * weights[k];
                            length += handles[index + sources * 2 + k] * weights[k];
                        }
                        let norm = hypot(dx, dy);
                        let (a, h) = if side == 0 { (0, 1) } else { (3, 2) };
                        if norm > 1e-9 {
                            curve[h] = limit_blended_handle(
                                curve[a],
                                curve[if side == 0 { 3 } else { 0 }],
                                curve[h],
                                [curve[a][0] + dx / norm * length, curve[a][1] + dy / norm * length],
                            );
                        }
                    }
                }
                contour.push(curve);
            }
            contours.push(contour);
        }
        if self.structured {
            protect_counters(contours)
        } else {
            contours
        }
    }
}
