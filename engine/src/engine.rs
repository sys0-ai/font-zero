//! native-renderer.ts: the Font Zero canvas, as a pure function of props,
//! viewport, scroll, pointer and bounce time.

use crate::design::{design_glyph, fit_design_glyph, DesignShape, Frame, Outline};
use crate::forms::{assert_compatible, compatible_forms_for};
use crate::geom::*;
use crate::glyphs::{FontData, Library};
use crate::layout::*;
use crate::raster::{fully_masked, Canvas, Path, Transform};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};

pub static GLYPHS: &[u8] = include_bytes!("../glyphs.bin");

#[derive(Deserialize, Clone, Debug)]
pub struct Attractor {
    pub id: String,
    pub font: String,
    pub mode: String,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub decay: f64,
    pub speed: f64,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub text: String,
    pub size: f64,
    pub leading: f64,
    pub padding: f64,
    pub within: bool,
    pub wrap: bool,
    pub show_attractors: bool,
    pub motion: bool,
    pub preview_glyph: String,
    #[serde(default)]
    pub font_name: String,
    #[serde(default)]
    pub card_width: f64,
    #[serde(default)]
    pub card_height: f64,
    pub attractors: Vec<Attractor>,
}

#[derive(Deserialize)]
struct Props {
    settings: Settings,
    #[serde(default)]
    design: bool,
    #[serde(default)]
    selected: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Colors {
    pub ink: [u8; 4],
    pub highlight: [u8; 4],
}

pub struct Image {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// A font as the renderer uses it: a glyphs.bin font with the set's
/// construction forms applied (variants only).
#[derive(Clone)]
struct Face {
    font: usize,
    forms: Option<Vec<u16>>,
    a: String,
    g: String,
}

struct Prepared {
    ids: Vec<String>,
    faces: Vec<Face>,
    redacted: Face,
    redacted_index: Option<usize>,
    glyphs: BTreeMap<char, Outline>,
    ink: BTreeMap<char, InkBounds>,
    advances: BTreeMap<char, Vec<f64>>,
    reference_advances: BTreeMap<char, f64>,
    blocks: BTreeMap<char, (Vec<Contour>, f64)>,
}

#[derive(Clone, Copy)]
struct Motion {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
}

pub struct Engine {
    lib: Library,
    settings: Option<Settings>,
    design: bool,
    selected: String,
    key: String,
    prepared: Option<Prepared>,
    failure: Option<String>,
    single_glyphs: BTreeMap<String, Outline>,
    positions: BTreeMap<String, Motion>,
    width: f64,
    height: f64,
    scale: f64,
    scroll: (f64, f64),
    pointer: Option<(f64, f64)>,
    layout: Option<(String, Passage)>,
}

struct Metrics<'a> {
    p: &'a Prepared,
    bg: Vec<f64>,
}

impl PassageMetrics for Metrics<'_> {
    fn reference(&self, c: char) -> f64 {
        self.p.reference_advances.get(&c).copied().unwrap_or(0.0)
    }
    fn advance(&self, c: char) -> f64 {
        let mut sum = 0.0;
        for (i, a) in self.p.advances[&c].iter().enumerate() {
            sum += a * self.bg[i];
        }
        sum
    }
    fn ink(&self, c: char) -> Option<InkBounds> {
        self.p.ink.get(&c).copied()
    }
}

fn font_weights_in(redacted_index: Option<usize>, ws: &mut Vec<f64>) {
    let Some(r) = redacted_index else { return };
    ws[r] = 0.0;
    let mut total = 0.0;
    for w in ws.iter() {
        total += w;
    }
    if total != 0.0 && !total.is_nan() {
        for w in ws.iter_mut() {
            *w /= total;
        }
        return;
    }
    ws[r] = 1.0;
}

fn font_weights(redacted_index: Option<usize>, weights: Vec<f64>) -> Vec<f64> {
    let Some(r) = redacted_index else { return weights };
    let mut ws = weights;
    ws[r] = 0.0;
    let mut total = 0.0;
    for w in &ws {
        total += w;
    }
    if total != 0.0 && !total.is_nan() {
        return ws.iter().map(|v| v / total).collect();
    }
    ws[r] = 1.0;
    ws
}

fn alpha8(a: f64) -> u32 {
    let v = js_round(a * 255.0);
    if !(v > 0.0) {
        0
    } else if v > 255.0 {
        255
    } else {
        v as u32
    }
}

impl Engine {
    pub fn new() -> Result<Engine, String> {
        Ok(Engine {
            lib: Library::parse(GLYPHS)?,
            settings: None,
            design: false,
            selected: String::new(),
            key: String::new(),
            prepared: None,
            failure: None,
            single_glyphs: BTreeMap::new(),
            positions: BTreeMap::new(),
            width: 0.0,
            height: 0.0,
            scale: 1.0,
            scroll: (0.0, 0.0),
            pointer: None,
            layout: None,
        })
    }

    /// props = {"settings": <app state.settings>, "design": bool, "selected": "<attractor id>"}
    pub fn update(&mut self, props: &serde_json::Value) -> Result<(), String> {
        let props: Props = serde_json::from_value(props.clone()).map_err(|e| format!("Font Zero props are invalid: {}", e))?;
        let next = props.settings;
        for a in &next.attractors {
            if a.mode != "bounce" {
                self.positions.remove(&a.id);
            }
        }
        let mut chars: BTreeSet<char> = BTreeSet::new();
        chars.extend(next.text.chars());
        chars.extend(next.preview_glyph.chars());
        let fonts: Vec<&str> = next.attractors.iter().map(|a| a.font.as_str()).collect();
        let key = serde_json::to_string(&(fonts, chars.iter().collect::<String>())).unwrap();
        self.design = props.design;
        self.selected = props.selected;
        self.settings = Some(next);
        if key != self.key {
            self.key = key;
            self.positions.clear();
            self.prepared = None;
            self.single_glyphs.clear();
            self.layout = None;
            self.failure = None;
            match self.prepare() {
                Ok(prepared) => self.prepared = Some(prepared),
                Err(e) => self.failure = Some(e),
            }
        }
        // A set that failed to prepare keeps failing until the fonts or characters change.
        match &self.failure {
            Some(e) => Err(e.clone()),
            None => Ok(()),
        }
    }

    /// Whether the fonts of the last update are prepared (renderer.ready()).
    pub fn ready(&self) -> bool {
        self.prepared.is_some()
    }

    pub fn set_viewport(&mut self, width: f64, height: f64, scale: f64) {
        if width != self.width || height != self.height {
            self.positions.clear();
        }
        self.width = width;
        self.height = height;
        self.scale = if scale > 0.0 { scale } else { 1.0 };
    }

    pub fn set_scroll(&mut self, x: f64, y: f64) {
        self.scroll = (x, y);
    }

    pub fn set_pointer(&mut self, at: Option<(f64, f64)>) {
        self.pointer = at;
    }

    /// Scrollable content size in CSS px: the passage, or the viewport for a single glyph.
    pub fn content_size(&self) -> (f64, f64) {
        if self.prepared.is_none() || self.single().is_some() {
            return (self.width, self.height);
        }
        match &self.layout {
            Some((_, l)) => (l.width, l.height),
            None => self.compute_layout().map(|l| (l.width, l.height)).unwrap_or((self.width, self.height)),
        }
    }

    fn face_glyph<'a>(&'a self, face: &Face, cp: u32) -> Option<(&'a FontData, &'a crate::glyphs::GlyphData)> {
        let font = &self.lib.fonts[face.font];
        font.glyphs.get(&cp).map(|g| (font, g))
    }

    fn face_contours(&self, face: &Face, c: char) -> Vec<Contour> {
        let cp = c as u32;
        let Some((_, g)) = self.face_glyph(face, cp) else { return Vec::new() };
        let key = match &face.forms {
            Some(forms) if (33..=126).contains(&cp) => Some(forms[(cp - 33) as usize]),
            _ => None,
        };
        match g.form(key) {
            Some(form) => self.lib.decode(form),
            None => Vec::new(),
        }
    }

    fn advance_of(&self, face: &Face, c: char) -> f64 {
        match self.face_glyph(face, c as u32) {
            Some((_, g)) => g.advance,
            None => self.lib.fonts[face.font].notdef_advance,
        }
    }

    fn face(&self, id: &str, forms: Option<&Vec<String>>) -> Result<Face, String> {
        let index = self.lib.font_index(id).ok_or_else(|| format!("Unknown font {}", id))?;
        let font = &self.lib.fonts[index];
        if font.variant {
            if let Some(forms) = forms {
                let keys: Vec<u16> = forms.iter().map(|k| self.lib.string_index(k).unwrap_or(u16::MAX - 1)).collect();
                let a = forms[97 - 33].split(':').next().unwrap_or("").to_string();
                let g = forms[103 - 33].split(':').next().unwrap_or("").to_string();
                return Ok(Face { font: index, forms: Some(keys), a, g });
            }
        }
        Ok(Face { font: index, forms: None, a: self.lib.string(font.a).to_string(), g: self.lib.string(font.g).to_string() })
    }

    fn outline(&self, faces: &[Face], c: char) -> Outline {
        let shapes: Vec<Vec<Contour>> = faces.iter().map(|f| self.face_contours(f, c)).collect();
        let advances: Vec<f64> = faces.iter().map(|f| self.advance_of(f, c)).collect();
        let entries: Vec<(String, String)> = faces.iter().map(|f| (f.a.clone(), f.g.clone())).collect();
        Outline::new(c, shapes, advances, &entries)
    }

    fn prepare(&self) -> Result<Prepared, String> {
        let settings = self.settings.as_ref().unwrap();
        let mut ids: Vec<String> = Vec::new();
        for a in &settings.attractors {
            if !ids.contains(&a.font) {
                ids.push(a.font.clone());
            }
        }
        let base = ids.iter().find(|id| *id != "redacted").cloned().unwrap_or_else(|| "gf-roboto".to_string());
        let reference = self.face("gf-librebaskerville", None)?;
        let redacted = self.face("redacted", None)?;
        let mut regular: Vec<&FontData> = Vec::new();
        for id in ids.iter().filter(|id| *id != "redacted") {
            regular.push(self.lib.font(id).ok_or_else(|| format!("Unknown font {}", id))?);
        }
        assert_compatible(&self.lib, &regular)?;
        let forms = compatible_forms_for(&self.lib, &regular)?;
        let mut faces = Vec::new();
        for id in &ids {
            faces.push(self.face(if id == "redacted" { &base } else { id }, Some(&forms))?);
        }
        let redacted_index = ids.iter().position(|id| id == "redacted");
        let mut p = Prepared {
            ids,
            faces,
            redacted,
            redacted_index,
            glyphs: BTreeMap::new(),
            ink: BTreeMap::new(),
            advances: BTreeMap::new(),
            reference_advances: BTreeMap::new(),
            blocks: BTreeMap::new(),
        };
        let mut seen = BTreeSet::new();
        for c in settings.text.chars().chain(settings.preview_glyph.chars()) {
            if !seen.insert(c) || c == '\r' || c == '\n' {
                continue;
            }
            let space = is_js_space(c);
            if !space && p.faces.iter().any(|f| self.face_glyph(f, c as u32).is_none()) {
                return Err(format!("A selected font has no “{}” glyph.", c));
            }
            p.reference_advances.insert(c, self.advance_of(&reference, c));
            p.advances.insert(c, p.faces.iter().map(|f| self.advance_of(f, c)).collect());
            if !space {
                p.blocks.insert(c, (self.face_contours(&p.redacted, c), self.advance_of(&p.redacted, c)));
                let mut glyph = self.outline(&p.faces, c);
                let (mut l, mut r, mut t, mut b) = (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
                let n = p.faces.len();
                for i in 0..n {
                    let onehot: Vec<f64> = (0..n).map(|j| if i == j { 1.0 } else { 0.0 }).collect();
                    for contour in glyph.all().contours(&onehot, None) {
                        for curve in contour {
                            for [x, y] in curve {
                                l = jmin(l, x);
                                r = jmax(r, x);
                                t = jmin(t, y);
                                b = jmax(b, y);
                            }
                        }
                    }
                }
                if l.is_finite() {
                    p.ink.insert(c, InkBounds { left: l, right: r, top: t, bottom: b });
                }
                p.glyphs.insert(c, glyph);
            }
        }
        Ok(p)
    }

    fn single(&self) -> Option<char> {
        let s = self.settings.as_ref()?;
        if self.design {
            return Some(s.preview_glyph.chars().next().unwrap_or('A'));
        }
        let p = self.prepared.as_ref()?;
        let t = js_trim(&s.text);
        let mut it = t.chars();
        match (p.redacted_index, it.next(), it.next()) {
            (None, Some(c), None) => Some(c),
            _ => None,
        }
    }

    fn poles(&self) -> Vec<Pole> {
        let (Some(s), Some(p)) = (self.settings.as_ref(), self.prepared.as_ref()) else { return Vec::new() };
        let mut out = Vec::new();
        for a in &s.attractors {
            if self.design && a.mode != "placed" && a.mode != "ambient" {
                continue;
            }
            if a.mode == "cursor" && self.pointer.is_none() {
                continue;
            }
            let (x, y) = if a.mode == "cursor" {
                self.pointer.unwrap()
            } else {
                match self.positions.get(&a.id) {
                    Some(m) => (m.x, m.y),
                    None => (a.x * self.width, a.y * self.height),
                }
            };
            let source = p.ids.iter().position(|id| *id == a.font).unwrap();
            out.push(Pole { id: a.id.clone(), source, x, y, radius: a.radius, decay: a.decay, ambient: a.mode == "ambient" });
        }
        out
    }

    fn compute_layout(&self) -> Option<Passage> {
        let s = self.settings.as_ref()?;
        let p = self.prepared.as_ref()?;
        let metrics = Metrics { p, bg: background_weights(&self.poles(), p.ids.len()) };
        Some(passage_layout(&s.text, s.size, s.leading, s.padding, self.width, s.wrap, &metrics))
    }

    fn layout_key(&self) -> String {
        let s = self.settings.as_ref().unwrap();
        let p = self.prepared.as_ref().unwrap();
        let bg = background_weights(&self.poles(), p.ids.len());
        serde_json::to_string(&(&s.text, s.size, s.leading, s.padding, s.wrap, self.width, bg)).unwrap()
    }

    fn ensure_layout(&mut self) {
        let key = self.layout_key();
        if self.layout.as_ref().map(|(k, _)| k != &key).unwrap_or(true) {
            let l = self.compute_layout().unwrap();
            self.layout = Some((key, l));
        }
    }

    fn design_setup(&self) -> Result<(Vec<Face>, Vec<Pole>, Frame), String> {
        let s = self.settings.as_ref().unwrap();
        let p = self.prepared.as_ref().unwrap();
        let fixed: Vec<&Attractor> = s.attractors.iter().filter(|a| a.mode == "placed" || a.mode == "ambient").collect();
        if fixed.is_empty() {
            return Err("Add a placed or Everywhere attractor.".into());
        }
        if fixed.iter().any(|a| a.font == "redacted") && fixed.iter().any(|a| a.font != "redacted") {
            return Err("Redacted transparency cannot be exported as an outline font.".into());
        }
        let index = |font: &str| p.ids.iter().position(|id| id == font).unwrap();
        let mut sources: Vec<usize> = Vec::new();
        for a in &fixed {
            let i = index(&a.font);
            if !sources.contains(&i) {
                sources.push(i);
            }
        }
        let fonts: Vec<Face> = sources.iter().map(|&i| if p.ids[i] == "redacted" { p.redacted.clone() } else { p.faces[i].clone() }).collect();
        let poles: Vec<Pole> = fixed
            .iter()
            .map(|a| Pole {
                id: a.id.clone(),
                source: sources.iter().position(|&i| i == index(&a.font)).unwrap(),
                x: a.x * self.width,
                y: a.y * self.height,
                radius: a.radius,
                decay: a.decay,
                ambient: a.mode == "ambient",
            })
            .collect();
        Ok((fonts, poles, Frame { width: self.width, height: self.height, size: s.size }))
    }

    /// The single-glyph setup: design fonts and fixed poles, or the text fonts and live poles.
    fn single_setup(&self) -> Result<(Vec<Face>, Vec<Pole>, Frame, String), String> {
        if self.design {
            let (f, p, fr) = self.design_setup()?;
            Ok((f, p, fr, "design".into()))
        } else {
            let p = self.prepared.as_ref().unwrap();
            Ok((p.faces.clone(), self.poles(), Frame { width: self.width, height: self.height, size: self.settings.as_ref().unwrap().size }, "text".into()))
        }
    }

    fn glyph_for(&mut self, c: char, faces: &[Face], name: &str) -> Result<String, String> {
        let ids: Vec<String> = faces.iter().map(|f| f.font.to_string()).collect();
        let key = format!("{}{}/{}", name, c, ids.join(","));
        if !self.single_glyphs.contains_key(&key) {
            if faces.iter().any(|f| self.face_glyph(f, c as u32).is_none()) {
                return Err(format!("Missing glyph: {}", c));
            }
            let outline = self.outline(faces, c);
            self.single_glyphs.insert(key.clone(), outline);
        }
        Ok(key)
    }

    /// Advance bouncing attractors by `dt` seconds; true while still animating.
    pub fn tick(&mut self, dt_seconds: f64) -> bool {
        let Some(s) = self.settings.as_ref() else { return false };
        let moving = s.motion && !self.design;
        if !moving {
            return false;
        }
        let (w, h) = (self.width, self.height);
        let mut any = false;
        for a in &s.attractors {
            if a.mode != "bounce" {
                continue;
            }
            any = true;
            let old = self.positions.get(&a.id).copied().unwrap_or(Motion { x: a.x * w, y: a.y * h, vx: a.speed * 0.8, vy: a.speed * 0.6 });
            let (px, vx) = bounce_axis(old.x, old.vx, dt_seconds, 10.0, w - 10.0);
            let (py, vy) = bounce_axis(old.y, old.vy, dt_seconds, 10.0, h - 10.0);
            self.positions.insert(a.id.clone(), Motion { x: px, y: py, vx, vy });
        }
        any
    }

    /// The size that fits, as renderer.fit().
    pub fn fit(&mut self) -> Result<f64, String> {
        if self.prepared.is_none() {
            return Err("Font curves are still loading.".into());
        }
        self.scroll = (0.0, 0.0);
        let s = self.settings.clone().unwrap();
        if let Some(c) = self.single() {
            let (faces, poles, frame, name) = self.single_setup()?;
            let key = self.glyph_for(c, &faces, &name)?;
            let within = self.design || s.within;
            let outline = self.single_glyphs.get_mut(&key).unwrap();
            return fit_design_glyph(outline, &poles, frame, s.padding, 4096.0, within);
        }
        let p = self.prepared.as_ref().unwrap();
        let metrics = Metrics { p, bg: background_weights(&self.poles(), p.ids.len()) };
        Ok(fit_passage(&s.text, s.leading, s.padding, self.width, self.height, s.wrap, &metrics, 4096.0))
    }

    /// The attractor id under a viewport point.
    pub fn hit(&self, x: f64, y: f64) -> Option<String> {
        self.poles().into_iter().find(|p| !p.ambient && hypot(x - p.x, y - p.y) < 18.0).map(|p| p.id)
    }

    /// The device-pixel image of the viewport.
    pub fn render(&mut self, colors: Colors) -> Result<Image, String> {
        if self.prepared.is_none() || self.settings.is_none() {
            return Err("Font curves are still loading.".into());
        }
        let (w, h, dpr) = (self.width, self.height, self.scale);
        let width = jmax(0.0, js_round(w * dpr)) as usize;
        let height = jmax(0.0, js_round(h * dpr)) as usize;
        let mut canvas = Canvas::new(width, height);
        let s = self.settings.clone().unwrap();
        let p = self.poles();
        let em = s.size;
        if let Some(c) = self.single() {
            let (faces, poles, frame, name) = self.single_setup()?;
            let key = self.glyph_for(c, &faces, &name)?;
            let within = self.design || s.within;
            let outline = self.single_glyphs.get_mut(&key).unwrap();
            let result = design_glyph(outline, &poles, frame, within)?;
            let scale = dpr * em / 100.0;
            let t = Transform { sx: scale, sy: scale, tx: dpr * result.x, ty: dpr * result.y };
            match result.shape {
                DesignShape::Plain(contours) => {
                    let mut path = Path::default();
                    path.add_contours(&contours, t);
                    canvas.fill(&path, colors.ink, 255);
                }
                DesignShape::Masked { original, blended, circles } => {
                    let (mut o, mut b, mut m) = (Path::default(), Path::default(), Path::default());
                    o.add_contours(&original, t);
                    b.add_contours(&blended, t);
                    for (cx, cy, r) in circles {
                        let c = t.apply([cx, cy]);
                        m.add_circle(c[0], c[1], r * scale, false);
                    }
                    canvas.fill_split(&o, &b, &m, colors.ink, 255);
                }
            }
        } else {
            self.ensure_layout();
            let geometry = self.layout.as_ref().unwrap().1.clone();
            let prepared = self.prepared.as_mut().unwrap();
            let n = prepared.ids.len();
            let ri = prepared.redacted_index;
            let bg = background_weights(&p, n);
            let ox = jmax(0.0, (w - geometry.width) / 2.0) - self.scroll.0;
            let oy = jmax(0.0, (h - geometry.height) / 2.0) - self.scroll.1;
            // The within repaint clears inside the attractor circles; glyphs of
            // the first pass that lie wholly under full clip coverage would be
            // erased, so they are resolved but not rasterized.
            let active: Vec<&Pole> = if s.within { p.iter().filter(|p| !p.ambient).collect() } else { Vec::new() };
            let clip = if active.is_empty() {
                None
            } else {
                let mut path = Path::default();
                for a in &active {
                    path.add_circle(dpr * a.x, dpr * a.y, dpr * a.radius, false);
                }
                Some(canvas.coverage(&path))
            };
            let paint = |canvas: &mut Canvas, prepared: &mut Prepared, local: bool, erase: Option<&Vec<u8>>| -> Result<(), String> {
                for row in &geometry.rows {
                    let baseline = row.baseline + oy;
                    if baseline + em < 0.0 || baseline - em > h {
                        continue;
                    }
                    for j in 0..row.chars.len() {
                        let c = row.chars[j];
                        let x = row.xs[j] + ox;
                        let advance = row.advances[j];
                        if is_js_space(c) || x + advance < -em || x > w + em {
                            continue;
                        }
                        let weights = if local { attraction_weights(&p, n, x + advance / 2.0, baseline - em * 0.4) } else { bg.clone() };
                        let alpha = match ri {
                            None => 0.0,
                            Some(r) => weights[r],
                        };
                        let t = Transform { sx: dpr * em / 100.0, sy: dpr * em / 100.0, tx: dpr * x, ty: dpr * baseline };
                        let glyph = prepared.glyphs.get_mut(&c).unwrap();
                        let fw = font_weights(ri, weights.clone());
                        let contours = if local && s.within {
                            let mut field = |gx: f64, gy: f64, out: &mut Vec<f64>| {
                                attraction_weights_into(&p, n, x + gx * em / 100.0, baseline + gy * em / 100.0, out);
                                font_weights_in(ri, out);
                            };
                            glyph.paint(&fw, Some(&mut field))?
                        } else {
                            glyph.paint(&fw, None)?
                        };
                        let mut path = Path::default();
                        path.add_contours(&contours, t);
                        if erase.is_some_and(|m| fully_masked(&path, m, canvas.width, canvas.height)) && alpha == 0.0 {
                            continue;
                        }
                        canvas.fill(&path, colors.ink, alpha8(1.0 - alpha));
                        if alpha != 0.0 {
                            let (block, ba) = &prepared.blocks[&c];
                            let span = if j + 1 < row.chars.len() && !is_js_space(row.chars[j + 1]) { jmax(advance, row.xs[j + 1] - row.xs[j]) } else { advance };
                            let bt = Transform { sx: dpr * span / ba, sy: dpr * em / 100.0, tx: dpr * x, ty: dpr * baseline };
                            let mut bp = Path::default();
                            bp.add_contours(block, bt);
                            canvas.fill(&bp, colors.ink, alpha8(alpha));
                        }
                    }
                }
                Ok(())
            };
            paint(&mut canvas, prepared, !s.within, clip.as_ref())?;
            if let Some(clip) = clip {
                canvas.clip = Some(clip);
                canvas.clear_clipped();
                paint(&mut canvas, prepared, true, None)?;
                canvas.clip = None;
            }
        }
        if s.show_attractors {
            self.markers(&mut canvas, &s, &p, colors);
        }
        Ok(Image { width: width as u32, height: height as u32, rgba: canvas.into_straight() })
    }

    fn markers(&self, canvas: &mut Canvas, s: &Settings, poles: &[Pole], colors: Colors) {
        let (w, h, dpr) = (self.width, self.height, self.scale);
        let reference = self.lib.font_index("gf-librebaskerville").unwrap();
        let digits = Face { font: reference, forms: None, a: String::new(), g: String::new() };
        for (i, a) in s.attractors.iter().enumerate() {
            let Some(pole) = poles.iter().find(|p| p.id == a.id) else { continue };
            if a.mode == "ambient" {
                continue;
            }
            let x = jmax(12.0, jmin(w - 12.0, pole.x));
            let y = jmax(12.0, jmin(h - 12.0, pole.y));
            let r = if a.id == self.selected { 9.0 } else { 6.0 };
            let mut dot = Path::default();
            dot.add_circle(dpr * x, dpr * y, dpr * r, false);
            canvas.fill(&dot, colors.highlight, 255);
            let mut ring = Path::default();
            ring.add_circle(dpr * x, dpr * y, dpr * (r + 0.5), false);
            ring.add_circle(dpr * x, dpr * y, dpr * (r - 0.5), true);
            canvas.fill(&ring, colors.ink, 255);
            let label = (i + 1).to_string();
            let mut tx = jmax(4.0, jmin(w - 20.0, x + 13.0));
            let ty = jmax(4.0, jmin(h - 20.0, y - 5.0));
            let mut text = Path::default();
            for c in label.chars() {
                let t = Transform { sx: dpr * MARKER_SIZE / 100.0, sy: dpr * MARKER_SIZE / 100.0, tx: dpr * tx, ty: dpr * (ty + MARKER_ASCENT * MARKER_SIZE) };
                text.add_contours(&self.face_contours(&digits, c), t);
                tx += self.advance_of(&digits, c) * MARKER_SIZE / 100.0;
            }
            canvas.fill(&text, colors.ink, 255);
        }
    }
}

/// Marker numerals: Libre Baskerville at this CSS px size, hung from the
/// label's top edge like textBaseline 'top'.
const MARKER_SIZE: f64 = 12.0;
const MARKER_ASCENT: f64 = 0.9;
