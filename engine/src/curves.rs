//! Port of curves.ts: contour correspondence across masters (groupContours,
//! alignContours and their landmark helpers) and limitBlendedHandle.

use crate::geom::*;

fn correspondence_warp(reference: &Measured, target: &Measured, phase: f64, structured: bool) -> Vec<[f64; 2]> {
    let n = 96usize;
    let stride = n + 1;
    let a: Vec<Point> = (0..stride).map(|i| sample(reference, i as f64 / n as f64)).collect();
    let b: Vec<Point> = (0..stride).map(|i| sample(target, i as f64 / n as f64 + phase)).collect();
    let mut bounds = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
    for p in &a {
        bounds = [jmin(bounds[0], p[0]), jmin(bounds[1], p[1]), jmax(bounds[2], p[0]), jmax(bounds[3], p[1])];
    }
    let scale = (bounds[2] - bounds[0]) * (bounds[2] - bounds[0]) + (bounds[3] - bounds[1]) * (bounds[3] - bounds[1]);
    let tangent = |m: &Measured, t: f64| -> Point {
        let p = sample(m, t - 1.0 / 384.0);
        let q = sample(m, t + 1.0 / 384.0);
        let d = hypot(q[0] - p[0], q[1] - p[1]);
        let d = if d == 0.0 || d.is_nan() { 1.0 } else { d };
        [(q[0] - p[0]) / d, (q[1] - p[1]) / d]
    };
    let ta: Vec<Point> = (0..stride).map(|i| tangent(reference, i as f64 / n as f64)).collect();
    let tb: Vec<Point> = (0..stride).map(|i| tangent(target, i as f64 / n as f64 + phase)).collect();
    let cost = |i: usize, j: usize| -> f64 {
        let dx = a[i][0] - b[j][0];
        let dy = a[i][1] - b[j][1];
        dx * dx + dy * dy + if structured { scale * 0.065 * (1.0 - ta[i][0] * tb[j][0] - ta[i][1] * tb[j][1]) } else { 0.0 }
    };
    let mut dp = vec![f64::INFINITY; stride * stride];
    dp[0] = cost(0, 0);
    let mut step = vec![0u8; dp.len()];
    for i in 1..=n {
        for j in 1..=n {
            let k = i * stride + j;
            let c = cost(i, j);
            let mut best = dp[(i - 1) * stride + j - 1] + c;
            let mut chosen = 1u8;
            if j >= 2 {
                let v = dp[(i - 1) * stride + j - 2] + c + cost(i, j - 1);
                if v < best {
                    best = v;
                    chosen = 2;
                }
            }
            if i >= 2 {
                let v = dp[(i - 2) * stride + j - 1] + c + cost(i - 1, j);
                if v < best {
                    best = v;
                    chosen = 3;
                }
            }
            dp[k] = best;
            step[k] = chosen;
        }
    }
    let mut knots: Vec<[f64; 2]> = Vec::new();
    let (mut i, mut j) = (n, n);
    while i > 0 && j > 0 {
        knots.push([i as f64 / n as f64, j as f64 / n as f64]);
        let s = step[i * stride + j];
        i -= if s == 3 { 2 } else { 1 };
        j -= if s == 2 { 2 } else { 1 };
    }
    knots.push([0.0, 0.0]);
    knots.reverse();
    knots
}

fn warp_at(knots: &[[f64; 2]], value: f64, inverse: bool) -> f64 {
    let (a, b) = if inverse { (1, 0) } else { (0, 1) };
    if value <= 0.0 {
        return 0.0;
    }
    if value >= 1.0 {
        return 1.0;
    }
    let mut i = 1;
    while i < knots.len() - 1 && knots[i][a] < value {
        i += 1;
    }
    let start = knots[i - 1];
    let end = knots[i];
    start[b] + (end[b] - start[b]) * (value - start[a]) / (end[a] - start[a])
}

fn js_sign(v: f64) -> f64 {
    if v > 0.0 {
        1.0
    } else if v < 0.0 {
        -1.0
    } else {
        v
    }
}

fn turn_score(sign: f64, p: Point, prev: Point, next: Point) -> f64 {
    let u = [p[0] - prev[0], p[1] - prev[1]];
    let v = [next[0] - p[0], next[1] - p[1]];
    -sign * libm::atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
}

fn circular_mean(ts: impl Iterator<Item = f64>) -> f64 {
    let mut x = 0.0;
    let mut y = 0.0;
    let ts: Vec<f64> = ts.collect();
    for &t in &ts {
        x += libm::cos(t * 2.0 * PI);
    }
    for &t in &ts {
        y += libm::sin(t * 2.0 * PI);
    }
    (libm::atan2(y, x) / (2.0 * PI) + 1.0) % 1.0
}

struct ArcPoint {
    p: Point,
    t: f64,
    u: f64,
}

// Match both sides of the fork: aligning only its inner valley can invert the
// thin stroke between that valley and the outer branch.
fn y_landmarks(m: &Measured) -> Option<Vec<f64>> {
    let count = 768usize;
    let points: Vec<Point> = (0..count).map(|i| sample(m, i as f64 / count as f64)).collect();
    let left = min_of(points.iter().map(|p| p[0]));
    let right = max_of(points.iter().map(|p| p[0]));
    let top = min_of(points.iter().map(|p| p[1]));
    let bottom = max_of(points.iter().map(|p| p[1]));
    let height = bottom - top;
    let cap = |side: f64| -> f64 {
        let mid = (left + right) / 2.0;
        let candidates: Vec<(Point, usize)> = points
            .iter()
            .enumerate()
            .filter(|(_, p)| if side < 0.0 { p[0] < mid } else { p[0] > mid })
            .map(|(i, p)| (*p, i))
            .collect();
        let y = min_of(candidates.iter().map(|(p, _)| p[1]));
        let near: Vec<usize> = candidates.iter().filter(|(p, _)| p[1] < y + height * 0.005).map(|(_, i)| *i).collect();
        let mut x = 0.0;
        for &i in &near {
            x += libm::cos(i as f64 / count as f64 * 2.0 * PI);
        }
        let mut v = 0.0;
        for &i in &near {
            v += libm::sin(i as f64 / count as f64 * 2.0 * PI);
        }
        (libm::atan2(v, x) / (2.0 * PI) + 1.0) % 1.0
    };
    let a = cap(-1.0);
    let b = cap(1.0);
    let dist = (b - a + 1.0) % 1.0;
    let arc: Vec<ArcPoint> = points
        .iter()
        .enumerate()
        .map(|(i, p)| ArcPoint { p: *p, t: i as f64 / count as f64, u: (i as f64 / count as f64 - a + 1.0) % 1.0 })
        .collect();
    let first: Vec<&ArcPoint> = arc.iter().filter(|p| p.u < dist).collect();
    let second: Vec<&ArcPoint> = arc.iter().filter(|p| p.u >= dist).collect();
    if first.is_empty() || second.is_empty() {
        return None;
    }
    let maxp = |v: &Vec<&ArcPoint>| -> usize {
        let mut best = 0;
        for (i, p) in v.iter().enumerate() {
            if p.p[1] > v[best].p[1] {
                best = i;
            }
        }
        best
    };
    let first_is_inner = first[maxp(&first)].p[1] < second[maxp(&second)].p[1];
    let (inner, outer) = if first_is_inner { (&first, &second) } else { (&second, &first) };
    let fork = inner[maxp(inner)];
    let tail = outer[maxp(outer)];
    let sign = js_sign(area(&m.contour));
    let mut junction: Option<&ArcPoint> = None;
    let mut best = 0.0;
    for point in outer.iter() {
        if point.p[1] < top + height * 0.25 || point.p[1] > top + height * 0.72 {
            continue;
        }
        let prev = sample(m, point.t - 0.025);
        let next = sample(m, point.t + 0.025);
        let score = turn_score(sign, point.p, prev, next);
        if score > best {
            best = score;
            junction = Some(point);
        }
    }
    let junction = junction?;
    if best < 0.4 {
        return None;
    }
    // Refine the broad concavity to an actual curve junction, ignoring edge grain.
    let mut join = junction.t;
    let mut turn = 0.0;
    for &offset in &m.starts {
        let t = offset / m.total;
        if (t - junction.t).abs() > 0.03 {
            continue;
        }
        let p = sample(m, t);
        let prev = sample(m, t - 0.001);
        let next = sample(m, t + 0.001);
        let score = turn_score(sign, p, prev, next);
        if score > turn {
            turn = score;
            join = t;
        }
    }
    let branch_span = (a - join + 1.0) % 1.0;
    let tail_on_branch = (tail.t - join + 1.0) % 1.0 < branch_span;
    let branch: Vec<&&ArcPoint> = outer.iter().filter(|p| ((p.t - join + 1.0) % 1.0 < branch_span) != tail_on_branch).collect();
    if branch.is_empty() {
        return None;
    }
    let mut beneath = branch[0];
    for p in branch.iter() {
        if hypot(p.p[0] - fork.p[0], p.p[1] - fork.p[1]) < hypot(beneath.p[0] - fork.p[0], beneath.p[1] - fork.p[1]) {
            beneath = p;
        }
    }
    Some(vec![a, b, fork.t, join, tail.t, beneath.t])
}

// A crossbar must meet the same four stem junctions in every master. Nearest
// outline matching alone can map a low crossbar onto a long vertical stem.
fn crossbar_landmarks(m: &Measured, character: &str) -> Option<Vec<f64>> {
    let count = 1536usize;
    let points: Vec<Point> = (0..count).map(|i| sample(m, i as f64 / count as f64)).collect();
    let top = min_of(points.iter().map(|p| p[1]));
    let bottom = max_of(points.iter().map(|p| p[1]));
    let height = bottom - top;
    let row = |y: f64| -> Vec<f64> {
        let mut xs = Vec::new();
        for i in 0..count {
            let p = points[i];
            let q = points[(i + 1) % count];
            if (p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y) {
                xs.push(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
            }
        }
        sort_numbers(&mut xs);
        xs
    };
    struct Row {
        y: f64,
        width: f64,
    }
    let rows: Vec<Row> = (0..160)
        .map(|i| {
            let y = top + height * (0.22 + 0.58 * i as f64 / 159.0);
            let xs = row(y);
            Row { y, width: if xs.is_empty() { 0.0 } else { xs[xs.len() - 1] - xs[0] } }
        })
        .collect();
    let mut widest = 0;
    for i in 1..rows.len() {
        // reduce((a,b)=>a.width>b.width?a:b): ties move to the later row.
        widest = if rows[widest].width > rows[i].width { widest } else { i };
    }
    let widest = &rows[widest];
    let near: Vec<&Row> = rows.iter().filter(|r| r.width > widest.width * 0.9 && (r.y - widest.y).abs() < height * 0.1).collect();
    let mut bar = 0.0;
    for r in &near {
        bar += r.y;
    }
    let bar = bar / near.len() as f64;
    let stem = row(jmin(bottom - height * 0.16, bar + height * 0.18));
    if stem.len() != 2 {
        return None;
    }
    let left = stem[0];
    let right = stem[1];
    let width = right - left;
    let middle = (left + right) / 2.0;
    let sign = js_sign(area(&m.contour));
    if widest.width < width * 1.8 {
        return None;
    }
    let turn = |t: f64, span: f64| -> f64 {
        let p = sample(m, t);
        let a = sample(m, t - span);
        let b = sample(m, t + span);
        turn_score(sign, p, a, b)
    };
    let mut joins: Vec<f64> = Vec::new();
    for side in [-1.0, 1.0] {
        for vertical in [-1.0, 1.0] {
            let mut best = 0.0;
            let mut t = -1.0;
            for (i, p) in points.iter().enumerate() {
                if (p[0] - middle) * side <= 0.0 || (p[1] - bar) * vertical <= 0.0 || (p[1] - bar).abs() > height * 0.13 {
                    continue;
                }
                let score = turn(i as f64 / count as f64, 0.012)
                    / (1.0 + (p[0] - if side < 0.0 { left } else { right }).abs() / width + (p[1] - bar).abs() / (height * 0.1));
                if score > best {
                    best = score;
                    t = i as f64 / count as f64;
                }
            }
            if t < 0.0 || best < 0.35 {
                return None;
            }
            // Snap a broad turn to its nearby true curve corner when one exists.
            let mut snapped = t;
            let mut sharp = 0.5;
            for &start in &m.starts {
                let v = start / m.total;
                if (v - t).abs() > 0.012 {
                    continue;
                }
                let score = turn(v, 0.001) / (1.0 + (v - t).abs() * 100.0);
                if score > sharp {
                    sharp = score;
                    snapped = v;
                }
            }
            joins.push(snapped);
        }
    }
    let extreme_on_arc = |a: f64, b: f64, axis: usize, sign: f64| -> f64 {
        let span = (b - a + 1.0) % 1.0;
        let swap = span > 0.5;
        let start = if swap { b } else { a };
        let length = if swap { 1.0 - span } else { span };
        let arc: Vec<ArcPoint> = points
            .iter()
            .enumerate()
            .map(|(i, p)| ArcPoint { p: *p, t: i as f64 / count as f64, u: (i as f64 / count as f64 - start + 1.0) % 1.0 })
            .filter(|p| p.u < length)
            .collect();
        let max = max_of(arc.iter().map(|p| p.p[axis] * sign));
        let near: Vec<&ArcPoint> = arc.iter().filter(|p| max - p.p[axis] * sign < height * 0.001).collect();
        let mut sum = 0.0;
        for p in &near {
            sum += p.u;
        }
        (start + sum / near.len() as f64) % 1.0
    };
    let caps = [extreme_on_arc(joins[0], joins[1], 0, -1.0), extreme_on_arc(joins[2], joins[3], 0, 1.0)];
    let extreme = |axis: usize, sign: f64, filter: &dyn Fn(Point) -> bool| -> f64 {
        let eligible: Vec<(Point, f64)> =
            points.iter().enumerate().filter(|(_, p)| filter(**p)).map(|(i, p)| (*p, i as f64 / count as f64)).collect();
        let max = max_of(eligible.iter().map(|(p, _)| p[axis] * sign));
        circular_mean(eligible.iter().filter(|(p, _)| max - p[axis] * sign < height * 0.001).map(|(_, t)| *t))
    };
    let mut out = joins.clone();
    out.extend_from_slice(&caps);
    out.push(extreme(1, -1.0, &|_| true));
    out.push(extreme(1, 1.0, &|_| true));
    if character == "f" {
        out.push(extreme(0, 1.0, &|p: Point| p[1] < bar - height * 0.15));
    }
    Some(out)
}

pub fn align_contours(contours: &[Contour], structured: bool, counter: bool, character: &str) -> Vec<Contour> {
    let Some(ref_index) = contours.iter().position(|c| area(c).abs() > 1e-10) else {
        return contours.to_vec();
    };
    let ref_area = area(&contours[ref_index]);
    let oriented: Vec<Contour> = contours.iter().map(|c| if area(c) * ref_area < 0.0 { reverse(c) } else { c.clone() }).collect();
    let measured: Vec<Option<Measured>> = oriented.iter().map(|c| if area(c).abs() > 1e-10 { Some(measure(c)) } else { None }).collect();
    let reference = measure(&contours[ref_index]);
    let extreme = |m: &Measured, axis: usize, sign: f64| -> f64 {
        let count = 768usize;
        let values: Vec<f64> = (0..count).map(|i| sample(m, i as f64 / count as f64)[axis] * sign).collect();
        let max = max_of(values.iter().copied());
        let mut x = 0.0;
        let mut y = 0.0;
        for (i, &v) in values.iter().enumerate() {
            if max - v < 0.002 {
                x += libm::cos(i as f64 / count as f64 * PI * 2.0);
                y += libm::sin(i as f64 / count as f64 * PI * 2.0);
            }
        }
        wrap1(libm::atan2(y, x) / (PI * 2.0))
    };
    let reference_samples: Vec<Point> = (0..48).map(|i| sample(&reference, i as f64 / 48.0)).collect();
    let mut phases: Vec<f64> = measured
        .iter()
        .enumerate()
        .map(|(index, m)| {
            let Some(m) = m else { return 0.0 };
            if structured && counter {
                return extreme(m, 1, -1.0);
            }
            if index == ref_index {
                return 0.0;
            }
            let mut phase = 0.0;
            let mut best = f64::INFINITY;
            let target_samples: Vec<Point> = (0..96).map(|i| sample(m, i as f64 / 96.0)).collect();
            let shifts: Vec<f64> = (0..96).map(|i| i as f64 / 96.0).chain(m.starts.iter().map(|v| v / m.total)).collect();
            for shift in shifts {
                let mut cost = 0.0;
                for i in 0..48 {
                    let p = reference_samples[i];
                    let grid = js_round(shift * 96.0);
                    let q = if (grid - shift * 96.0).abs() < 1e-10 {
                        target_samples[(i * 2 + grid as usize) % 96]
                    } else {
                        sample(m, i as f64 / 48.0 + shift)
                    };
                    let dx = p[0] - q[0];
                    let dy = p[1] - q[1];
                    cost += dx * dx + dy * dy;
                }
                if cost < best {
                    best = cost;
                    phase = shift;
                }
            }
            phase
        })
        .collect();
    let mut warps: Vec<Vec<[f64; 2]>> = measured.iter().map(|_| vec![[0.0, 0.0], [1.0, 1.0]]).collect();
    let all = measured.iter().all(|m| m.is_some());
    let landmark_counter = structured && counter && all;
    if !landmark_counter {
        for (i, m) in measured.iter().enumerate() {
            if let Some(m) = m {
                if i != ref_index {
                    warps[i] = correspondence_warp(&reference, m, phases[i], structured);
                }
            }
        }
    }
    if landmark_counter {
        let directions: [(usize, f64); 3] = if ref_area > 0.0 { [(0, 1.0), (1, 1.0), (0, -1.0)] } else { [(0, -1.0), (1, 1.0), (0, 1.0)] };
        // Counter top/right/bottom/left are shared landmarks, not nearest pixels.
        for (i, m) in measured.iter().enumerate() {
            let m = m.as_ref().unwrap();
            let mut w = vec![[0.0, 0.0]];
            for (j, (axis, sign)) in directions.iter().enumerate() {
                w.push([(j + 1) as f64 / 4.0, wrap1(extreme(m, *axis, *sign) - phases[i])]);
            }
            w.push([1.0, 1.0]);
            warps[i] = w;
        }
        if warps.iter().any(|w| w.iter().enumerate().any(|(i, p)| i > 0 && p[1] <= w[i - 1][1])) {
            for (i, m) in measured.iter().enumerate() {
                warps[i] = match m {
                    Some(m) => correspondence_warp(&reference, m, phases[i], structured),
                    None => vec![[0.0, 0.0], [1.0, 1.0]],
                };
            }
        }
    }
    if structured && !counter && (character == "y" || character == "f" || character == "t") && all {
        let landmarks: Vec<Option<Vec<f64>>> = measured
            .iter()
            .map(|m| {
                let m = m.as_ref().unwrap();
                if character == "y" {
                    y_landmarks(m)
                } else {
                    crossbar_landmarks(m, character)
                }
            })
            .collect();
        if landmarks.iter().all(|l| l.is_some()) {
            let landmarks: Vec<Vec<f64>> = landmarks.into_iter().map(|l| l.unwrap()).collect();
            let l0 = &landmarks[0];
            let mut order: Vec<(usize, f64)> = l0.iter().enumerate().map(|(id, t)| (id, (t - l0[0] + 1.0) % 1.0)).collect();
            order.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(core::cmp::Ordering::Equal));
            let positions: Vec<Vec<f64>> = landmarks.iter().map(|ls| order.iter().map(|(id, _)| (ls[*id] - ls[0] + 1.0) % 1.0).collect()).collect();
            if positions.iter().all(|p| p.iter().enumerate().all(|(i, v)| i == 0 || *v > p[i - 1] + 0.001)) {
                for (i, ls) in landmarks.iter().enumerate() {
                    phases[i] = ls[0];
                    let mut w: Vec<[f64; 2]> = positions[i].iter().enumerate().map(|(j, v)| [positions[0][j], *v]).collect();
                    w.push([1.0, 1.0]);
                    warps[i] = w;
                }
            }
        }
    }
    let mut knots: Vec<f64> = vec![0.0, 1.0];
    for w in &warps {
        for p in w {
            knots.push(p[0]);
        }
    }
    for (i, m) in measured.iter().enumerate() {
        if let Some(m) = m {
            for v in &m.starts {
                knots.push(warp_at(&warps[i], wrap1(v / m.total - phases[i]), true));
            }
        }
    }
    sort_numbers(&mut knots);
    let knots: Vec<f64> = knots.iter().enumerate().filter(|(i, v)| *i == 0 || **v - knots[i - 1] > 1e-7).map(|(_, v)| *v).collect();
    measured
        .iter()
        .enumerate()
        .map(|(index, m)| match m {
            None => {
                let p = center(&contours[index]);
                knots[1..].iter().map(|_| [p, p, p, p]).collect()
            }
            Some(m) => knots[1..]
                .iter()
                .enumerate()
                .map(|(i, end)| portion(m, warp_at(&warps[index], knots[i], false) + phases[index], warp_at(&warps[index], *end, false) + phases[index]))
                .collect(),
        })
        .collect()
}

fn assignment(cost: &[Vec<f64>]) -> Vec<usize> {
    let n = cost.len();
    let mut u = vec![0.0f64; n + 1];
    let mut v = vec![0.0f64; n + 1];
    let mut p = vec![0usize; n + 1];
    let mut way = vec![0usize; n + 1];
    for i in 1..=n {
        p[0] = i;
        let mut j0 = 0usize;
        let mut min = vec![f64::INFINITY; n + 1];
        let mut used = vec![false; n + 1];
        loop {
            used[j0] = true;
            let i0 = p[j0];
            let mut delta = f64::INFINITY;
            let mut j1 = 0usize;
            for j in 1..=n {
                if !used[j] {
                    let value = cost[i0 - 1][j - 1] - u[i0] - v[j];
                    if value < min[j] {
                        min[j] = value;
                        way[j] = j0;
                    }
                    if min[j] < delta {
                        delta = min[j];
                        j1 = j;
                    }
                }
            }
            for j in 0..=n {
                if used[j] {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    min[j] -= delta;
                }
            }
            j0 = j1;
            if p[j0] == 0 {
                break;
            }
        }
        loop {
            let j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
            if j0 == 0 {
                break;
            }
        }
    }
    let mut result = vec![usize::MAX; n];
    for j in 1..=n {
        result[p[j] - 1] = j - 1;
    }
    result
}

/// curves.ts groupContours: one aligned contour group per reference contour,
/// each holding one contour per shape with the same segment count.
pub fn group_contours(shapes: &[Vec<Contour>], structured: bool, character: &str) -> Vec<Vec<Contour>> {
    let mut reference = 0;
    for (i, s) in shapes.iter().enumerate() {
        if s.len() > shapes[reference].len() {
            reference = i;
        }
    }
    if shapes.is_empty() {
        return Vec::new();
    }
    let mut refs: Vec<Contour> = shapes[reference].clone();
    refs.sort_by(|a, b| {
        let (x, y) = (area(b).abs(), area(a).abs());
        x.partial_cmp(&y).unwrap_or(core::cmp::Ordering::Equal)
    });
    if refs.is_empty() {
        return Vec::new();
    }
    // Assign all contours together: a lower bowl must not greedily steal the
    // only upper counter from a master that has no lower counter.
    let matches: Vec<Vec<Contour>> = shapes
        .iter()
        .enumerate()
        .map(|(index, shape)| {
            if index == reference {
                return refs.clone();
            }
            let costs: Vec<Vec<f64>> = refs
                .iter()
                .map(|c| {
                    (0..refs.len())
                        .map(|j| {
                            if j >= shape.len() {
                                0.0
                            } else {
                                let ac = area(c);
                                let aj = area(&shape[j]);
                                distance(center(c), center(&shape[j])) + (ac.abs().sqrt() - aj.abs().sqrt()).abs()
                                    + if ac * aj < 0.0 { 10000.0 } else { 0.0 }
                            }
                        })
                        .collect()
                })
                .collect();
            assignment(&costs)
                .iter()
                .enumerate()
                .map(|(i, &j)| if j < shape.len() { shape[j].clone() } else { collapse(&refs[i]) })
                .collect()
        })
        .collect();
    let a0 = area(&refs[0]);
    refs.iter()
        .enumerate()
        .map(|(i, c)| {
            let group: Vec<Contour> = matches.iter().map(|m| m[i].clone()).collect();
            align_contours(&group, structured, area(c) * a0 < 0.0, character)
        })
        .collect()
}

// Direction-only interpolation must not introduce a reversal into a segment
// whose ordinary weighted handles move forward along the chord.
pub fn limit_blended_handle(anchor: Point, end: Point, raw: Point, proposed: Point) -> Point {
    let dx = end[0] - anchor[0];
    let dy = end[1] - anchor[1];
    let length2 = dx * dx + dy * dy;
    let projection = |p: Point| (p[0] - anchor[0]) * dx + (p[1] - anchor[1]) * dy;
    let original = projection(raw);
    let adjusted = projection(proposed);
    if original >= 0.0 && original <= length2 && (adjusted < 0.0 || adjusted > length2) {
        raw
    } else {
        proposed
    }
}
