//! Reader for glyphs.bin (written by build-glyphs.ts). Outlines decode lazily.

use crate::geom::{Contour, Cubic};
use std::collections::BTreeMap;

pub const VERSION: u32 = 2;
const COORDINATE_SCALE: f64 = 128.0;
pub const NATIVE: u16 = 0xffff;

pub struct GlyphForm {
    pub key: u16,
    offset: usize,
}

pub struct GlyphData {
    pub advance: f64,
    pub forms: Vec<GlyphForm>,
}

pub struct FontData {
    pub id: String,
    pub variant: bool,
    pub effect: bool,
    pub a: u16,
    pub g: u16,
    pub notdef_advance: f64,
    pub signature: Vec<u16>,
    pub alternates: Vec<(char, Vec<u16>)>,
    pub glyphs: BTreeMap<u32, GlyphData>,
}

pub struct Library {
    bytes: &'static [u8],
    strings: Vec<String>,
    pub fonts: Vec<FontData>,
}

struct Reader {
    bytes: &'static [u8],
    at: usize,
}

impl Reader {
    fn take(&mut self, n: usize) -> Result<&'static [u8], String> {
        if self.at + n > self.bytes.len() {
            return Err("glyphs.bin is truncated.".into());
        }
        let s = &self.bytes[self.at..self.at + n];
        self.at += n;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, String> {
        let b = self.take(2)?;
        Ok(u16::from_le_bytes([b[0], b[1]]))
    }
    fn u32(&mut self) -> Result<u32, String> {
        let b = self.take(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn f32(&mut self) -> Result<f64, String> {
        let b = self.take(4)?;
        Ok(f32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64)
    }
    /// zigzag LEB128
    fn varint(&mut self) -> Result<i64, String> {
        let mut z: u64 = 0;
        let mut shift = 0;
        loop {
            let b = self.u8()?;
            z |= ((b & 127) as u64) << shift;
            if b < 128 {
                break;
            }
            shift += 7;
            if shift > 35 {
                return Err("glyphs.bin has a bad coordinate.".into());
            }
        }
        Ok(if z & 1 == 1 { -((z >> 1) as i64) - 1 } else { (z >> 1) as i64 })
    }
}

impl Library {
    pub fn parse(bytes: &'static [u8]) -> Result<Library, String> {
        let mut r = Reader { bytes, at: 0 };
        if r.take(4)? != b"FZG1" {
            return Err("glyphs.bin has the wrong magic.".into());
        }
        let version = r.u32()?;
        if version != VERSION {
            return Err(format!("glyphs.bin version {} is not {}.", version, VERSION));
        }
        let count = r.u32()? as usize;
        let mut strings = Vec::with_capacity(count);
        for _ in 0..count {
            let n = r.u16()? as usize;
            strings.push(std::str::from_utf8(r.take(n)?).map_err(|_| "glyphs.bin has a bad string.")?.to_string());
        }
        let font_count = r.u16()? as usize;
        let mut fonts = Vec::with_capacity(font_count);
        for _ in 0..font_count {
            let id = strings.get(r.u16()? as usize).ok_or("glyphs.bin has a bad font id.")?.clone();
            let variant = r.u8()? != 0;
            let effect = r.u8()? != 0;
            let a = r.u16()?;
            let g = r.u16()?;
            let notdef_advance = r.f32()?;
            let n = r.u16()? as usize;
            let mut signature = Vec::with_capacity(n);
            for _ in 0..n {
                signature.push(r.u16()?);
            }
            let n = r.u16()? as usize;
            let mut alternates = Vec::with_capacity(n);
            for _ in 0..n {
                let c = r.u8()? as char;
                let k = r.u16()? as usize;
                let mut keys = Vec::with_capacity(k);
                for _ in 0..k {
                    keys.push(r.u16()?);
                }
                alternates.push((c, keys));
            }
            let n = r.u32()? as usize;
            let mut glyphs = BTreeMap::new();
            for _ in 0..n {
                let cp = r.u32()?;
                let advance = r.f32()?;
                let form_count = r.u8()? as usize;
                let mut forms = Vec::with_capacity(form_count);
                for _ in 0..form_count {
                    let key = r.u16()?;
                    let length = r.u32()? as usize;
                    forms.push(GlyphForm { key, offset: r.at });
                    r.take(length)?;
                }
                glyphs.insert(cp, GlyphData { advance, forms });
            }
            fonts.push(FontData { id, variant, effect, a, g, notdef_advance, signature, alternates, glyphs });
        }
        if r.at != bytes.len() {
            return Err("glyphs.bin has trailing bytes.".into());
        }
        Ok(Library { bytes, strings, fonts })
    }

    pub fn string(&self, index: u16) -> &str {
        &self.strings[index as usize]
    }

    pub fn font(&self, id: &str) -> Option<&FontData> {
        self.fonts.iter().find(|f| f.id == id)
    }

    pub fn font_index(&self, id: &str) -> Option<usize> {
        self.fonts.iter().position(|f| f.id == id)
    }

    pub fn string_index(&self, s: &str) -> Option<u16> {
        self.strings.iter().position(|x| x == s).map(|i| i as u16)
    }

    pub fn decode(&self, form: &GlyphForm) -> Vec<Contour> {
        let mut r = Reader { bytes: self.bytes, at: form.offset };
        let count = r.u16().unwrap() as usize;
        let mut contours = Vec::with_capacity(count);
        for _ in 0..count {
            let segments = r.u16().unwrap() as usize;
            let n = 1 + segments * 3;
            let mut axes = [vec![0.0f64; n], vec![0.0f64; n]];
            for axis in &mut axes {
                let mut q: i64 = 0;
                for v in axis.iter_mut() {
                    q += r.varint().unwrap();
                    *v = q as f64 / COORDINATE_SCALE;
                }
            }
            let point = |i: usize| [axes[0][i], axes[1][i]];
            let mut contour: Contour = Vec::with_capacity(segments);
            for s in 0..segments {
                let c: Cubic = [point(s * 3), point(s * 3 + 1), point(s * 3 + 2), point(s * 3 + 3)];
                contour.push(c);
            }
            contours.push(contour);
        }
        contours
    }
}

impl GlyphData {
    /// The outline for a construction key (the native form when the key is
    /// the font's own or the glyph has no drawn alternate for it).
    pub fn form(&self, key: Option<u16>) -> Option<&GlyphForm> {
        if let Some(k) = key {
            if let Some(f) = self.forms.iter().find(|f| f.key == k) {
                return Some(f);
            }
        }
        self.forms.iter().find(|f| f.key == NATIVE)
    }
}
