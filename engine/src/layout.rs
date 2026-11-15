//! attractor-math.ts, demo-spacing.ts, demo-wrap.ts and passage-layout.ts.

use crate::geom::*;

#[derive(Clone, Debug)]
pub struct Pole {
    pub id: String,
    pub source: usize,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub decay: f64,
    pub ambient: bool,
}

pub fn background_weights(poles: &[Pole], count: usize) -> Vec<f64> {
    let mut weights = vec![0.0; count];
    let ambient: Vec<&Pole> = poles.iter().filter(|p| p.ambient).collect();
    if !ambient.is_empty() {
        for p in &ambient {
            weights[p.source] += 1.0 / ambient.len() as f64;
        }
    } else if count > 0 {
        weights[0] = 1.0;
    }
    weights
}

pub fn attraction_weights(poles: &[Pole], count: usize, x: f64, y: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(count);
    attraction_weights_into(poles, count, x, y, &mut out);
    out
}

/// attractionWeights into `weights` (resized to `count`), without allocating.
pub fn attraction_weights_into(poles: &[Pole], count: usize, x: f64, y: f64, weights: &mut Vec<f64>) {
    weights.clear();
    weights.resize(count, 0.0);
    let mut ambient = 0usize;
    for p in poles {
        if p.ambient {
            ambient += 1;
        }
    }
    if ambient > 0 {
        for p in poles {
            if p.ambient {
                weights[p.source] += 1.0 / ambient as f64;
            }
        }
    } else if count > 0 {
        weights[0] = 1.0;
    }
    let mut total = 1.0;
    let mut exact = 0usize;
    let mut flat = 0usize;
    for p in poles {
        if p.ambient {
            continue;
        }
        let d = hypot(x - p.x, y - p.y);
        if d < 0.001 {
            exact += 1;
        }
        if p.decay == 0.0 && d < p.radius {
            flat += 1;
        }
    }
    if exact > 0 || flat > 0 {
        weights.iter_mut().for_each(|w| *w = 0.0);
        for p in poles {
            if p.ambient {
                continue;
            }
            let d = hypot(x - p.x, y - p.y);
            if exact > 0 {
                if d < 0.001 {
                    weights[p.source] += 1.0 / exact as f64;
                }
            } else if p.decay == 0.0 && d < p.radius {
                weights[p.source] += 1.0 / flat as f64;
            }
        }
        return;
    }
    for p in poles {
        if p.ambient {
            continue;
        }
        let t = hypot(x - p.x, y - p.y) / p.radius;
        if t >= 1.0 {
            continue;
        }
        let base = (1.0 - t) * (1.0 - t) * (1.0 + 2.0 * t);
        // pow(x, 1) is exactly x (IEEE and libm both special-case it).
        let influence = if p.decay == 1.0 { base } else { libm::pow(base, p.decay) };
        let value = influence / jmax(1e-12, 1.0 - influence);
        weights[p.source] += value;
        total += value;
    }
    for w in weights.iter_mut() {
        *w /= total;
    }
}

pub fn bounce_axis(position: f64, velocity: f64, seconds: f64, min: f64, max: f64) -> (f64, f64) {
    let length = max - min;
    if length <= 0.0 {
        return (min, velocity);
    }
    let raw = position + velocity * seconds - min;
    let phase = fmod(fmod(raw, 2.0 * length) + 2.0 * length, 2.0 * length);
    (min + if phase <= length { phase } else { 2.0 * length - phase }, velocity * if phase <= length { 1.0 } else { -1.0 })
}

// Keep the line's total advance fixed, but preserve each font's relative glyph widths.
pub fn line_positions(advances: &[f64], target: f64, start: f64) -> Vec<f64> {
    let extra = if advances.len() > 1 {
        let mut sum = 0.0;
        for a in advances {
            sum += a;
        }
        (target - sum) / (advances.len() - 1) as f64
    } else {
        0.0
    };
    let mut x = start;
    advances
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let p = x;
            x += a + if i < advances.len() - 1 { extra } else { 0.0 };
            p
        })
        .collect()
}

pub fn wrap_rows(rows: &[Vec<char>], max_width: f64, advance: &dyn Fn(char) -> f64) -> Vec<Vec<char>> {
    let mut result = Vec::new();
    for input in rows {
        let mut row: Vec<char> = Vec::new();
        let mut width = 0.0;
        for &character in input {
            row.push(character);
            width += advance(character);
            while width > max_width && row.len() > 1 {
                let mut split: isize = -1;
                let mut i = row.len() - 1;
                while i > 0 {
                    if is_js_space(row[i]) {
                        split = i as isize;
                        break;
                    }
                    i -= 1;
                }
                let split = if split < 0 { row.len() - 1 } else { split as usize };
                let mut line: Vec<char> = row[..split].to_vec();
                while line.last().is_some_and(|c| is_js_space(*c)) {
                    line.pop();
                }
                result.push(line);
                row = row[split..].to_vec();
                let lead = row.iter().take_while(|c| is_js_space(**c)).count();
                row.drain(..lead);
                width = 0.0;
                for c in &row {
                    width += advance(*c);
                }
            }
        }
        result.push(row);
    }
    result
}

#[derive(Clone, Copy, Debug)]
pub struct InkBounds {
    pub left: f64,
    pub right: f64,
    pub top: f64,
    pub bottom: f64,
}

pub trait PassageMetrics {
    fn reference(&self, c: char) -> f64;
    fn advance(&self, c: char) -> f64;
    fn ink(&self, c: char) -> Option<InkBounds>;
}

#[derive(Clone, Debug)]
pub struct Row {
    pub chars: Vec<char>,
    pub advances: Vec<f64>,
    pub xs: Vec<f64>,
    pub baseline: f64,
}

#[derive(Clone, Debug)]
pub struct Passage {
    pub width: f64,
    pub height: f64,
    pub rows: Vec<Row>,
}

pub fn passage_layout(text: &str, size: f64, leading: f64, padding: f64, width: f64, wrap: bool, metrics: &dyn PassageMetrics) -> Passage {
    let scale = size / 100.0;
    let cleaned: String = text.chars().filter(|c| *c != '\r').collect();
    let raw: Vec<Vec<char>> = cleaned.split('\n').map(|r| r.chars().collect()).collect();
    let mut left_overhang = 0.0f64;
    let mut right_overhang = 0.0f64;
    let mut seen = std::collections::BTreeSet::new();
    for row in &raw {
        for &c in row {
            if !seen.insert(c) {
                continue;
            }
            if let Some(b) = metrics.ink(c) {
                left_overhang = jmax(left_overhang, -b.left);
                right_overhang = jmax(right_overhang, b.right - metrics.advance(c));
            }
        }
    }
    let rows = if wrap {
        wrap_rows(&raw, jmax(1.0, (width - 2.0 * padding) / scale - left_overhang - right_overhang), &|c| metrics.reference(c))
    } else {
        raw
    };
    let (mut left, mut right, mut top, mut bottom) = (0.0f64, 0.0f64, f64::INFINITY, f64::NEG_INFINITY);
    let positioned: Vec<Row> = rows
        .into_iter()
        .enumerate()
        .map(|(row, chars)| {
            let mut target = 0.0;
            for c in &chars {
                target += metrics.reference(*c);
            }
            let target = target * scale;
            let advances: Vec<f64> = chars.iter().map(|c| metrics.advance(*c) * scale).collect();
            let xs = line_positions(&advances, target, 0.0);
            let baseline = row as f64 * size * leading;
            right = jmax(right, target);
            for (i, c) in chars.iter().enumerate() {
                if let Some(ink) = metrics.ink(*c) {
                    left = jmin(left, xs[i] + ink.left * scale);
                    right = jmax(right, xs[i] + ink.right * scale);
                    top = jmin(top, baseline + ink.top * scale);
                    bottom = jmax(bottom, baseline + ink.bottom * scale);
                }
            }
            Row { chars, advances, xs, baseline }
        })
        .collect();
    if !top.is_finite() {
        top = 0.0;
        bottom = 0.0;
    }
    Passage {
        width: right - left + 2.0 * padding,
        height: bottom - top + 2.0 * padding,
        rows: positioned
            .into_iter()
            .map(|r| Row { xs: r.xs.iter().map(|x| x - left + padding).collect(), baseline: r.baseline - top + padding, chars: r.chars, advances: r.advances })
            .collect(),
    }
}

pub fn fit_passage(text: &str, leading: f64, padding: f64, width: f64, height: f64, wrap: bool, metrics: &dyn PassageMetrics, max_size: f64) -> f64 {
    let mut low = 1.0;
    let mut high = max_size;
    for _ in 0..20 {
        let mid = (low + high) / 2.0;
        let layout = passage_layout(text, mid, leading, padding, width, wrap, metrics);
        if layout.width <= width && layout.height <= height {
            low = mid;
        } else {
            high = mid;
        }
    }
    (low * 10.0).floor() / 10.0
}
