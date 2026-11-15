//! looks.ts's inks and look-paint.ts's compositor: a look's ink is composed
//! from a coverage mask of the text in device pixels — offset, shadow, glow,
//! outline ring, fill (solid, diagonal, per-line gradient or bands), texture,
//! bevel and gloss. A look's paper is CSS behind the canvas, not drawn here.

use crate::geom::*;
use crate::raster::{Canvas, Path};

pub type Rgba = [f64; 4]; // straight, 0..1

/// CSS colours as the looks and the app write them: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba().
pub fn parse_color(s: &str) -> Option<Rgba> {
    let s = s.trim();
    if let Some(hex) = s.strip_prefix('#') {
        let d: Vec<u32> = hex.chars().map(|c| c.to_digit(16)).collect::<Option<Vec<u32>>>()?;
        let v = |i: usize| (d[i] * 16 + d[i + 1]) as f64 / 255.0;
        return match d.len() {
            3 | 4 => Some([d[0] as f64 * 17.0 / 255.0, d[1] as f64 * 17.0 / 255.0, d[2] as f64 * 17.0 / 255.0, if d.len() == 4 { d[3] as f64 * 17.0 / 255.0 } else { 1.0 }]),
            6 | 8 => Some([v(0), v(2), v(4), if d.len() == 8 { v(6) } else { 1.0 }]),
            _ => None,
        };
    }
    let inner = s.strip_prefix("rgba(").or_else(|| s.strip_prefix("rgb("))?.strip_suffix(')')?;
    let parts: Vec<f64> = inner.split(|c| c == ',' || c == '/' || c == ' ').filter(|p| !p.is_empty()).map(|p| p.trim().parse::<f64>().ok()).collect::<Option<Vec<f64>>>()?;
    if parts.len() < 3 {
        return None;
    }
    let c = |v: f64| jmax(0.0, jmin(255.0, v)) / 255.0;
    Some([c(parts[0]), c(parts[1]), c(parts[2]), if parts.len() > 3 { jmax(0.0, jmin(1.0, parts[3])) } else { 1.0 }])
}

pub fn to_u8(c: Rgba) -> [u8; 4] {
    let q = |v: f64| js_round(jmax(0.0, jmin(1.0, v)) * 255.0) as u8;
    [q(c[0]), q(c[1]), q(c[2]), q(c[3])]
}

#[derive(Clone, Copy, PartialEq)]
pub enum Texture {
    Spots,
    Stripes,
    Brushed,
    Fur,
    Stars,
    Waves,
}

#[derive(Default)]
pub struct Ink {
    pub fill: Option<&'static str>,
    pub stops: Option<Vec<(f64, &'static str)>>,
    pub bands: Option<Vec<&'static str>>,
    pub diagonal: bool,
    pub hollow: bool,
    pub shadow: Option<(&'static str, f64, f64)>, // color, dy, blur
    pub offset: Option<(&'static str, f64)>,
    pub glow: Option<(&'static str, f64, f64)>, // color, blur, alpha
    pub ring: Option<(&'static str, f64)>,
    pub bevel: Option<(&'static str, &'static str, f64, f64)>, // light, dark, d, alpha
    pub gloss: Option<(f64, f64)>,
    pub texture: Option<(Texture, &'static str, f64)>,
}

/// The ink of a look (looks.ts), or None for the theme's own ink.
pub fn ink(id: &str) -> Option<Ink> {
    use Texture::*;
    let d = Ink::default;
    Some(match id {
        "rainbow" => Ink { bands: Some(vec!["#61bb46", "#fdb827", "#f5821f", "#e03a3e", "#963d97", "#009ddc"]), ..d() },
        "one-bit" => Ink { fill: Some("#000"), ring: Some(("#fff", 0.06)), ..d() },
        "platinum" => Ink { offset: Some(("#262626", 0.04)), stops: Some(vec![(0.0, "#efefef"), (1.0, "#c4c4c4")]), bevel: Some(("#fff", "#7a7a7a", 0.025, 0.9)), ring: Some(("#000", 0.022)), ..d() },
        "aqua" => Ink {
            shadow: Some(("rgba(11,42,107,.45)", 0.08, 0.07)),
            stops: Some(vec![(0.0, "#0c47b8"), (0.45, "#0a3a9e"), (0.72, "#2a78ec"), (1.0, "#9ed8ff")]),
            gloss: Some((0.92, 0.05)),
            ring: Some(("#06276e", 0.022)),
            ..d()
        },
        "jaguar" => Ink {
            shadow: Some(("rgba(0,0,0,.5)", 0.07, 0.07)),
            stops: Some(vec![(0.0, "#f7d27a"), (0.55, "#d79a37"), (1.0, "#9c5f1a")]),
            texture: Some((Spots, "#2b1708", 0.9)),
            bevel: Some(("#fff", "#5a3408", 0.02, 0.5)),
            gloss: Some((0.55, 0.02)),
            ring: Some(("#5a3408", 0.016)),
            ..d()
        },
        "panther" => Ink {
            shadow: Some(("rgba(0,0,0,.5)", 0.07, 0.06)),
            stops: Some(vec![(0.0, "#fbfbfb"), (0.3, "#cfd2d6"), (0.52, "#f2f3f5"), (0.75, "#9ea3aa"), (1.0, "#d9dce0")]),
            texture: Some((Brushed, "#000", 0.22)),
            bevel: Some(("#fff", "#5d636b", 0.02, 0.7)),
            ring: Some(("#5d636b", 0.016)),
            ..d()
        },
        "tiger" => Ink {
            shadow: Some(("rgba(0,0,0,.5)", 0.07, 0.07)),
            stops: Some(vec![(0.0, "#ffd08a"), (0.4, "#f28a26"), (1.0, "#b8460c")]),
            texture: Some((Stripes, "#140803", 0.85)),
            bevel: Some(("#fff", "#4a1a02", 0.02, 0.5)),
            gloss: Some((0.5, 0.02)),
            ring: Some(("#4a1a02", 0.016)),
            ..d()
        },
        "leopard" => Ink {
            glow: Some(("#c56bff", 0.16, 0.85)),
            stops: Some(vec![(0.0, "#ffffff"), (0.25, "#b9a7ff"), (0.6, "#7a2bd6"), (1.0, "#2a0a5c")]),
            texture: Some((Stars, "#fff", 0.9)),
            ring: Some(("rgba(241,228,255,.9)", 0.012)),
            ..d()
        },
        "snow-leopard" => Ink {
            shadow: Some(("rgba(5,10,36,.55)", 0.06, 0.09)),
            stops: Some(vec![(0.0, "#ffffff"), (0.55, "#eaf2fb"), (1.0, "#b9cde6")]),
            gloss: Some((0.8, 0.0)),
            texture: Some((Stars, "#9fc4ef", 0.8)),
            ring: Some(("#7fa6d6", 0.016)),
            ..d()
        },
        "lion" => Ink {
            shadow: Some(("rgba(0,0,0,.6)", 0.08, 0.08)),
            stops: Some(vec![(0.0, "#ffe9a6"), (0.45, "#e1a83c"), (1.0, "#94591a")]),
            texture: Some((Fur, "#000", 0.28)),
            bevel: Some(("#fff", "#5c3510", 0.02, 0.6)),
            ring: Some(("#5c3510", 0.012)),
            ..d()
        },
        "mountain-lion" => Ink {
            shadow: Some(("rgba(0,0,0,.6)", 0.06, 0.06)),
            stops: Some(vec![(0.0, "#ffffff"), (0.42, "#c9d1da"), (0.5, "#3e4752"), (0.58, "#7f8b98"), (0.8, "#d4dbe2"), (1.0, "#f8fafc")]),
            bevel: Some(("#fff", "#2b3138", 0.018, 0.8)),
            ring: Some(("#2b3138", 0.012)),
            ..d()
        },
        "mavericks" => Ink {
            shadow: Some(("rgba(2,22,39,.45)", 0.06, 0.07)),
            stops: Some(vec![(0.0, "#e9fbff"), (0.35, "#58c6e6"), (0.7, "#0f6ea8"), (1.0, "#083c66")]),
            texture: Some((Waves, "#fff", 0.35)),
            bevel: Some(("#fff", "#063152", 0.018, 0.5)),
            ring: Some(("#063152", 0.012)),
            ..d()
        },
        "yosemite" => Ink { shadow: Some(("rgba(26,16,48,.3)", 0.025, 0.05)), fill: Some("rgba(255,255,255,.96)"), ..d() },
        "big-sur" => Ink {
            shadow: Some(("rgba(74,26,90,.35)", 0.1, 0.12)),
            stops: Some(vec![(0.0, "#ff9a5a"), (0.5, "#ff3d7f"), (1.0, "#6b4dff")]),
            diagonal: true,
            gloss: Some((0.55, 0.0)),
            ..d()
        },
        "neon" => Ink { glow: Some(("#ff2bd6", 0.22, 1.0)), ring: Some(("#ff2bd6", 0.05)), fill: Some("#ffe6fb"), ..d() },
        "outline" => Ink { hollow: true, ring: Some(("#111", 0.02)), ..d() },
        "ink" => Ink { fill: Some("#111"), ..d() },
        _ => return None,
    })
}

#[derive(Clone, Copy)]
pub struct InkRow {
    pub baseline: f64,
    pub em: f64,
}

fn color(s: &str) -> Rgba {
    parse_color(s).unwrap_or([0.0, 0.0, 0.0, 1.0])
}

/// A single-channel coverage plane over the canvas, 0..1.
pub type Plane = Vec<f32>;

/// The plane sampled at (x − dx, y − dy), bilinear between pixel centres, 0 outside (drawImage at an offset).
fn shifted(p: &[f32], w: usize, h: usize, dx: f64, dy: f64) -> Plane {
    let mut out = vec![0f32; w * h];
    let fx = (-dx).floor();
    let fy = (-dy).floor();
    let tx = (-dx - fx) as f32;
    let ty = (-dy - fy) as f32;
    let (ox, oy) = (fx as i64, fy as i64);
    let at = |x: i64, y: i64| -> f32 {
        if x < 0 || y < 0 || x >= w as i64 || y >= h as i64 {
            0.0
        } else {
            p[y as usize * w + x as usize]
        }
    };
    for y in 0..h {
        let sy = y as i64 + oy;
        for x in 0..w {
            let sx = x as i64 + ox;
            let a = at(sx, sy) * (1.0 - tx) + at(sx + 1, sy) * tx;
            let b = at(sx, sy + 1) * (1.0 - tx) + at(sx + 1, sy + 1) * tx;
            out[y * w + x] = a * (1.0 - ty) + b * ty;
        }
    }
    out
}

/// Gaussian blur (canvas shadowBlur: σ = blur / 2) as three box passes per axis.
fn blurred(p: &[f32], w: usize, h: usize, blur: f64) -> Plane {
    let sigma = blur / 2.0;
    let mut out = p.to_vec();
    if sigma < 0.5 {
        return out;
    }
    // boxes for a Gaussian of this σ (W3C filter effects: d = floor(σ·3·√(2π)/4 + 0.5))
    let d = (sigma * 3.0 * (2.0 * PI).sqrt() / 4.0 + 0.5).floor() as usize;
    if d < 1 {
        return out;
    }
    let mut tmp = vec![0f32; w * h];
    for _ in 0..3 {
        box_pass(&out, &mut tmp, w, h, d, true);
        box_pass(&tmp, &mut out, w, h, d, false);
    }
    out
}

fn box_pass(src: &[f32], dst: &mut [f32], w: usize, h: usize, d: usize, horizontal: bool) {
    let (n, lines) = if horizontal { (w, h) } else { (h, w) };
    let left = d / 2;
    let right = d - left - 1;
    let idx = |line: usize, i: usize| if horizontal { line * w + i } else { i * w + line };
    for line in 0..lines {
        let mut sum = 0f64;
        // window [i - left, i + right]
        for i in 0..=right.min(n.saturating_sub(1)) {
            sum += src[idx(line, i)] as f64;
        }
        for i in 0..n {
            dst[idx(line, i)] = (sum / d as f64) as f32;
            let add = i + right + 1;
            if add < n {
                sum += src[idx(line, add)] as f64;
            }
            if i >= left {
                sum -= src[idx(line, i - left)] as f64;
            }
        }
    }
}

/// Seeded mulberry32, as look-paint.ts's `seeded`.
struct Seeded(u32);
impl Seeded {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
}

fn ellipse(path: &mut Path, cx: f64, cy: f64, rx: f64, ry: f64, rotation: f64) {
    let n = jmin(256.0, jmax(16.0, (PI * (jmax(rx, ry) / 0.1).sqrt()).ceil())) as usize;
    let (c, s) = (libm::cos(rotation), libm::sin(rotation));
    let poly = (0..n)
        .map(|i| {
            let a = i as f64 / n as f64 * 2.0 * PI;
            let (x, y) = (rx * libm::cos(a), ry * libm::sin(a));
            [cx + x * c - y * s, cy + x * s + y * c]
        })
        .collect();
    path.polys.push(poly);
}

/// A stroked polyline of width `width` (butt caps): one quad per segment.
fn stroke(path: &mut Path, points: &[Point], width: f64) {
    for k in 1..points.len() {
        let (a, b) = (points[k - 1], points[k]);
        let len = hypot(b[0] - a[0], b[1] - a[1]);
        if len == 0.0 {
            continue;
        }
        let (nx, ny) = (-(b[1] - a[1]) / len * width / 2.0, (b[0] - a[0]) / len * width / 2.0);
        path.polys.push(vec![[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    }
}

fn quad(path: &mut Vec<Point>, p0: Point, c: Point, p1: Point) {
    for i in 1..=16 {
        let t = i as f64 / 16.0;
        let u = 1.0 - t;
        path.push([u * u * p0[0] + 2.0 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2.0 * u * t * c[1] + t * t * p1[1]]);
    }
}

/// look-paint.ts `tile`: one premultiplied RGBA tile of the texture.
fn tile(kind: Texture, color: [u8; 4], size: usize) -> Vec<[f32; 4]> {
    let mut c = Canvas::new(size, size);
    let s = size as f64;
    let name_len = match kind {
        Texture::Spots => 5,
        Texture::Stripes => 7,
        Texture::Brushed => 7,
        Texture::Fur => 3,
        Texture::Stars => 5,
        Texture::Waves => 5,
    };
    let mut r = Seeded((size + name_len * 7919) as u32);
    let alpha = |a: f64| js_round(jmax(0.0, jmin(1.0, a)) * 255.0) as u32;
    match kind {
        Texture::Spots => {
            for _ in 0..9 {
                let (x, y) = (r.next() * s, r.next() * s);
                let rx = s * (0.035 + r.next() * 0.06);
                let ry = rx * (0.7 + r.next() * 0.5);
                for (dx, dy) in [(0.0, 0.0), (s, 0.0), (0.0, s), (s, s), (-s, 0.0), (0.0, -s)] {
                    let mut p = Path::default();
                    ellipse(&mut p, x + dx, y + dy, rx, ry, r.next() * PI);
                    c.fill(&p, color, 255);
                }
            }
        }
        Texture::Stripes => {
            for i in 0..4 {
                let x = (i as f64 + 0.2 + r.next() * 0.5) * s / 4.0;
                let w = s * (0.025 + r.next() * 0.035);
                let bend = s * (0.05 + r.next() * 0.06);
                let mut poly = vec![[x - w, 0.0]];
                quad(&mut poly, [x - w, 0.0], [x + bend, s / 2.0], [x - w, s]);
                poly.push([x + w, s]);
                quad(&mut poly, [x + w, s], [x + bend + w, s / 2.0], [x + w, 0.0]);
                c.fill(&Path { polys: vec![poly] }, color, 255);
            }
        }
        Texture::Brushed => {
            for y in 0..size {
                let a = alpha(r.next() * 0.8);
                let yf = y as f64;
                c.fill(&Path { polys: vec![vec![[0.0, yf], [s, yf], [s, yf + 1.0], [0.0, yf + 1.0]]] }, color, a);
            }
        }
        Texture::Fur => {
            let width = jmax(1.0, s / 90.0);
            let count = (s * 1.5).ceil() as usize;
            for _ in 0..count {
                let (x, y) = (r.next() * s, r.next() * s);
                let l = s * (0.06 + r.next() * 0.1);
                let a = alpha(0.3 + r.next() * 0.7);
                let mut p = Path::default();
                stroke(&mut p, &[[x, y], [x + l * 0.25, y + l]], width);
                c.fill(&p, color, a);
            }
        }
        Texture::Stars => {
            for _ in 0..16 {
                let a = alpha(0.35 + r.next() * 0.65);
                let (x, y) = (r.next() * s, r.next() * s);
                let rr = r.next() * r.next();
                let radius = jmax(0.6, s / 160.0 * (1.0 + rr * 3.0));
                let mut p = Path::default();
                p.add_circle(x, y, radius, false);
                c.fill(&p, color, a);
            }
        }
        Texture::Waves => {
            let width = jmax(1.0, s * 0.035);
            for at in [0.62, 0.8] {
                let a = alpha(if at == 0.62 { 0.8 } else { 0.6 });
                let mut points = Vec::new();
                let mut x = 0.0;
                while x <= s {
                    points.push([x, s * at + libm::sin(x / s * PI * 2.0) * s * 0.06]);
                    x += 2.0;
                }
                let mut p = Path::default();
                stroke(&mut p, &points, width);
                c.fill(&p, color, a);
            }
        }
    }
    c.px.chunks_exact(4).map(|p| [p[0] as f32 / 65535.0, p[1] as f32 / 65535.0, p[2] as f32 / 65535.0, p[3] as f32 / 65535.0]).collect()
}

fn gradient(stops: &[(f64, Rgba)], t: f64) -> Rgba {
    if stops.is_empty() {
        return [0.0; 4];
    }
    if t <= stops[0].0 {
        return stops[0].1;
    }
    for k in 1..stops.len() {
        let (a, b) = (stops[k - 1], stops[k]);
        if t < b.0 {
            let u = if b.0 > a.0 { (t - a.0) / (b.0 - a.0) } else { 1.0 };
            return [a.1[0] + (b.1[0] - a.1[0]) * u, a.1[1] + (b.1[1] - a.1[1]) * u, a.1[2] + (b.1[2] - a.1[2]) * u, a.1[3] + (b.1[3] - a.1[3]) * u];
        }
    }
    stops[stops.len() - 1].1
}

fn premul(c: Rgba) -> [f32; 4] {
    [(c[0] * c[3]) as f32, (c[1] * c[3]) as f32, (c[2] * c[3]) as f32, c[3] as f32]
}

/// source-atop of `src` (premultiplied) at `alpha` onto the layer pixel.
#[inline]
fn atop(dst: &mut [f32; 4], src: [f32; 4], alpha: f32) {
    let sa = src[3] * alpha;
    if sa == 0.0 {
        return;
    }
    let da = dst[3];
    for k in 0..3 {
        dst[k] = src[k] * alpha * da + dst[k] * (1.0 - sa);
    }
}

/// Compose a look's ink from the text's coverage `mask` onto `target` (look-paint.ts compose).
pub fn compose(target: &mut Canvas, ink: &Ink, mask: &[f32], rows: &[InkRow]) {
    let (w, h) = (target.width, target.height);
    let em = rows.first().map(|r| r.em).unwrap_or(16.0);
    if let Some((c, d)) = ink.offset {
        let d = jmax(1.0, d * em);
        target.paint_plane(&shifted(mask, w, h, d, d), color(c), 1.0);
    }
    let cast = |target: &mut Canvas, c: &str, blur: f64, dy: f64, alpha: f64| {
        let plane = blurred(&shifted(mask, w, h, 0.0, dy), w, h, blur);
        target.paint_plane(&plane, color(c), alpha);
    };
    if let Some((c, dy, blur)) = ink.shadow {
        cast(target, c, blur * em, dy * em, 1.0);
    }
    if let Some((c, blur, alpha)) = ink.glow {
        cast(target, c, blur * em, 0.0, alpha);
        cast(target, c, blur * em * 0.4, 0.0, alpha);
    }
    if let Some((c, width)) = ink.ring {
        let r = jmax(0.75, width * em);
        let rings = jmax(1.0, jmin(4.0, (r / 3.0).ceil())) as usize;
        let mut grown = vec![0f32; w * h];
        for k in 1..=rings {
            let d = r * k as f64 / rings as f64;
            let n = jmax(8.0, jmin(32.0, (d * 2.0).ceil())) as usize;
            for i in 0..n {
                let a = i as f64 / n as f64 * PI * 2.0;
                let s = shifted(mask, w, h, d * libm::cos(a), d * libm::sin(a));
                for (g, v) in grown.iter_mut().zip(&s) {
                    *g = *g + *v * (1.0 - *g);
                }
            }
        }
        for (g, m) in grown.iter_mut().zip(mask) {
            *g *= 1.0 - *m;
        }
        target.paint_plane(&grown, color(c), 1.0);
    }
    if ink.hollow {
        return;
    }
    let mut layer: Vec<[f32; 4]> = vec![[0.0; 4]; w * h];
    let solid = match (ink.fill, &ink.stops, &ink.bands) {
        (Some(c), _, _) => Some(color(c)),
        (None, None, None) => Some([0.0, 0.0, 0.0, 1.0]),
        _ => None,
    };
    if let Some(c) = solid {
        let p = premul(c);
        layer.iter_mut().for_each(|v| *v = p);
    } else if ink.diagonal {
        let stops: Vec<(f64, Rgba)> = ink.stops.as_ref().unwrap().iter().map(|(o, c)| (*o, color(c))).collect();
        let (wf, hf) = (w as f64, h as f64);
        let len2 = wf * wf + hf * hf;
        for y in 0..h {
            for x in 0..w {
                let t = ((x as f64 + 0.5) * wf + (y as f64 + 0.5) * hf) / len2;
                layer[y * w + x] = premul(gradient(&stops, t));
            }
        }
    } else {
        let stops: Vec<(f64, Rgba)> = match &ink.bands {
            Some(bands) => {
                let n = bands.len() as f64;
                bands.iter().enumerate().flat_map(|(i, c)| [(i as f64 / n, color(c)), ((i + 1) as f64 / n, color(c))]).collect()
            }
            None => ink.stops.as_ref().unwrap().iter().map(|(o, c)| (*o, color(c))).collect(),
        };
        // Each line has its own gradient, from cap height to baseline; a line's band runs to the next line's.
        for (i, row) in rows.iter().enumerate() {
            let top = row.baseline - row.em * 0.72;
            let from = if i > 0 { (rows[i - 1].baseline + row.baseline) / 2.0 - row.em * 0.3 } else { 0.0 };
            let to = if i + 1 < rows.len() { (row.baseline + rows[i + 1].baseline) / 2.0 - row.em * 0.3 } else { h as f64 };
            for y in 0..h {
                let cy = y as f64 + 0.5;
                if cy < from || cy >= to {
                    continue;
                }
                let span = row.baseline - top;
                let t = if span != 0.0 { (cy - top) / span } else { 0.0 };
                let p = premul(gradient(&stops, t));
                for x in 0..w {
                    layer[y * w + x] = p;
                }
            }
        }
    }
    // destination-in the mask
    for (v, m) in layer.iter_mut().zip(mask) {
        for k in 0..4 {
            v[k] *= *m;
        }
    }
    if let Some((kind, c, alpha)) = ink.texture {
        let size = js_round(jmax(24.0, jmin(512.0, em * 2.4))) as usize;
        let t = tile(kind, to_u8(color(c)), size);
        let a = alpha as f32;
        for y in 0..h {
            for x in 0..w {
                atop(&mut layer[y * w + x], t[(y % size) * size + x % size], a);
            }
        }
    }
    if let Some((light, dark, d, alpha)) = ink.bevel {
        let d = jmax(1.0, d * em);
        for (dx, c) in [(d, light), (-d, dark)] {
            let c = color(c);
            let s = shifted(mask, w, h, dx, dx);
            for k in 0..w * h {
                let cover = (c[3] as f32) * (1.0 - s[k]) * mask[k];
                atop(&mut layer[k], [c[0] as f32 * cover, c[1] as f32 * cover, c[2] as f32 * cover, cover], alpha as f32);
            }
        }
    }
    if let Some((g0, g1)) = ink.gloss {
        for row in rows {
            let top = row.baseline - row.em * 0.78;
            let mid = row.baseline - row.em * 0.34;
            for y in 0..h {
                let cy = y as f64 + 0.5;
                if cy < top || cy >= mid {
                    continue;
                }
                let t = (cy - top) / (mid - top);
                let a = (g0 + (g1 - g0) * t) as f32;
                for x in 0..w {
                    atop(&mut layer[y * w + x], [a, a, a, a], 1.0);
                }
            }
        }
    }
    target.paint_layer(&layer);
}

/// The selected attractor's reach: a dashed circle ([5, 4] CSS px, 1.5 px wide), as stroke() draws it.
pub fn dashed_circle(path: &mut Path, cx: f64, cy: f64, r: f64, width: f64, dash: f64, gap: f64) {
    if !(r > 0.0) {
        return;
    }
    let circumference = 2.0 * PI * r;
    let mut s = 0.0;
    while s < circumference {
        let e = jmin(s + dash, circumference);
        let (a0, a1) = (s / r, e / r);
        let n = jmax(2.0, ((a1 - a0) * r / 2.0).ceil()) as usize;
        let mut poly = Vec::with_capacity(2 * n + 2);
        for i in 0..=n {
            let a = a0 + (a1 - a0) * i as f64 / n as f64;
            poly.push([cx + (r + width / 2.0) * libm::cos(a), cy + (r + width / 2.0) * libm::sin(a)]);
        }
        for i in (0..=n).rev() {
            let a = a0 + (a1 - a0) * i as f64 / n as f64;
            poly.push([cx + (r - width / 2.0) * libm::cos(a), cy + (r - width / 2.0) * libm::sin(a)]);
        }
        path.polys.push(poly);
        s += dash + gap;
    }
}
