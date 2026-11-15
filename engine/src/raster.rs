//! Scalar rasterizer: fixed cubic subdivision, signed-area coverage
//! accumulation (font-rs style) with nonzero clamping, and integer
//! premultiplied compositing. Identical on every target: only IEEE f64
//! add/sub/mul/div/sqrt/floor and integer arithmetic.

use crate::geom::*;

/// A path in device pixels: closed polylines.
#[derive(Default, Clone)]
pub struct Path {
    pub polys: Vec<Vec<Point>>,
}

#[derive(Clone, Copy)]
pub struct Transform {
    pub sx: f64,
    pub sy: f64,
    pub tx: f64,
    pub ty: f64,
}

impl Transform {
    #[inline]
    pub fn apply(&self, p: Point) -> Point {
        [p[0] * self.sx + self.tx, p[1] * self.sy + self.ty]
    }
}

const TOLERANCE: f64 = 0.05;

fn subdivisions(c: &[Point; 4]) -> usize {
    let ddx = jmax((c[0][0] - 2.0 * c[1][0] + c[2][0]).abs(), (c[1][0] - 2.0 * c[2][0] + c[3][0]).abs());
    let ddy = jmax((c[0][1] - 2.0 * c[1][1] + c[2][1]).abs(), (c[1][1] - 2.0 * c[2][1] + c[3][1]).abs());
    let dd = (ddx * ddx + ddy * ddy).sqrt();
    let n = (dd * 0.75 / TOLERANCE).sqrt().ceil();
    if !(n >= 1.0) {
        1
    } else if n > 64.0 {
        64
    } else {
        n as usize
    }
}

impl Path {
    pub fn add_contours(&mut self, contours: &[Contour], t: Transform) {
        for contour in contours {
            if contour.is_empty() {
                continue;
            }
            let mut poly: Vec<Point> = Vec::new();
            poly.push(t.apply(contour[0][0]));
            for c in contour {
                let d = [t.apply(c[0]), t.apply(c[1]), t.apply(c[2]), t.apply(c[3])];
                let n = subdivisions(&d);
                for i in 1..=n {
                    if i == n {
                        poly.push(d[3]);
                    } else {
                        poly.push(at(&d, i as f64 / n as f64));
                    }
                }
            }
            self.polys.push(poly);
        }
    }

    /// A full circle in device pixels (clockwise in y-down space).
    pub fn add_circle(&mut self, cx: f64, cy: f64, r: f64, reverse: bool) {
        if !(r > 0.0) {
            return;
        }
        let n = jmin(2048.0, jmax(16.0, (PI * (r / (2.0 * TOLERANCE)).sqrt()).ceil())) as usize;
        let mut poly = Vec::with_capacity(n);
        for i in 0..n {
            let a = i as f64 / n as f64 * 2.0 * PI;
            let a = if reverse { -a } else { a };
            poly.push([cx + r * libm::cos(a), cy + r * libm::sin(a)]);
        }
        self.polys.push(poly);
    }

    pub fn is_empty(&self) -> bool {
        self.polys.is_empty()
    }
}

/// Coverage of a path over a rectangle of the canvas.
pub struct Mask {
    pub x0: usize,
    pub y0: usize,
    pub w: usize,
    pub h: usize,
    pub cov: Vec<u8>,
}

/// The canvas pixel rectangle a path's rasterization touches, if any.
fn pixel_bounds(path: &Path, width: usize, height: usize) -> Option<(usize, usize, usize, usize)> {
    let mut b = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
    for poly in &path.polys {
        for p in poly {
            if !(p[0].is_finite() && p[1].is_finite()) {
                continue;
            }
            b[0] = jmin(b[0], p[0]);
            b[1] = jmin(b[1], p[1]);
            b[2] = jmax(b[2], p[0]);
            b[3] = jmax(b[3], p[1]);
        }
    }
    if !(b[0] <= b[2]) {
        return None;
    }
    let x0 = jmax(0.0, b[0].floor());
    let y0 = jmax(0.0, b[1].floor());
    let x1 = jmin(width as f64, b[2].ceil() + 1.0);
    let y1 = jmin(height as f64, b[3].ceil() + 1.0);
    if !(x0 < x1 && y0 < y1) {
        return None;
    }
    Some((x0 as usize, y0 as usize, x1 as usize, y1 as usize))
}

/// Whether everything a path could paint lies where `mask` is fully set
/// (so a later clearRect through that clip erases it entirely).
pub fn fully_masked(path: &Path, mask: &[u8], width: usize, height: usize) -> bool {
    let Some((x0, y0, x1, y1)) = pixel_bounds(path, width, height) else { return true };
    (y0..y1).all(|y| mask[y * width + x0..y * width + x1].iter().all(|m| *m == 255))
}

/// Rasterize a path (nonzero) clipped to a `width`×`height` canvas.
pub fn rasterize(path: &Path, width: usize, height: usize) -> Option<Mask> {
    let bounds = pixel_bounds(path, width, height)?;
    rasterize_in(path, bounds)
}

/// Rasterize a path (nonzero) over the pixel rectangle [x0, x1)×[y0, y1).
pub fn rasterize_in(path: &Path, (x0, y0, x1, y1): (usize, usize, usize, usize)) -> Option<Mask> {
    if x0 >= x1 || y0 >= y1 {
        return None;
    }
    let w = x1 - x0;
    let h = y1 - y0;
    // Accumulation row stride w + 2: spill columns for the right edge.
    let stride = w + 2;
    let mut acc = vec![0.0f64; stride * h];
    let ox = x0 as f64;
    let oy = y0 as f64;
    let wf = w as f64;
    let hf = h as f64;
    for poly in &path.polys {
        let n = poly.len();
        if n < 2 {
            continue;
        }
        for i in 0..n {
            let p = poly[i];
            let q = poly[(i + 1) % n];
            line(&mut acc, stride, wf, hf, [p[0] - ox, p[1] - oy], [q[0] - ox, q[1] - oy]);
        }
    }
    let mut cov = vec![0u8; w * h];
    for y in 0..h {
        let mut sum = 0.0f64;
        let row = &acc[y * stride..y * stride + stride];
        for x in 0..w {
            sum += row[x];
            let a = sum.abs();
            let a = if a > 1.0 { 1.0 } else { a };
            cov[y * w + x] = (a * 255.0 + 0.5).floor() as u8;
        }
    }
    Some(Mask { x0, y0, w, h, cov })
}

/// Accumulate one edge. Coordinates are local to the mask; x outside
/// [0, w] is clamped onto the border (a vertical edge there carries the same
/// winding for the pixels inside), y outside [0, h] is cut away.
fn line(acc: &mut [f64], stride: usize, w: f64, h: f64, p0: Point, p1: Point) {
    if !(p0[0].is_finite() && p0[1].is_finite() && p1[0].is_finite() && p1[1].is_finite()) {
        return;
    }
    if p0[1] == p1[1] {
        return;
    }
    let (dir, a, b) = if p0[1] < p1[1] { (1.0, p0, p1) } else { (-1.0, p1, p0) };
    // clip vertically
    if b[1] <= 0.0 || a[1] >= h {
        return;
    }
    let dxdy = (b[0] - a[0]) / (b[1] - a[1]);
    let (mut a, mut b) = (a, b);
    if a[1] < 0.0 {
        a = [a[0] + (0.0 - a[1]) * dxdy, 0.0];
    }
    if b[1] > h {
        b = [a[0] + (h - a[1]) * dxdy, h];
    }
    // split at the vertical borders x = 0 and x = w
    let mut pieces: Vec<(Point, Point)> = Vec::with_capacity(3);
    let mut ts: Vec<f64> = Vec::with_capacity(2);
    let dx = b[0] - a[0];
    if dx != 0.0 {
        for edge in [0.0, w] {
            let t = (edge - a[0]) / dx;
            if t > 0.0 && t < 1.0 {
                ts.push(t);
            }
        }
    }
    sort_numbers(&mut ts);
    let mut last = a;
    let dy = b[1] - a[1];
    for t in ts {
        let p = [a[0] + dx * t, a[1] + dy * t];
        pieces.push((last, p));
        last = p;
    }
    pieces.push((last, b));
    for (p, q) in pieces {
        let clamp = |x: f64| if x < 0.0 { 0.0 } else if x > w { w } else { x };
        span(acc, stride, [clamp(p[0]), p[1]], [clamp(q[0]), q[1]], dir);
    }
}

/// font-rs accumulation for a downward edge p (top) → q (bottom) inside [0,w]×[0,h].
fn span(acc: &mut [f64], stride: usize, p: Point, q: Point, dir: f64) {
    if q[1] <= p[1] {
        return;
    }
    let dxdy = (q[0] - p[0]) / (q[1] - p[1]);
    let mut x = p[0];
    let ystart = p[1].floor() as usize;
    let yend = q[1].ceil() as usize;
    for y in ystart..yend {
        let line = y * stride;
        let top = jmax(y as f64, p[1]);
        let bottom = jmin((y + 1) as f64, q[1]);
        let dy = bottom - top;
        if dy <= 0.0 {
            continue;
        }
        let xnext = x + dxdy * dy;
        let d = dy * dir;
        let (x0, x1) = if x < xnext { (x, xnext) } else { (xnext, x) };
        let x0floor = x0.floor();
        let x0i = x0floor as usize;
        let x1ceil = x1.ceil();
        let x1i = x1ceil as usize;
        if x1i <= x0i + 1 {
            let xmf = 0.5 * (x + xnext) - x0floor;
            acc[line + x0i] += d - d * xmf;
            acc[line + x0i + 1] += d * xmf;
        } else {
            let s = 1.0 / (x1 - x0);
            let x0f = x0 - x0floor;
            let a0 = 0.5 * s * (1.0 - x0f) * (1.0 - x0f);
            let x1f = x1 - x1ceil + 1.0;
            let am = 0.5 * s * x1f * x1f;
            acc[line + x0i] += d * a0;
            if x1i == x0i + 2 {
                acc[line + x0i + 1] += d * (1.0 - a0 - am);
            } else {
                let a1 = s * (1.5 - x0f);
                acc[line + x0i + 1] += d * (a1 - a0);
                for xi in x0i + 2..x1i - 1 {
                    acc[line + xi] += d * s;
                }
                let a2 = a1 + (x1i - x0i - 3) as f64 * s;
                acc[line + x1i - 1] += d * (1.0 - a2 - am);
            }
            acc[line + x1i] += d * am;
        }
        x = xnext;
    }
}

#[inline]
pub fn mul255(a: u32, b: u32) -> u32 {
    let t = a * b + 128;
    (t + (t >> 8)) >> 8
}

#[inline]
fn mul16(a: u32, b: u32) -> u32 {
    let t = a as u64 * b as u64 + 32768;
    ((t + (t >> 16)) >> 16) as u32
}

/// Premultiplied RGBA canvas at 16 bits per channel (rounded to straight
/// RGBA8 once, at the end, so faint layers keep their colour).
pub struct Canvas {
    pub width: usize,
    pub height: usize,
    pub px: Vec<u16>,
    /// Active clip coverage (full canvas) or none.
    pub clip: Option<Vec<u8>>,
}

impl Canvas {
    pub fn new(width: usize, height: usize) -> Canvas {
        Canvas { width, height, px: vec![0; width * height * 4], clip: None }
    }

    /// Source-over fill of `path` in straight `color` at `alpha` (0..255).
    pub fn fill(&mut self, path: &Path, color: [u8; 4], alpha: u32) {
        if alpha == 0 || path.is_empty() {
            return;
        }
        if let Some(mask) = rasterize(path, self.width, self.height) {
            self.composite(&mask, color, alpha);
        }
    }

    pub fn composite(&mut self, mask: &Mask, color: [u8; 4], alpha: u32) {
        // colour alpha × global alpha, 16-bit
        let ca = mul16(color[3] as u32 * 257, alpha * 257);
        let rgb = [color[0] as u32 * 257, color[1] as u32 * 257, color[2] as u32 * 257];
        for y in 0..mask.h {
            let cy = mask.y0 + y;
            for x in 0..mask.w {
                let mut c = mask.cov[y * mask.w + x] as u32;
                if c == 0 {
                    continue;
                }
                let cx = mask.x0 + x;
                if let Some(clip) = &self.clip {
                    c = mul255(c, clip[cy * self.width + cx] as u32);
                    if c == 0 {
                        continue;
                    }
                }
                let a = mul16(c * 257, ca);
                let i = (cy * self.width + cx) * 4;
                let inv = 65535 - a;
                for k in 0..3 {
                    self.px[i + k] = (mul16(rgb[k], a) + mul16(self.px[i + k] as u32, inv)) as u16;
                }
                self.px[i + 3] = (a + mul16(self.px[i + 3] as u32, inv)) as u16;
            }
        }
    }

    /// Source-over of a solid straight colour (0..1) through a coverage plane, at `alpha`.
    pub fn paint_plane(&mut self, plane: &[f32], color: [f64; 4], alpha: f64) {
        let ca = color[3] * alpha;
        for (k, &v) in plane.iter().enumerate() {
            if v <= 0.0 {
                continue;
            }
            let a = (v as f64 * ca * 65535.0 + 0.5).floor();
            let a = if a > 65535.0 { 65535 } else { a as u32 };
            if a == 0 {
                continue;
            }
            let i = k * 4;
            let inv = 65535 - a;
            for c in 0..3 {
                let s = (color[c] * a as f64 + 0.5).floor() as u32;
                self.px[i + c] = (s + mul16(self.px[i + c] as u32, inv)).min(65535) as u16;
            }
            self.px[i + 3] = (a + mul16(self.px[i + 3] as u32, inv)).min(65535) as u16;
        }
    }

    /// Source-over of a premultiplied RGBA layer (0..1) the size of the canvas.
    pub fn paint_layer(&mut self, layer: &[[f32; 4]]) {
        let q = |v: f32| -> u32 {
            let v = (v as f64 * 65535.0 + 0.5).floor();
            if v <= 0.0 {
                0
            } else if v > 65535.0 {
                65535
            } else {
                v as u32
            }
        };
        for (k, p) in layer.iter().enumerate() {
            let a = q(p[3]);
            if a == 0 {
                continue;
            }
            let i = k * 4;
            let inv = 65535 - a;
            for c in 0..3 {
                self.px[i + c] = (q(p[c]) + mul16(self.px[i + c] as u32, inv)).min(65535) as u16;
            }
            self.px[i + 3] = (a + mul16(self.px[i + 3] as u32, inv)).min(65535) as u16;
        }
    }

    /// The alpha channel as a coverage plane (0..1).
    pub fn alpha_plane(&self) -> Vec<f32> {
        self.px.chunks_exact(4).map(|p| p[3] as f32 / 65535.0).collect()
    }

    /// Masked composite of two coverages: `inside` where `m` covers, `outside` elsewhere.
    pub fn fill_split(&mut self, outside: &Path, inside: &Path, m: &Path, color: [u8; 4], alpha: u32) {
        let (a, b) = (pixel_bounds(outside, self.width, self.height), pixel_bounds(inside, self.width, self.height));
        let rect = match (a, b) {
            (None, None) => return,
            (Some(r), None) | (None, Some(r)) => r,
            (Some(a), Some(b)) => (a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3)),
        };
        let (w, h) = (rect.2 - rect.0, rect.3 - rect.1);
        let cover = |p: &Path| -> Vec<u8> { rasterize_in(p, rect).map(|m| m.cov).unwrap_or_else(|| vec![0u8; w * h]) };
        let (o, i, mm) = (cover(outside), cover(inside), cover(m));
        let cov: Vec<u8> = (0..w * h).map(|k| (mul255(o[k] as u32, 255 - mm[k] as u32) + mul255(i[k] as u32, mm[k] as u32)).min(255) as u8).collect();
        self.composite(&Mask { x0: rect.0, y0: rect.1, w, h, cov }, color, alpha);
    }

    /// Set the clip to a path's coverage.
    pub fn set_clip(&mut self, path: &Path) {
        self.clip = Some(self.coverage(path));
    }

    /// A path's coverage over the whole canvas.
    pub fn coverage(&self, path: &Path) -> Vec<u8> {
        let mut v = vec![0u8; self.width * self.height];
        if let Some(mask) = rasterize(path, self.width, self.height) {
            for y in 0..mask.h {
                let row = (mask.y0 + y) * self.width + mask.x0;
                v[row..row + mask.w].copy_from_slice(&mask.cov[y * mask.w..(y + 1) * mask.w]);
            }
        }
        v
    }

    /// clearRect over the whole canvas, through the clip.
    pub fn clear_clipped(&mut self) {
        match &self.clip {
            None => self.px.iter_mut().for_each(|v| *v = 0),
            Some(clip) => {
                for (k, &m) in clip.iter().enumerate() {
                    if m == 0 {
                        continue;
                    }
                    let inv = (255 - m as u32) * 257;
                    for c in 0..4 {
                        let i = k * 4 + c;
                        self.px[i] = mul16(self.px[i] as u32, inv) as u16;
                    }
                }
            }
        }
    }

    /// Straight (non-premultiplied) RGBA8, as putImageData takes.
    pub fn into_straight(self) -> Vec<u8> {
        let mut out = vec![0u8; self.px.len()];
        for (p, o) in self.px.chunks_exact(4).zip(out.chunks_exact_mut(4)) {
            let a = p[3] as u32;
            let a8 = (a * 255 + 32767) / 65535;
            o[3] = a8 as u8;
            if a8 == 0 {
                continue;
            }
            for k in 0..3 {
                o[k] = ((p[k] as u64 * 255 + a as u64 / 2) / a as u64).min(255) as u8;
            }
        }
        out
    }
}
