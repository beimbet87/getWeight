// 2D styles: pencil sketch, cut paper, glowing contour, flat 2D. All share geom.js.
import { W, H, clamp, lerp, seg, smooth, eOut, eIn, eInOut, eOutBack, rng, noise1, watchTime, bezelAngle } from './common.js';
import * as g from './geom.js';

// ---------------- camera ----------------
export function applyCam(ctx, cam) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cam.x, cam.y); ctx.rotate(cam.r * Math.PI / 180); ctx.scale(cam.s, cam.s);
}
export function toScreen(cam, [x, y]) {
  const a = cam.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [cam.x + (x * c - y * s) * cam.s, cam.y + (x * s + y * c) * cam.s];
}
function polyPath(ctx, pts, close = true) {
  ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (close) ctx.closePath();
}
function rotated(ctx, deg, fn) { ctx.save(); ctx.rotate(deg * Math.PI / 180); fn(); ctx.restore(); }

// ---------------- textures ----------------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let GRAIN = null;
export function grain() {
  if (GRAIN) return GRAIN;
  const c = mkCanvas(512, 512), x = c.getContext('2d'), id = x.createImageData(512, 512), r = rng(7);
  for (let i = 0; i < 512 * 512; i++) { const v = 128 + (r() - .5) * 46; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  x.putImageData(id, 0, 0);
  x.globalAlpha = .18; x.lineWidth = .8;
  for (let i = 0; i < 900; i++) { // fibres
    const px = r() * 512, py = r() * 512, a = r() * Math.PI, l = 4 + r() * 16;
    x.strokeStyle = r() < .5 ? '#fff' : '#000'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  GRAIN = c; return c;
}
const TINT = {};
export function paperPattern(ctx, color) {
  if (!TINT[color]) {
    const c = mkCanvas(512, 512), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, 512, 512);
    x.globalCompositeOperation = 'soft-light'; x.globalAlpha = .55; x.drawImage(grain(), 0, 0);
    TINT[color] = c;
  }
  return ctx.createPattern(TINT[color], 'repeat');
}

// ---------------- stroke list for pencil + glow ----------------
let STROKES = null;
function resample(pts, step = 0.008) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}
function cumLen(p) { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; }

export function strokes() {
  if (STROKES) return STROKES;
  const L = [];
  const add = (pts, grp, o = {}) => L.push({ pts, grp, rot: o.rot || null, w: o.w ?? 1, light: o.light || 0, col: o.col || 'steel', closed: o.closed ?? false });
  // construction
  add([[-1.6, 0], [1.6, 0]], 'con', { light: 1, w: .7 });
  add([[0, -1.55], [0, 1.55]], 'con', { light: 1, w: .7 });
  add(g.circle(0, 0, 1.04, 120, 0.3), 'con', { light: 1, w: .7 });
  add(g.circle(0, 0, 0.8, 100, -0.4), 'con', { light: 1, w: .7 });
  // case, crown, bracelet
  add(g.caseOutline(), 'case', { w: 1.3, closed: true });
  add(g.crownPts(), 'crown', { w: 1.1 });
  for (const k of g.crownKnurl()) add(k, 'crown', { w: .6 });
  for (const side of [-1, 1]) for (const r of g.braceletRows(side).slice(0, 7)) { add(r.outerL, 'brace', { w: .9 }); add(r.center, 'brace', { w: .9 }); add(r.outerR, 'brace', { w: .9 }); }
  // bezel
  add(g.bezelOuter(), 'bezel', { w: 1.2, rot: 'bezel' });
  add(g.circle(0, 0, 0.965, 120), 'bezel', { w: .8, rot: 'bezel' });
  add(g.circle(0, 0, 0.815, 110), 'bezel', { w: .8, rot: 'bezel' });
  const bm = g.bezelMarks();
  add(bm.tri, 'bmark', { rot: 'bezel', col: 'lume' }); add(bm.pip, 'bmark', { rot: 'bezel', w: .8, col: 'lume' });
  for (const b of bm.bars) add(b, 'bmark', { rot: 'bezel', w: .8, col: 'plat' });
  for (const t of bm.ticks) add(t, 'bmark', { rot: 'bezel', w: .7, col: 'plat' });
  for (const s of g.bezelNumeralStrokes()) add(s, 'bmark', { rot: 'bezel', w: .9, col: 'plat' });
  // dial
  add(g.circle(0, 0, 0.795, 100, 0.2), 'dial', { w: 1 });
  for (const t of g.minuteTrack()) add(t, 'track', { w: .55, col: 'white' });
  for (const m of g.dialMarkers()) add(m.pts, 'marker', { w: 1, col: 'lume' });
  add(g.DATE_WIN, 'date', { w: .9, col: 'white' });
  for (const s of g.strokeText('8', 0.64, 0.045, 0.09)) add(s, 'date', { w: 1, col: 'white' });
  const cl = g.crownLogoOnDial();
  add(cl.band, 'logo', { w: .7, col: 'gold' }); for (const t of cl.tines) add(t, 'logo', { w: .7, col: 'gold' }); for (const b of cl.balls) add(g.circle(b.x, b.y, b.r, 16), 'logo', { w: .7, col: 'gold' });
  for (const s of g.dialTextStrokes()) add(s, 'text', { w: .7, col: 'white' });
  // crystal + cyclops
  add(g.roundRect(0.5, -0.125, 0.79, 0.125, 0.11, 6), 'crystal', { w: .7, col: 'glass' });
  // hands
  const hh = g.hourHand(), mh = g.minuteHand(), sh = g.secondsHand();
  for (const p of hh.metal) add(p, 'hand', { rot: 'h', w: 1, col: 'white' }); for (const p of hh.lume) add(p, 'hand', { rot: 'h', w: .6, col: 'lume' });
  for (const p of mh.metal) add(p, 'hand', { rot: 'm', w: 1, col: 'white' }); for (const p of mh.lume) add(p, 'hand', { rot: 'm', w: .6, col: 'lume' });
  for (const p of sh.metal) add(p, 'hand', { rot: 's', w: .8, col: 'white' }); for (const p of sh.lume) add(p, 'hand', { rot: 's', w: .6, col: 'lume' });
  add(g.circle(0, 0, 0.035, 20), 'hand', { w: .8, col: 'white' });

  // sketchy versions
  const R = rng(42);
  for (const s of L) {
    const base = resample(s.pts, 0.01);
    s.len = cumLen(base)[base.length - 1];
    const seeds = [R() * 100, R() * 100];
    const amp = s.grp === 'con' ? 0.004 : 0.0028;
    s.passes = seeds.map((sd, k) => {
      const p = base.map(([x, y], i) => {
        const u = i / 8; return [x + noise1(u, sd) * amp, y + noise1(u, sd + 9) * amp];
      });
      if (!s.closed && p.length > 1 && s.grp !== 'text' && s.grp !== 'bmark') { // overshoot straight ends
        const [a, b] = [p[0], p[1]], [c, d] = [p[p.length - 1], p[p.length - 2]];
        const e = 0.012 * (k + 1);
        const la = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, lc = Math.hypot(c[0] - d[0], c[1] - d[1]) || 1;
        p.unshift([a[0] + (a[0] - b[0]) / la * e, a[1] + (a[1] - b[1]) / la * e]);
        p.push([c[0] + (c[0] - d[0]) / lc * e, c[1] + (c[1] - d[1]) / lc * e]);
      }
      return { p, c: cumLen(p) };
    });
  }
  STROKES = L; return L;
}

// Hatching regions (local coords), each list of segments.
let HATCH = null;
function hatchLines(spacing, angle, r, filter, seed) {
  const out = [], R = rng(seed), a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  for (let d = -r; d <= r; d += spacing) {
    const j = (R() - .5) * spacing * .5;
    const h = Math.sqrt(Math.max(0, r * r - d * d));
    const p0 = [(d + j) * ca - (-h) * sa, (d + j) * sa + (-h) * ca], p1 = [(d + j) * ca - h * sa, (d + j) * sa + h * ca];
    if (filter(p0, p1)) out.push([p0, p1]);
  }
  return out;
}
export function hatches() {
  if (HATCH) return HATCH;
  HATCH = {
    dial: hatchLines(0.017, 40, 0.8, () => true, 3),
    dial2: hatchLines(0.024, -50, 0.8, () => true, 4),
    bezel: hatchLines(0.02, 35, 0.97, () => true, 5),
    caseL: hatchLines(0.016, 60, 1.35, (a, b) => (a[0] + b[0]) / 2 < -0.15, 6),
  };
  return HATCH;
}
function dialClip(ctx) {
  ctx.beginPath(); polyPath(ctx, g.circle(0, 0, 0.792, 100));
  for (const m of g.dialMarkers()) polyPath(ctx, m.pts);
  polyPath(ctx, g.DATE_WIN);
  polyPath(ctx, g.rect(-0.3, -0.47, 0.3, -0.205)); polyPath(ctx, g.rect(-0.26, 0.26, 0.26, 0.39));
  ctx.clip('evenodd');
}

// ---------------- pencil ----------------
let SCHED = null;
export function pencilSchedule() {
  if (SCHED) return SCHED;
  const L = strokes(), H2 = hatches(); const items = [];
  const order = ['con', 'case', 'crown', 'brace', 'bezel', 'bmark', 'dial', 'track', 'marker', 'date', 'logo', 'text', 'crystal', 'hand'];
  for (const grp of order) for (const s of L) if (s.grp === grp) items.push({ kind: 's', s, dur: 0.018 + s.len / (grp === 'con' ? 9 : 4.2) });
  for (const [name, alpha] of [['dial', .55], ['bezel', .4], ['caseL', .3], ['dial2', .35]]) {
    for (const seg2 of H2[name]) items.push({ kind: 'h', name, seg: seg2, alpha, dur: 0.004 + Math.hypot(seg2[1][0] - seg2[0][0], seg2[1][1] - seg2[0][1]) / 30 });
  }
  const t0 = 1.55, t1 = 8.3; let sum = items.reduce((a, b) => a + b.dur, 0); const k = (t1 - t0) / sum; let t = t0;
  for (const it of items) { it.t0 = t; t += it.dur * k; it.t1 = t; }
  // title written first
  const title = g.strokeText('КАРАНДАШ', 0, 0, 1, { align: 0, track: .28, slant: .12 });
  let tt = 0.25; const tl = title.map(p => { const pp = resample(p, 0.02); const c = cumLen(pp); return { p: pp, c, len: c[c.length - 1] }; });
  const tsum = tl.reduce((a, b) => a + b.len + .25, 0);
  for (const s of tl) { s.t0 = tt; tt += (s.len + .25) / tsum * 1.2; s.t1 = tt - .02; }
  SCHED = { items, title: tl }; return SCHED;
}
function drawPartial(ctx, pass, frac) {
  const { p, c } = pass, L = c[c.length - 1] * frac; if (L <= 0) return null;
  ctx.moveTo(p[0][0], p[0][1]); let i = 1;
  for (; i < p.length && c[i] <= L; i++) ctx.lineTo(p[i][0], p[i][1]);
  if (i < p.length) { const u = (L - c[i - 1]) / (c[i] - c[i - 1]); const x = lerp(p[i - 1][0], p[i][0], u), y = lerp(p[i - 1][1], p[i][1], u); ctx.lineTo(x, y); return [x, y]; }
  return p[p.length - 1];
}
function rotFor(s, t, frozen) {
  if (!s.rot) return 0;
  if (s.rot === 'bezel') return bezelAngle(t);
  const a = g.handAngles(watchTime(frozen ?? t)); return a[s.rot];
}
const rotP = ([x, y], deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

// Pencil watch drawing. Returns tip position in screen coords (or null).
export function drawPencilWatch(ctx, t, cam, { fade = 1 } = {}) {
  const { items } = pencilSchedule(), H2 = hatches();
  applyCam(ctx, cam);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let tip = null;
  const px = 1 / cam.s;
  // hatching first (underneath outlines)
  for (const name of ['caseL', 'bezel', 'dial', 'dial2']) {
    const list = items.filter(i => i.kind === 'h' && i.name === name); if (!list.length || t < list[0].t0) continue;
    ctx.save();
    if (name === 'dial' || name === 'dial2') dialClip(ctx);
    else if (name === 'bezel') { ctx.beginPath(); polyPath(ctx, g.circle(0, 0, 0.965, 120)); polyPath(ctx, g.circle(0, 0, 0.815, 110)); ctx.clip('evenodd'); }
    else { ctx.beginPath(); polyPath(ctx, g.caseOutline()); polyPath(ctx, g.circle(0, 0, 1.0, 120)); ctx.clip('evenodd'); }
    ctx.strokeStyle = `rgba(40,40,46,${list[0].alpha * fade})`; ctx.lineWidth = 1.1 * px; ctx.beginPath();
    for (const it of list) {
      if (t < it.t0) break; const f = clamp((t - it.t0) / (it.t1 - it.t0));
      const [a, b] = it.seg; const e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]);
      if (f < 1) tip = e;
    }
    ctx.stroke(); ctx.restore();
  }
  for (const it of items) {
    if (it.kind !== 's' || t < it.t0) continue;
    const s = it.s, f = clamp((t - it.t0) / (it.t1 - it.t0));
    const rot = rotFor(s, Math.max(t, 10), 10);
    ctx.save(); if (rot) ctx.rotate(rot * Math.PI / 180);
    const dark = s.light ? 0.22 : 0.78;
    s.passes.forEach((ps, k) => {
      ctx.strokeStyle = `rgba(34,34,40,${(k ? dark * .5 : dark) * fade})`;
      ctx.lineWidth = (k ? 1.0 : 1.7) * s.w * px * (s.light ? .8 : 1);
      ctx.beginPath(); const e = drawPartial(ctx, ps, f); ctx.stroke();
      if (k === 0 && f < 1 && e) tip = rotP(e, rot);
    });
    ctx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return tip ? toScreen(cam, tip) : null;
}
export function drawPencilTitle(ctx, t, x, y, size, alpha = 1) {
  const { title } = pencilSchedule(); let tip = null;
  ctx.setTransform(size, 0, 0, size, x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = `rgba(30,30,36,${(k ? .45 : .9) * alpha})`; ctx.lineWidth = (k ? 2.2 : 4.2) / size;
    ctx.beginPath();
    for (const s of title) {
      if (t < s.t0) break; const f = clamp((t - s.t0) / (s.t1 - s.t0));
      const pass = k ? { p: s.p.map(([a, b]) => [a + .012, b + .01]), c: s.c } : s; const e = drawPartial(ctx, pass, f);
      if (f < 1 && e && !k) tip = [x + e[0] * size, y + e[1] * size];
    }
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return tip;
}
export function drawPencilSprite(ctx, tip, lift = 0, blur = 1.2) {
  if (!tip) return;
  const [x, y] = tip, a = -0.62;
  ctx.save();
  // shadow on paper
  ctx.translate(x + 26 + lift * 60, y + 30 + lift * 40); ctx.rotate(a); ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(30,25,20,.22)'; ctx.fillRect(40, -18, 900, 34); ctx.restore();
  ctx.save(); ctx.translate(x, y - lift * 18); ctx.rotate(a); ctx.filter = `blur(${blur}px)`;
  // graphite + wood cone
  ctx.fillStyle = '#d9b48a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(78, -17); ctx.lineTo(78, 17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b48c62'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(78, 6); ctx.lineTo(78, 17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -4.8); ctx.lineTo(22, 4.8); ctx.closePath(); ctx.fill();
  // body: matte black hexagonal
  const gr = ctx.createLinearGradient(0, -17, 0, 17); gr.addColorStop(0, '#3b3d42'); gr.addColorStop(.35, '#1b1c1f'); gr.addColorStop(.36, '#121315'); gr.addColorStop(.7, '#1c1d20'); gr.addColorStop(.71, '#26272b'); gr.addColorStop(1, '#0d0d0f');
  ctx.fillStyle = gr; ctx.fillRect(78, -17, 1000, 34);
  // ferrule-like gold band
  const gg = ctx.createLinearGradient(0, -17, 0, 17); gg.addColorStop(0, '#f3dc9a'); gg.addColorStop(.5, '#b58a3a'); gg.addColorStop(1, '#6e521f');
  ctx.fillStyle = gg; ctx.fillRect(560, -17, 14, 34);
  ctx.restore();
}

// ---------------- flat 2D layers (also textures for 2.5D) ----------------
export const FLAT = {
  steel: '#c9ced3', steelD: '#a3aab1', steelL: '#eceff1', braceO: '#b3b9bf', braceC: '#dfe3e6',
  insert: '#121417', plat: '#d6d8db', dial: '#0e0f11', lume: '#f3f0e6', rim: '#c4c8cc', text: '#f2f2f0', gold: '#d8b25a',
};
function fillPoly(ctx, pts, col) { ctx.fillStyle = col; ctx.beginPath(); polyPath(ctx, pts); ctx.fill(); }
function textAt(ctx, s, x, y, size, font, weight, track, col, align = 'center') {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.font = `${weight} 100px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${track / size * 100}px`;
  ctx.fillStyle = col; ctx.fillText(s, track / size * 50, 0); ctx.restore();
}
export function flatLayer(ctx, layer, t, o = {}) {
  const F = FLAT;
  if (layer === 'bracelet') {
    for (const side of [-1, 1]) for (const r of g.braceletRows(side)) {
      fillPoly(ctx, r.outerL, F.braceO); fillPoly(ctx, r.outerR, F.braceO); fillPoly(ctx, r.center, F.braceC);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-r.cw / 2 + 0.01, r.ya + 0.02, 0.02, r.yb - r.ya - 0.04);
    }
  } else if (layer === 'case') {
    fillPoly(ctx, g.crownPts(), F.steelD);
    ctx.strokeStyle = F.steel; ctx.lineWidth = 0.012; for (const k of g.crownKnurl()) { ctx.beginPath(); polyPath(ctx, k, false); ctx.stroke(); }
    fillPoly(ctx, g.caseOutline(), F.steel);
    ctx.save(); ctx.beginPath(); polyPath(ctx, g.caseOutline()); ctx.clip();
    ctx.fillStyle = F.steelL; ctx.beginPath(); ctx.ellipse(-0.35, -0.5, 0.9, 1.1, -0.5, 0, Math.PI * 2); ctx.ellipse(-0.25, -0.38, 0.9, 1.1, -0.5, 0, Math.PI * 2); ctx.fill('evenodd');
    ctx.fillStyle = F.steelD; ctx.beginPath(); ctx.ellipse(0.3, 0.42, 1.0, 1.2, -0.5, 0, Math.PI * 2); ctx.ellipse(0.18, 0.3, 1.0, 1.2, -0.5, 0, Math.PI * 2); ctx.fill('evenodd');
    ctx.restore();
  } else if (layer === 'bezel') {
    const ba = o.bezel ?? bezelAngle(t);
    rotated(ctx, ba, () => {
      ctx.fillStyle = F.steelD; ctx.beginPath(); polyPath(ctx, g.bezelOuter()); polyPath(ctx, g.circle(0, 0, 0.8, 120)); ctx.fill('evenodd');
      ctx.fillStyle = F.insert; ctx.beginPath(); polyPath(ctx, g.circle(0, 0, 0.965, 120)); polyPath(ctx, g.circle(0, 0, 0.815, 120)); ctx.fill('evenodd');
      const bm = g.bezelMarks();
      for (const b of bm.bars) fillPoly(ctx, b, F.plat);
      ctx.strokeStyle = F.plat; ctx.lineWidth = 0.011; for (const tk of bm.ticks) { ctx.beginPath(); polyPath(ctx, tk, false); ctx.stroke(); }
      fillPoly(ctx, bm.tri, F.plat); fillPoly(ctx, bm.pip, F.lume);
      for (const { n, a } of bm.nums) rotated(ctx, a, () => textAt(ctx, n, 0, -0.886, 0.108, 'Manrope', 700, 0.004, F.plat));
    });
  } else if (layer === 'dial') {
    fillPoly(ctx, g.circle(0, 0, 0.8, 120), F.dial);
    ctx.strokeStyle = F.text; for (const [i, tk] of g.minuteTrack().entries()) { ctx.lineWidth = i % 5 ? 0.006 : 0.012; ctx.beginPath(); polyPath(ctx, tk, false); ctx.stroke(); }
    fillPoly(ctx, g.DATE_WIN, '#f7f7f4');
    textAt(ctx, '8', 0.64, 0.004, 0.13, 'Manrope', 700, 0, '#111');
    for (const l of g.DIAL_TEXT) textAt(ctx, l.s, 0, l.y, l.size * 1.25, l.font, l.weight, l.track * .4, F.text);
    const cl = g.crownLogoOnDial(); ctx.fillStyle = F.gold;
    ctx.beginPath(); polyPath(ctx, cl.band); for (const tn of cl.tines) polyPath(ctx, tn); ctx.fill();
    ctx.beginPath(); for (const b of cl.balls) { ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); } ctx.fill();
  } else if (layer === 'markers') {
    for (const m of g.dialMarkers()) {
      ctx.save(); ctx.strokeStyle = F.rim; ctx.lineWidth = 0.018; ctx.beginPath(); polyPath(ctx, m.pts); ctx.stroke(); ctx.restore();
      fillPoly(ctx, m.pts, F.lume);
    }
  } else if (layer === 'hour' || layer === 'min' || layer === 'sec') {
    const hd = layer === 'hour' ? g.hourHand() : layer === 'min' ? g.minuteHand() : g.secondsHand();
    const ang = o.angle ?? g.handAngles(watchTime(t))[{ hour: 'h', min: 'm', sec: 's' }[layer]];
    rotated(ctx, ang, () => {
      ctx.fillStyle = '#d7dbde'; ctx.beginPath(); for (const p of hd.metal) polyPath(ctx, p); ctx.fill('nonzero');
      ctx.fillStyle = F.lume; ctx.beginPath(); for (const p of hd.lume) polyPath(ctx, p); ctx.fill();
      if (layer === 'sec') fillPoly(ctx, g.circle(0, 0, 0.034, 24), '#d7dbde');
    });
  } else if (layer === 'crystal') {
    ctx.fillStyle = 'rgba(210,235,255,.10)'; ctx.beginPath(); polyPath(ctx, g.roundRect(0.5, -0.125, 0.79, 0.125, 0.11)); ctx.fill();
    ctx.save(); ctx.beginPath(); polyPath(ctx, g.roundRect(0.5, -0.125, 0.79, 0.125, 0.11)); ctx.clip();
    fillPoly(ctx, g.rect(0.53, -0.105, 0.76, 0.105), '#fbfbf8'); textAt(ctx, '8', 0.645, 0.006, 0.2, 'Manrope', 700, 0, '#111');
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.moveTo(-0.6, -0.55); ctx.lineTo(-0.2, -0.78); ctx.lineTo(0.5, 0.05); ctx.lineTo(0.2, 0.3); ctx.closePath(); ctx.fill();
  }
}
export const FLAT_ORDER = ['bracelet', 'case', 'bezel', 'dial', 'markers', 'crystal', 'hour', 'min', 'sec'];
export function drawFlatWatch(ctx, t, cam, o = {}) {
  applyCam(ctx, cam);
  for (const l of FLAT_ORDER) flatLayer(ctx, l, t, o);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------- cut paper ----------------
const PAPER = { brace: '#aeb3b8', braceC: '#cfd3d6', case: '#c4c8cb', crown: '#b2b6ba', bezel: '#9ba0a5', insert: '#1d1e21', plat: '#dddcd6', dial: '#17181a', lume: '#f4f0e3', hand: '#e9e8e1' };
// Pieces with landing times (s).
export const PAPER_PIECES = [
  { id: 'brace', land: 10.25, h: .35 }, { id: 'case', land: 10.75, h: .5 }, { id: 'bezel', land: 11.25, h: .55 },
  { id: 'insert', land: 11.5, h: .6 }, { id: 'bmarks', land: 11.75, h: .62 }, { id: 'dial', land: 12.0, h: .45 },
  { id: 'markers', land: 12.25, h: .5 }, { id: 'text', land: 12.5, h: .48 }, { id: 'hour', land: 12.875, h: .7 },
  { id: 'min', land: 13.125, h: .75 }, { id: 'sec', land: 13.375, h: .8 }, { id: 'pin', land: 13.5, h: .85 }, { id: 'cello', land: 13.75, h: 1 },
];
function jitterPoly(pts, amp, seed) { const R = rng(seed); return pts.map(([x, y], i) => [x + (noise1(i * .35, seed) * amp), y + (noise1(i * .35, seed + 5) * amp)]); }
let PJ = null;
function paperGeo() {
  if (PJ) return PJ;
  const J = (p, s) => jitterPoly(g.circle ? p : p, 0.004, s);
  PJ = {
    caseO: J(g.caseOutline(), 1), crown: J(g.crownPts(), 2), bezelO: J(g.bezelOuter().filter((_, i) => i % 2 === 0), 3), insO: J(g.circle(0, 0, 0.965, 120), 4), insI: J(g.circle(0, 0, 0.815, 120), 5),
    dial: J(g.circle(0, 0, 0.79, 120), 6), markers: g.dialMarkers().map((m, i) => J(m.pts, 10 + i)),
  };
  return PJ;
}
function piecePose(t, land, idx) {
  // Stop-motion: pose quantised to 12 fps.
  const tq = Math.floor(t * 12) / 12;
  const fall = seg(tq, land - 0.5, land);
  const R = rng(100 + idx); const dir = R() * Math.PI * 2;
  const h = (1 - eIn(fall));
  const after = tq - land;
  const squash = after >= 0 ? Math.exp(-after * 14) * Math.cos(after * 40) * 0.07 : 0;
  return { vis: tq >= land - 0.5, h, dx: Math.cos(dir) * h * 1.4, dy: Math.sin(dir) * h * 0.9 - h * 0.6, rot: (R() - .5) * 50 * h + (after >= 0 ? Math.sin(after * 30) * Math.exp(-after * 10) * 2 : 0), sc: 1 + h * 0.5, squash };
}
export function drawPaperWatch(ctx, t, cam, light = { x: -1, y: -1.4 }) {
  const P = paperGeo();
  const shadowFor = (h) => { ctx.shadowColor = `rgba(10,15,25,${0.42 - h * 0.15})`; ctx.shadowBlur = (5 + h * 40) * cam.s / 360; ctx.shadowOffsetX = -light.x * (4 + h * 50) * cam.s / 360; ctx.shadowOffsetY = -light.y * (4 + h * 50) * cam.s / 360; };
  PAPER_PIECES.forEach((pc, idx) => {
    const ps = piecePose(t, pc.land, idx); if (!ps.vis) return;
    applyCam(ctx, cam);
    ctx.translate(ps.dx, ps.dy); ctx.rotate(ps.rot * Math.PI / 180); ctx.scale(ps.sc * (1 + ps.squash), ps.sc * (1 - ps.squash));
    shadowFor(Math.min(1, ps.h + 0.05 + pc.h * .15));
    const pat = c => { const p = paperPattern(ctx, c); p.setTransform(new DOMMatrix().scale(1 / 420)); return p; };
    const edge = (pts, col = 'rgba(255,255,255,.35)') => { ctx.shadowColor = 'transparent'; ctx.strokeStyle = col; ctx.lineWidth = 1.2 / cam.s; ctx.beginPath(); polyPath(ctx, pts); ctx.stroke(); };
    const ba = bezelAngle(t);
    switch (pc.id) {
      case 'brace':
        for (const side of [-1, 1]) for (const r of g.braceletRows(side)) {
          ctx.fillStyle = pat(PAPER.brace); ctx.beginPath(); polyPath(ctx, r.outerL); polyPath(ctx, r.outerR); ctx.fill();
          ctx.fillStyle = pat(PAPER.braceC); ctx.beginPath(); polyPath(ctx, r.center); ctx.fill();
        }
        break;
      case 'case':
        ctx.fillStyle = pat(PAPER.crown); ctx.beginPath(); polyPath(ctx, P.crown); ctx.fill();
        ctx.fillStyle = pat(PAPER.case); ctx.beginPath(); polyPath(ctx, P.caseO); ctx.fill(); edge(P.caseO);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1 / cam.s; for (const k of g.crownKnurl()) { ctx.beginPath(); polyPath(ctx, k, false); ctx.stroke(); }
        break;
      case 'bezel':
        ctx.fillStyle = pat(PAPER.bezel); ctx.rotate(ba * Math.PI / 180); ctx.beginPath(); polyPath(ctx, P.bezelO); polyPath(ctx, g.circle(0, 0, 0.8, 100)); ctx.fill('evenodd'); edge(P.bezelO);
        break;
      case 'insert':
        ctx.rotate(ba * Math.PI / 180); ctx.fillStyle = pat(PAPER.insert); ctx.beginPath(); polyPath(ctx, P.insO); polyPath(ctx, P.insI); ctx.fill('evenodd'); edge(P.insO, 'rgba(255,255,255,.12)');
        break;
      case 'bmarks': {
        ctx.rotate(ba * Math.PI / 180); ctx.fillStyle = pat(PAPER.plat); const bm = g.bezelMarks();
        ctx.beginPath(); for (const b of bm.bars) polyPath(ctx, b); polyPath(ctx, bm.tri); ctx.fill();
        for (const tk of bm.ticks) { ctx.save(); ctx.lineWidth = 0.012; ctx.strokeStyle = PAPER.plat; ctx.beginPath(); polyPath(ctx, tk, false); ctx.stroke(); ctx.restore(); }
        for (const { n, a } of bm.nums) rotated(ctx, a, () => textAt(ctx, n, 0, -0.886, 0.108, 'Manrope', 800, 0.004, PAPER.plat));
        break;
      }
      case 'dial':
        ctx.fillStyle = pat(PAPER.dial); ctx.beginPath(); polyPath(ctx, P.dial); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.fillStyle = pat('#f7f5ee'); ctx.beginPath(); polyPath(ctx, g.DATE_WIN); ctx.fill(); textAt(ctx, '8', 0.64, 0.004, 0.13, 'Manrope', 800, 0, '#222');
        break;
      case 'markers':
        ctx.fillStyle = pat(PAPER.lume); ctx.beginPath(); for (const m of P.markers) polyPath(ctx, m); ctx.fill();
        break;
      case 'text': {
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1.5;
        for (const l of g.DIAL_TEXT) textAt(ctx, l.s, 0, l.y, l.size * 1.25, l.font, l.weight + 100, l.track * .4, '#f4f2ea');
        const cl = g.crownLogoOnDial(); ctx.fillStyle = pat('#d9b45e');
        ctx.beginPath(); polyPath(ctx, cl.band); for (const tn of cl.tines) polyPath(ctx, tn); for (const b of cl.balls) { ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, 7); } ctx.fill();
        break;
      }
      case 'hour': case 'min': case 'sec': {
        const hd = pc.id === 'hour' ? g.hourHand() : pc.id === 'min' ? g.minuteHand() : g.secondsHand();
        const ang = g.handAngles(watchTime(t))[{ hour: 'h', min: 'm', sec: 's' }[pc.id]];
        ctx.rotate(ang * Math.PI / 180);
        ctx.fillStyle = pat(PAPER.hand); ctx.beginPath(); for (const p of hd.metal) polyPath(ctx, p); ctx.fill('nonzero');
        ctx.shadowColor = 'transparent'; ctx.fillStyle = pat('#fbf8ee'); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1 / cam.s;
        ctx.beginPath(); for (const p of hd.lume) polyPath(ctx, p); ctx.fill(); ctx.stroke();
        break;
      }
      case 'pin': {
        const gr = ctx.createRadialGradient(-0.012, -0.014, 0.002, 0, 0, 0.045); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(.4, '#d8ab4b'); gr.addColorStop(1, '#6c4c16');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 0.042, 0, 7); ctx.fill(); break;
      }
      case 'cello': {
        ctx.shadowColor = 'rgba(0,10,30,.18)';
        ctx.fillStyle = 'rgba(225,240,255,.10)'; ctx.beginPath(); ctx.arc(0, 0, 0.8, 0, 7); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save(); ctx.beginPath(); polyPath(ctx, g.roundRect(0.5, -0.125, 0.79, 0.125, 0.11)); ctx.clip();
        ctx.fillStyle = pat('#f7f5ee'); ctx.fillRect(0.53, -0.11, 0.23, 0.22); textAt(ctx, '8', 0.645, 0.006, 0.2, 'Manrope', 800, 0, '#222'); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4 / cam.s; ctx.beginPath(); polyPath(ctx, g.roundRect(0.5, -0.125, 0.79, 0.125, 0.11)); ctx.stroke();
        // crinkled cellophane highlights
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2 / cam.s; ctx.beginPath(); ctx.arc(0, 0, 0.76, -2.6, -1.7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(-0.62, -0.5); ctx.lineTo(-0.3, -0.72); ctx.lineTo(0.42, 0.1); ctx.lineTo(0.12, 0.33); ctx.closePath(); ctx.fill();
        break;
      }
    }
    ctx.shadowColor = 'transparent';
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------- glowing contour ----------------
const GLOW_COL = { steel: [150, 220, 255], lume: [90, 200, 255], plat: [200, 235, 255], white: [235, 248, 255], gold: [255, 205, 120], glass: [160, 230, 255] };
let GC = null;
export function drawGlowWatch(ctx, t, cam, { ignite = 1, power = 1 } = {}) {
  // ctx: an offscreen canvas context (cleared by caller). ignite 0..1 traces the strokes.
  const L = strokes();
  applyCam(ctx, cam); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const px = 1 / cam.s;
  L.forEach((s, i) => {
    if (s.grp === 'con') return;
    const c = GLOW_COL[s.col] || GLOW_COL.steel;
    const order = i / L.length; const f = clamp((ignite - order * 0.6) / 0.4);
    if (f <= 0) return;
    const rot = rotFor(s, t);
    ctx.save(); if (rot) ctx.rotate(rot * Math.PI / 180);
    const ps = s.passes[0];
    // lume fill glow
    if (s.col === 'lume' && f >= 1 && s.closed !== false) { ctx.fillStyle = `rgba(${c},${0.22 * power})`; ctx.beginPath(); polyPath(ctx, s.pts); ctx.fill(); }
    if (s.col === 'lume' && s.grp === 'marker') { ctx.fillStyle = `rgba(${c},${0.35 * power * f})`; ctx.beginPath(); polyPath(ctx, s.pts); ctx.fill(); }
    ctx.strokeStyle = `rgba(${c},${power})`; ctx.lineWidth = 2.2 * s.w * px;
    ctx.beginPath(); drawPartial(ctx, { p: s.pts, c: s._c || (s._c = cumLen(s.pts)) }, f); ctx.stroke();
    // travelling comet
    const len = s._c[s._c.length - 1];
    if (len > 0.3) {
      const ph = ((t * 0.45 + i * 0.137) % 1);
      const a = ph * len, b = a + Math.min(0.25, len * .2);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * power})`; ctx.lineWidth = 3.4 * s.w * px;
      ctx.beginPath(); subPath(ctx, s.pts, s._c, a, b); ctx.stroke();
    }
    ctx.restore();
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function subPath(ctx, p, c, a, b) {
  let started = false;
  for (let i = 1; i < p.length; i++) {
    if (c[i] < a) continue; if (c[i - 1] > b) break;
    const u0 = clamp((a - c[i - 1]) / (c[i] - c[i - 1])), u1 = clamp((b - c[i - 1]) / (c[i] - c[i - 1]));
    const x0 = lerp(p[i - 1][0], p[i][0], u0), y0 = lerp(p[i - 1][1], p[i][1], u0), x1 = lerp(p[i - 1][0], p[i][0], u1), y1 = lerp(p[i - 1][1], p[i][1], u1);
    if (!started) { ctx.moveTo(x0, y0); started = true; } ctx.lineTo(x1, y1);
  }
}
