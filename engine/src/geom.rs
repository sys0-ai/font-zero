//! Cubic contour primitives (curves.ts): points, cubics, arc-length tables.
//! Every transcendental goes through `libm` so all targets agree bit for bit.

pub type Point = [f64; 2];
pub type Cubic = [Point; 4];
pub type Contour = Vec<Cubic>;

pub const PI: f64 = core::f64::consts::PI;

#[inline]
pub fn hypot(x: f64, y: f64) -> f64 {
    libm::hypot(x, y)
}

#[inline]
pub fn lerp(a: Point, b: Point, t: f64) -> Point {
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

#[inline]
pub fn distance(a: Point, b: Point) -> f64 {
    hypot(a[0] - b[0], a[1] - b[1])
}

pub fn split(c: &Cubic, t: f64) -> (Cubic, Cubic) {
    let a = lerp(c[0], c[1], t);
    let b = lerp(c[1], c[2], t);
    let d = lerp(c[2], c[3], t);
    let e = lerp(a, b, t);
    let f = lerp(b, d, t);
    let g = lerp(e, f, t);
    ([c[0], a, e, g], [g, f, d, c[3]])
}

pub fn at(c: &Cubic, t: f64) -> Point {
    let u = 1.0 - t;
    let a = u * u * u;
    let b = 3.0 * u * u * t;
    let d = 3.0 * u * t * t;
    let e = t * t * t;
    [
        a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0],
        a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1],
    ]
}

/// JS `Math.round`: halves round toward +infinity.
pub fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 {
        f + 1.0
    } else {
        f
    }
}

/// JS `%` on numbers is C `fmod`.
#[inline]
pub fn fmod(a: f64, b: f64) -> f64 {
    libm::fmod(a, b)
}

/// `((v % 1) + 1) % 1`
#[inline]
pub fn wrap1(v: f64) -> f64 {
    fmod(fmod(v, 1.0) + 1.0, 1.0)
}

/// JS `Math.max(...values)` (−Infinity for none; NaN wins).
pub fn max_of(values: impl IntoIterator<Item = f64>) -> f64 {
    let mut m = f64::NEG_INFINITY;
    for v in values {
        if v.is_nan() {
            return f64::NAN;
        }
        if v > m {
            m = v;
        }
    }
    m
}

pub fn min_of(values: impl IntoIterator<Item = f64>) -> f64 {
    let mut m = f64::INFINITY;
    for v in values {
        if v.is_nan() {
            return f64::NAN;
        }
        if v < m {
            m = v;
        }
    }
    m
}

/// JS `Math.max(a, b)`
#[inline]
pub fn jmax(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a > b {
        a
    } else {
        b
    }
}

#[inline]
pub fn jmin(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a < b {
        a
    } else {
        b
    }
}

/// JS numeric comparator sort `(a,b)=>a-b` (stable).
pub fn sort_numbers(v: &mut [f64]) {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(core::cmp::Ordering::Equal));
}

pub fn area(c: &[Cubic]) -> f64 {
    let mut points: Vec<Point> = Vec::with_capacity(c.len() * 2);
    for s in c {
        points.push(s[0]);
        points.push(at(s, 0.5));
    }
    let n = points.len();
    let mut sum = 0.0;
    for i in 0..n {
        let p = points[i];
        let q = points[(i + 1) % n];
        sum += p[0] * q[1] - q[0] * p[1];
    }
    sum / 2.0
}

pub fn center(c: &[Cubic]) -> Point {
    let n = c.len() as f64;
    let mut x = 0.0;
    let mut y = 0.0;
    for s in c {
        x += s[0][0];
    }
    for s in c {
        y += s[0][1];
    }
    [x / n, y / n]
}

pub fn reverse(c: &[Cubic]) -> Contour {
    c.iter().rev().map(|s| [s[3], s[2], s[1], s[0]]).collect()
}

pub fn collapse(c: &[Cubic]) -> Contour {
    let p = center(c);
    c.iter().map(|_| [p, p, p, p]).collect()
}

pub struct Measured {
    pub contour: Contour,
    pub total: f64,
    pub starts: Vec<f64>,
    pub tables: Vec<[f64; 33]>,
}

pub fn measure(contour: &[Cubic]) -> Measured {
    let mut total = 0.0;
    let mut starts = Vec::with_capacity(contour.len());
    let mut tables = Vec::with_capacity(contour.len());
    for c in contour {
        starts.push(total);
        let start = total;
        let mut table = [0.0; 33];
        let mut last = c[0];
        for j in 1..=32 {
            let p = at(c, j as f64 / 32.0);
            total += distance(p, last);
            table[j] = total - start;
            last = p;
        }
        tables.push(table);
    }
    Measured { contour: contour.to_vec(), total, starts, tables }
}

pub fn location(m: &Measured, s: f64) -> (usize, f64) {
    let length = jmax(0.0, jmin(m.total, s * m.total));
    let mut i = m.starts.len() - 1;
    while i > 0 && m.starts[i] > length + 1e-9 {
        i -= 1;
    }
    let table = &m.tables[i];
    let within = length - m.starts[i];
    let mut j = 0;
    while j < 31 && table[j + 1] < within {
        j += 1;
    }
    let d = table[j + 1] - table[j];
    let d = if d == 0.0 || d.is_nan() { 1.0 } else { d };
    (i, jmin(1.0, (j as f64 + (within - table[j]) / d) / 32.0))
}

pub fn sample(m: &Measured, s: f64) -> Point {
    let (i, t) = location(m, wrap1(s));
    at(&m.contour[i], t)
}

pub fn portion(m: &Measured, from: f64, to: f64) -> Cubic {
    let mid = (from + to) / 2.0;
    let cycle = mid.floor();
    let a = from - cycle;
    let b = to - cycle;
    let (i, _) = location(m, (a + b) / 2.0);
    let start = m.starts[i] / m.total;
    let end = (m.starts[i] + m.tables[i][32]) / m.total;
    let to_t = |s: f64| -> f64 {
        if s <= start + 1e-8 {
            return 0.0;
        }
        if s >= end - 1e-8 {
            return 1.0;
        }
        location(m, s).1
    };
    let t0 = to_t(a);
    let t1 = to_t(b);
    let c = &m.contour[i];
    if t0 < 1e-10 {
        return split(c, t1).0;
    }
    split(&split(c, t0).1, (t1 - t0) / (1.0 - t0)).0
}

/// JS whitespace (String.prototype.trim and /\s/u).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\u{9}'..='\u{D}'
            | ' '
            | '\u{A0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202F}'
            | '\u{205F}'
            | '\u{3000}'
            | '\u{FEFF}'
    )
}

pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// Tight bounds of cubic contours (Paper's `bounds`): curve extrema, not
/// control points. Returns [left, top, right, bottom]; None when empty.
pub fn tight_bounds(contours: &[Contour]) -> Option<[f64; 4]> {
    let mut b = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
    let mut any = false;
    for contour in contours {
        for c in contour {
            any = true;
            let mut include = |p: Point| {
                if p[0] < b[0] {
                    b[0] = p[0];
                }
                if p[1] < b[1] {
                    b[1] = p[1];
                }
                if p[0] > b[2] {
                    b[2] = p[0];
                }
                if p[1] > b[3] {
                    b[3] = p[1];
                }
            };
            include(c[0]);
            include(c[3]);
            for axis in 0..2 {
                for t in extrema(c[0][axis], c[1][axis], c[2][axis], c[3][axis]) {
                    if t > 0.0 && t < 1.0 {
                        include(at(c, t));
                    }
                }
            }
        }
    }
    if any {
        Some(b)
    } else {
        None
    }
}

fn extrema(p0: f64, p1: f64, p2: f64, p3: f64) -> Vec<f64> {
    // derivative / 3 = a t^2 + b t + c
    let a = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
    let b = 2.0 * (p0 - 2.0 * p1 + p2);
    let c = p1 - p0;
    let mut out = Vec::new();
    if a.abs() < 1e-12 {
        if b.abs() > 1e-12 {
            out.push(-c / b);
        }
        return out;
    }
    let disc = b * b - 4.0 * a * c;
    if disc < 0.0 {
        return out;
    }
    let s = disc.sqrt();
    out.push((-b + s) / (2.0 * a));
    out.push((-b - s) / (2.0 * a));
    out
}
