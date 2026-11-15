//! construction.ts (letter construction families) and compatibility.ts
//! (which construction forms a font set shares).

use crate::geom::*;
use crate::glyphs::{FontData, Library};

pub struct Construction {
    pub key: String,
    pub sources: Vec<usize>,
}

fn topology(contours: &[Contour]) -> (usize, usize) {
    let areas: Vec<f64> = contours.iter().map(|c| area(c) * 2.0).collect();
    let mut largest = 0.0f64;
    for &a in &areas {
        if a.abs() > largest.abs() {
            largest = a;
        }
    }
    (areas.iter().filter(|a| **a * largest > 0.0).count(), areas.iter().filter(|a| **a * largest < 0.0).count())
}

/// `entries[i]` is the font's (a, g) construction names.
pub fn constructions(character: &str, shapes: &[&[Contour]], entries: &[(String, String)]) -> Vec<Construction> {
    let mut groups: Vec<Construction> = Vec::new();
    for (i, shape) in shapes.iter().enumerate() {
        let (bodies, counters) = topology(shape);
        let name = match character {
            "a" => entries[i].0.clone(),
            "g" => entries[i].1.clone(),
            _ => format!("{} bodies, {} counters", bodies, counters),
        };
        let key = format!("{}:{}:{}", name, bodies, counters);
        match groups.iter_mut().find(|g| g.key == key) {
            Some(g) => g.sources.push(i),
            None => groups.push(Construction { key, sources: vec![i] }),
        }
    }
    groups
}

fn options<'a>(lib: &'a Library, font: &'a FontData, character: usize) -> Vec<&'a str> {
    let key = lib.string(font.signature[character]);
    let mut out = vec![key];
    if font.variant {
        let c = (character as u8 + 33) as char;
        if let Some((_, keys)) = font.alternates.iter().find(|(ch, _)| *ch == c) {
            for k in keys {
                out.push(lib.string(*k));
            }
        }
    }
    out
}

pub fn different_letters(lib: &Library, fonts: &[&FontData]) -> Vec<char> {
    if fonts.len() < 2 {
        return Vec::new();
    }
    let mut out = Vec::new();
    for i in 0..fonts[0].signature.len() {
        let shared = options(lib, fonts[0], i).iter().any(|key| fonts.iter().all(|f| options(lib, f, i).contains(key)));
        if !shared {
            out.push((i as u8 + 33) as char);
        }
    }
    out
}

pub fn assert_compatible(lib: &Library, fonts: &[&FontData]) -> Result<(), String> {
    let different = different_letters(lib, fonts);
    if !different.is_empty() {
        let list: Vec<String> = different.iter().map(|c| c.to_string()).collect();
        return Err(format!("These fonts cannot blend: different constructions for {}.", list.join(", ")));
    }
    Ok(())
}

/// The construction key every font in the set uses, per character 33..126.
pub fn compatible_forms_for(lib: &Library, fonts: &[&FontData]) -> Result<Vec<String>, String> {
    assert_compatible(lib, fonts)?;
    let preferred = fonts.iter().find(|f| !f.variant).or(fonts.first());
    let Some(preferred) = preferred else {
        let papyrus = lib.font("papyrus-alternates").ok_or("Unknown font papyrus-alternates")?;
        return Ok(papyrus.signature.iter().map(|k| lib.string(*k).to_string()).collect());
    };
    Ok((0..preferred.signature.len())
        .map(|i| {
            options(lib, preferred, i)
                .into_iter()
                .find(|key| fonts.iter().all(|f| options(lib, f, i).contains(key)))
                .unwrap()
                .to_string()
        })
        .collect())
}
