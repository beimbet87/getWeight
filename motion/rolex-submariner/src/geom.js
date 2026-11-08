// Submariner geometry in watch-local units (bezel radius = 1, canvas axes: y down).
// Every element is a polyline so the same data drives pencil, glow, paper and flat styles.

export const pol = (deg, r) => { const a = deg * Math.PI / 180; return [r * Math.sin(a), -r * Math.cos(a)]; };
export function circle(cx, cy, r, n = 96, a0 = 0) {
  const p = []; for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI * 2; p.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]); } return p;
}
export function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; }
export function roundRect(x0, y0, x1, y1, r, n = 6) {
  const p = [], c = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a] of c) for (let i = 0; i <= n; i++) { const t = (a + i / n * 90) * Math.PI / 180; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  p.push(p[0]); return p;
}
const xf = (pts, f) => pts.map(f);
export const rotPts = (pts, deg, r0 = 0) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
export function plen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }

// ---------- single-stroke font (for pencil handwriting and neon tubes) ----------
const G = {
  A: [.6, 'M0,1 L.3,0 L.6,1 M.1,.66 L.5,.66'],
  B: [.6, 'M0,1 L0,0 L.3,0 A.3,.24,.24,.24,-90,90 L0,.48 M.3,.48 A.32,.74,.26,.26,-90,90 L0,1'],
  C: [.62, 'A.34,.5,.32,.5,-45,-315'],
  D: [.62, 'M0,0 L0,1 L.22,1 A.24,.5,.36,.5,90,-90 L0,0'],
  E: [.52, 'M.52,0 L0,0 L0,1 L.52,1 M0,.5 L.4,.5'],
  F: [.5, 'M.5,0 L0,0 L0,1 M0,.5 L.38,.5'],
  G: [.66, 'A.34,.5,.33,.5,-45,-360 L.4,.5'],
  H: [.6, 'M0,0 L0,1 M.6,0 L.6,1 M0,.5 L.6,.5'],
  I: [.12, 'M.06,0 L.06,1'],
  K: [.56, 'M0,0 L0,1 M.54,0 L0,.6 M.17,.43 L.58,1'],
  L: [.48, 'M0,0 L0,1 L.48,1'],
  M: [.74, 'M0,1 L0,0 L.37,.62 L.74,0 L.74,1'],
  N: [.6, 'M0,1 L0,0 L.6,1 L.6,0'],
  O: [.7, 'A.35,.5,.35,.5,-90,270'],
  P: [.56, 'M0,1 L0,0 L.3,0 A.3,.26,.26,.26,-90,90 L0,.52'],
  R: [.58, 'M0,1 L0,0 L.3,0 A.3,.26,.26,.26,-90,90 L0,.52 M.26,.52 L.58,1'],
  S: [.58, 'A.3,.25,.27,.25,-20,-270 A.3,.75,.29,.25,-90,160'],
  T: [.6, 'M0,0 L.6,0 M.3,0 L.3,1'],
  U: [.6, 'M0,0 L0,.68 A.3,.68,.3,.32,180,0 L.6,0'],
  V: [.6, 'M0,0 L.3,1 L.6,0'],
  W: [.84, 'M0,0 L.21,1 L.42,.3 L.63,1 L.84,0'],
  X: [.6, 'M0,0 L.6,1 M.6,0 L0,1'],
  Y: [.6, 'M0,0 L.3,.5 L.6,0 M.3,.5 L.3,1'],
  0: [.54, 'A.27,.5,.27,.5,-90,270'],
  1: [.36, 'M.06,.2 L.28,0 L.28,1'],
  2: [.56, 'A.28,.27,.26,.25,180,390 L0,1 L.58,1'],
  3: [.56, 'A.28,.25,.25,.24,200,450 A.28,.74,.29,.26,-90,160'],
  4: [.6, 'M.46,1 L.46,0 L0,.7 L.62,.7'],
  5: [.58, 'M.54,0 L.09,0 L.05,.45 A.3,.68,.28,.3,-125,160'],
  6: [.6, 'M.5,.02 L.07,.58 A.32,.68,.3,.32,195,555'],
  7: [.56, 'M0,0 L.58,0 L.2,1'],
  8: [.6, 'A.3,.25,.24,.24,90,450 A.3,.74,.29,.26,-90,270'],
  9: [.58, 'A.29,.32,.28,.32,0,360 L.24,1'],
  '=': [.5, 'M0,.38 L.5,.38 M0,.62 L.5,.62'],
  '·': [.2, 'M.08,.5 L.12,.5'],
  f: [.4, 'M.4,.06 A.28,.18,.12,.14,-20,-180 L.16,1 M0,.42 L.36,.42'],
  t: [.36, 'M.14,.1 L.14,.84 A.29,.84,.15,.16,180,60 M0,.4 L.34,.4'],
  m: [.68, 'M0,1 L0,.44 M0,.58 A.17,.58,.17,.15,180,360 L.34,1 M.34,.58 A.51,.58,.17,.15,180,360 L.68,1'],
  ' ': [.34, ''],
  'Д': [.68, 'M0,1.16 L0,1 L.68,1 L.68,1.16 M.06,1 L.22,0 L.54,0 L.58,1'],
  'Ш': [.72, 'M0,0 L0,1 L.72,1 L.72,0 M.36,0 L.36,1'],
  'Щ': [.8, 'M0,0 L0,1 L.72,1 L.72,0 M.36,0 L.36,1 M.72,1 L.8,1.18'],
  'И': [.6, 'M0,0 L0,1 L.6,0 L.6,1'],
  'Й': [.6, 'M0,0 L0,1 L.6,0 L.6,1 M.16,-.2 A.3,-.2,.14,.1,180,0'],
  'Я': [.58, 'M.58,1 L.58,0 L.28,0 A.28,.26,.27,.26,270,90 L.58,.52 M.32,.52 L0,1'],
  'У': [.6, 'M0,0 L.3,.62 M.6,0 L.18,1'],
  'Л': [.6, 'M0,1 L.22,0 L.6,0 L.6,1'],
  'Б': [.56, 'M.52,0 L0,0 L0,1 L.28,1 A.28,.74,.27,.26,90,-90 L0,.48'],
  'Г': [.5, 'M0,1 L0,0 L.5,0'],
};
const CYR = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X' };

function parseGlyph(src) {
  const out = []; let cur = null;
  const toks = src.match(/[MLA][^MLA]*/g) || [];
  for (const tk of toks) {
    const c = tk[0], v = tk.slice(1).split(',').map(Number);
    if (c === 'M') { cur = [[v[0], v[1]]]; out.push(cur); }
    else if (c === 'L') cur.push([v[0], v[1]]);
    else if (c === 'A') {
      const [cx, cy, rx, ry, a0, a1] = v; const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 10));
      const pts = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      if (!cur) { cur = pts; out.push(cur); } else cur.push(...pts);
    }
  }
  return out;
}
const GC = {};
export function glyph(ch) {
  ch = CYR[ch] || ch;
  if (!GC[ch]) { const g = G[ch] || G[' ']; GC[ch] = { w: g[0], strokes: parseGlyph(g[1]) }; }
  return GC[ch];
}
// Returns polylines for text; size = cap height. align: 0 left, .5 center.
export function strokeText(str, x, y, size, { align = .5, track = .22, slant = 0 } = {}) {
  let wsum = 0; const gs = [...str].map(c => { const g = glyph(c); wsum += (g.w + track); return g; }); wsum -= track;
  let cx = x - wsum * size * align; const out = [];
  for (const g of gs) {
    for (const s of g.strokes) out.push(s.map(([gx, gy]) => [cx + (gx + slant * (1 - gy)) * size, y + (gy - 1) * size]));
    cx += (g.w + track) * size;
  }
  return out;
}

// ---------- watch parts ----------
function caseRightHalf() {
  const R = 1.04, p = [];
  const arc = (a0, a1, n) => { for (let i = 0; i <= n; i++) p.push(pol(a0 + (a1 - a0) * i / n, R)); };
  arc(0, 21.4, 6);
  p.push([0.385, -1.10], [0.40, -1.22], [0.43, -1.26], [0.64, -1.26], [0.675, -1.225], [0.70, -1.06], [0.705, -0.90]);
  arc(42.6, 73, 10);
  for (let i = 0; i <= 16; i++) { const u = i / 16, y = -0.30 + 0.60 * u, b = Math.pow(Math.sin(Math.PI * u), 0.55); p.push([Math.sqrt(R * R - y * y) + 0.095 * b, y]); }
  arc(107, 137.4, 10);
  p.push([0.705, 0.90], [0.70, 1.06], [0.675, 1.225], [0.64, 1.26], [0.43, 1.26], [0.40, 1.22], [0.385, 1.10]);
  arc(158.6, 180, 6);
  return p;
}
export function caseOutline() {
  const r = caseRightHalf(); const l = r.slice(0, -1).reverse().map(([x, y]) => [-x, y]).reverse();
  // r goes top->bottom on right; mirrored left half goes bottom->top.
  const left = r.slice().reverse().map(([x, y]) => [-x, y]);
  return [...r, ...left.slice(1)];
}

export function braceletRows(side) { // side -1 top, +1 bottom
  const rows = []; const pitch = 0.30;
  for (let k = 0; k < 9; k++) {
    const y0 = side * (1.16 + k * pitch), y1 = side * (1.16 + (k + 1) * pitch - 0.018);
    const w = 0.76 - Math.min(k, 6) * 0.018, cw = w * 0.34;
    const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    rows.push({ k, outerL: roundRect(-w / 2, ya, -cw / 2 - 0.006, yb, 0.03), center: roundRect(-cw / 2, ya, cw / 2, yb, 0.02), outerR: roundRect(cw / 2 + 0.006, ya, w / 2, yb, 0.03), ya, yb, w, cw });
  }
  return rows;
}

export function crownPts() { return roundRect(1.125, -0.15, 1.30, 0.15, 0.04); }
export function crownKnurl() { const o = []; for (let i = 1; i < 10; i++) { const y = -0.15 + i * 0.03; o.push([[1.15, y], [1.29, y]]); } return o; }

export function bezelOuter() { const p = []; const n = 360; for (let i = 0; i <= n; i++) { const a = i / n * 360; const tooth = (i % 3 === 0) ? 0.012 : 0; p.push(pol(a, 1.0 - tooth)); } return p; }

// Bezel markings in the bezel frame (rotate by bezelAngle).
export function bezelMarks() {
  const tri = [pol(-4.2, 0.955), pol(4.2, 0.955), pol(0, 0.835), pol(-4.2, 0.955)];
  const pip = circle(...pol(0, 0.915), 0.022, 24);
  const bars = [], ticks = [];
  for (let m = 5; m < 60; m += 10) { const a = m * 6, w = 1.25; bars.push([pol(a - w, 0.84), pol(a + w, 0.84), pol(a + w, 0.95), pol(a - w, 0.95), pol(a - w, 0.84)]); }
  for (let m = 1; m < 15; m++) { if (m === 5 || m === 10) continue; ticks.push([pol(m * 6, 0.905), pol(m * 6, 0.952)]); }
  const nums = [];
  for (let n = 10; n <= 50; n += 10) nums.push({ n: String(n), a: n * 6 });
  return { tri, pip, bars, ticks, nums };
}
export function bezelNumeralStrokes() {
  const out = [];
  for (const { n, a } of bezelMarks().nums) {
    const s = strokeText(n, 0, 0, 0.085, { track: .18 });
    for (const st of s) out.push(rotPts(st.map(([x, y]) => [x, y + 0.0425 - 0.889]), a));
  }
  return out;
}

export const HOUR_R = 0.625;
export function dialMarkers() {
  const m = [];
  for (let h = 1; h <= 12; h++) {
    const a = h * 30;
    if (h === 3) continue;
    if (h === 12) { m.push({ h, pts: [pol(-7.6, 0.745), pol(7.6, 0.745), pol(0, 0.55), pol(-7.6, 0.745)] }); continue; }
    if (h === 6 || h === 9) {
      const w = 3.9; m.push({ h, pts: rotPts(rect(-0.046, -0.735, 0.046, -0.515), a) }); continue;
    }
    const [cx, cy] = pol(a, HOUR_R + 0.01); m.push({ h, pts: circle(cx, cy, 0.068, 40) });
  }
  return m;
}
export const DATE_WIN = rect(0.545, -0.078, 0.735, 0.078);
export function minuteTrack() {
  const o = [];
  for (let i = 0; i < 60; i++) { const big = i % 5 === 0; o.push([pol(i * 6, big ? 0.748 : 0.758), pol(i * 6, 0.785)]); }
  return o;
}

// Rolex-style five-point crown, unit width centered at (0,0) bottom baseline, y up negative.
export function crownLogo() {
  const band = roundRect(-0.36, -0.17, 0.36, -0.02, 0.03, 4);
  const base = [-0.27, -0.135, 0, 0.135, 0.27];
  const tips = [[-0.47, -0.60], [-0.245, -0.73], [0, -0.79], [0.245, -0.73], [0.47, -0.60]];
  const tines = base.map((bx, i) => {
    const [tx, ty] = tips[i]; const dx = tx - bx, dy = ty + 0.16, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const w0 = 0.055, w1 = 0.028;
    return [[bx - nx * w0, -0.16 - ny * w0], [tx - nx * w1, ty - ny * w1], [tx + nx * w1, ty + ny * w1], [bx + nx * w0, -0.16 + ny * w0], [bx - nx * w0, -0.16 - ny * w0]];
  });
  const balls = tips.map(([x, y]) => ({ x, y: y - 0.035, r: 0.068 }));
  return { band, tines, balls, tips };
}

// Hands, pointing to 12 (negative y). Each returns {metal:[polys], lume:[polys]}.
export function hourHand() {
  const metal = [], lume = [];
  const ring = 0.078, cy = -0.27;
  metal.push([[-0.024, 0.07], [-0.024, cy + ring * 0.75], [0.024, cy + ring * 0.75], [0.024, 0.07], [-0.024, 0.07]]);
  metal.push(circle(0, cy, ring, 48));
  metal.push([[-0.034, cy - ring * 0.82], [0, -0.43], [0.034, cy - ring * 0.82], [-0.034, cy - ring * 0.82]]);
  // Mercedes lume sectors
  const r = 0.058;
  for (const [a0, a1] of [[-60, 60], [60, 180], [180, 300]]) {
    const p = [[0, cy]]; const g = 9;
    for (let i = 0; i <= 12; i++) { const a = (a0 + g + (a1 - a0 - 2 * g) * i / 12 + 180) * Math.PI / 180; p.push([r * Math.sin(a), cy - r * Math.cos(a)]); }
    p.push([0, cy]);
    // offset sector away from center so spokes are visible
    const mid = ((a0 + a1) / 2 + 180) * Math.PI / 180, o = 0.008;
    lume.push(p.map(([x, y]) => [x + o * Math.sin(mid), y - o * Math.cos(mid)]));
  }
  lume.push([[-0.016, cy - ring * 0.9], [0, -0.405], [0.016, cy - ring * 0.9], [-0.016, cy - ring * 0.9]]);
  return { metal, lume };
}
export function minuteHand() {
  return {
    metal: [[[-0.026, 0.08], [-0.03, -0.12], [-0.034, -0.24], [0, -0.705], [0.034, -0.24], [0.03, -0.12], [0.026, 0.08], [-0.026, 0.08]]],
    lume: [[[-0.017, -0.13], [-0.021, -0.25], [0, -0.64], [0.021, -0.25], [0.017, -0.13], [-0.017, -0.13]]],
  };
}
export function secondsHand() {
  return {
    metal: [rect(-0.0065, 0.19, 0.0065, -0.735), circle(0, -0.5, 0.034, 32), circle(0, 0.15, 0.03, 24)],
    lume: [circle(0, -0.5, 0.022, 28)],
  };
}
export function handAngles(wt) { // returns degrees for hour/min/sec
  const s = wt % 60, m = (wt / 60) % 60, h = (wt / 3600) % 12;
  return { h: h * 30, m: m * 6, s: s * 6 };
}

// Dial text lines (for real-font rendering) and their stroke versions.
export const DIAL_TEXT = [
  { s: 'ROLEX', y: -0.305, size: 0.072, font: 'Cinzel', weight: 700, track: 0.06 },
  { s: 'OYSTER PERPETUAL DATE', y: -0.232, size: 0.032, font: 'Manrope', weight: 700, track: 0.05 },
  { s: 'SUBMARINER', y: 0.315, size: 0.044, font: 'Manrope', weight: 700, track: 0.08 },
  { s: '1000ft = 300m', y: 0.375, size: 0.032, font: 'Manrope', weight: 600, track: 0.04 },
];
export function dialTextStrokes() {
  const o = [];
  o.push(...strokeText('ROLEX', 0, -0.305, 0.058, { track: .3 }));
  o.push(...strokeText('OYSTER PERPETUAL DATE', 0, -0.236, 0.026, { track: .32 }));
  o.push(...strokeText('SUBMARINER', 0, 0.315, 0.04, { track: .34 }));
  o.push(...strokeText('1000ft = 300m', 0, 0.375, 0.03, { track: .3 }));
  return o;
}
export function crownLogoOnDial(scale = 0.15, cy = -0.385) {
  const c = crownLogo();
  const T = ([x, y]) => [x * scale, cy + y * scale];
  return { band: c.band.map(T), tines: c.tines.map(p => p.map(T)), balls: c.balls.map(b => ({ x: b.x * scale, y: cy + b.y * scale, r: b.r * scale })) };
}
