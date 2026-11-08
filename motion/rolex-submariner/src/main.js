import { W, H, FPS, DUR, S, STAGES, clamp, lerp, seg, smooth, smoother, eIn, eOut, eInOut, eOutExpo, eOutBack, spring, rng, noise1, track, watchTime, bezelAngle } from './common.js';
import * as g from './geom.js';
import * as w2 from './watch2d.js';
import { Watch3D } from './watch3d.js';

const out = document.getElementById('c'); out.width = W; out.height = H;
const octx = out.getContext('2d');
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const frameC = mk(), fctx = frameC.getContext('2d');
const glowC = mk(), gctx = glowC.getContext('2d');
const halfC = mk(W / 2, H / 2), hctx = halfC.getContext('2d');
const tmpC = mk(), tctx = tmpC.getContext('2d');
let w3 = null;

// ---------------- camera tracks ----------------
const cam2d = track([
  { t: 0, x: 1215, y: 565, s: 296, r: -7 }, { t: 5, x: 1185, y: 548, s: 328, r: -3 }, { t: 9.6, x: 1150, y: 540, s: 350, r: 0 },
  { t: 12, x: 1130, y: 548, s: 328, r: 3 }, { t: 15, x: 1150, y: 532, s: 346, r: -1 }, { t: 17.6, x: 1170, y: 540, s: 366, r: -4 },
  { t: 20, x: 1165, y: 540, s: 350, r: -8 }, { t: 23, x: 1130, y: 546, s: 382, r: 2 }, { t: 25.8, x: 1150, y: 540, s: 360, r: 0 },
  { t: 29, x: 1158, y: 538, s: 346, r: 1.5 }, { t: 32, x: 1150, y: 540, s: 340, r: 0 }, { t: 33, x: 1150, y: 540, s: 338, r: 0 },
]);
const L = Math.log;
const cam3d = track([
  { t: 31.5, az: 0, el: 0, lp: L(341), offX: 190, ty: 0, roll: 0 },
  { t: 32, az: 0, el: 0, lp: L(340), offX: 190, ty: 0, roll: 0 },
  { t: 33.8, az: 18, el: 12, lp: L(328), offX: 150, ty: 0, roll: -2 },
  { t: 35.7, az: 34, el: 24, lp: L(300), offX: 95, ty: 0, roll: -4 },
  { t: 37.6, az: 22, el: 14, lp: L(318), offX: 62, ty: 0, roll: -1 },
  { t: 38.1, az: 17, el: 12, lp: L(330), offX: 55, ty: 0, roll: 0 },
  { t: 40.2, az: -26, el: 20, lp: L(334), offX: 30, ty: 0, roll: 2 },
  { t: 42.7, az: -12, el: 34, lp: L(450), offX: 0, ty: 0.28, roll: 1 },
  { t: 45.0, az: 40, el: 18, lp: L(300), offX: 0, ty: 0, roll: 0 },
  { t: 46.7, az: 64, el: 20, lp: L(212), offX: 0, ty: 0, roll: 0 },
  { t: 49.5, az: 70, el: 15, lp: L(204), offX: 0, ty: 0, roll: 0 },
  { t: 51.8, az: 58, el: 24, lp: L(214), offX: 0, ty: 0, roll: 0 },
  { t: 53.6, az: 48, el: 20, lp: L(240), offX: 0, ty: 0, roll: 0 },
  { t: 55.3, az: 28, el: 13, lp: L(292), offX: 0, ty: 0, roll: 0 },
  { t: 56.7, az: 3, el: 2, lp: L(345), offX: 0, ty: 0.02, roll: 0 },
  { t: 57.2, az: 0, el: 0, lp: L(380), offX: 0, ty: 0.06, roll: 0 },
  { t: 58.0, az: 0, el: 0, lp: L(3400), offX: 0, ty: 0.452, roll: 0 },
]);
function cam3At(t) {
  const c = cam3d(Math.min(t, 58));
  // the push-in uses its own ease so the dive accelerates into the logo
  if (t > 57.2) {
    const u = eIn(seg(t, 57.2, 58.0));
    c.lp = lerp(L(380), L(3400), u); c.ty = lerp(0.06, 0.452, Math.pow(u, 0.6));
  }
  return { az: c.az, el: c.el, dist: Watch3D.distFor(Math.exp(c.lp)), offX: c.offX, ty: c.ty, tz: t > 57 ? 0.14 * seg(t, 57.2, 58) : 0, roll: c.roll, p: Math.exp(c.lp) };
}

// ---------------- explode timing (shared with audio) ----------------
const DIS = { crystal: 46.5, bezel: 47.0, sec: 47.5, min: 47.62, hour: 47.74, dial: 48.0, crown: 48.5, movement: 49.0, caseback: 49.5, braceTop: 50.0, braceBot: 50.0 };
const ASM = { braceTop: 52.5, braceBot: 52.5, caseback: 53.0, movement: 53.5, crown: 54.0, dial: 54.5, hour: 55.0, min: 55.12, sec: 55.24, bezel: 55.5, crystal: 56.0 };
function explodeState(t) {
  const e = {};
  for (const k in DIS) {
    let v = 0;
    if (t >= DIS[k] - 0.12) { const u = (t - DIS[k]); v = u < 0 ? -0.04 * Math.sin(-u / 0.12 * Math.PI) : eOut(seg(u, 0, 0.75)) * (1 + 0.04 * Math.sin(clamp(u / 0.75) * Math.PI)); }
    if (t >= ASM[k] - 0.5) { const u = seg(t, ASM[k] - 0.5, ASM[k]); v = 1 - eIn(u); if (t > ASM[k]) { const a = t - ASM[k]; v = -0.03 * Math.exp(-a * 12) * Math.sin(a * 40); } }
    e[k] = v;
  }
  return e;
}
export const soundEvents = () => ({ DIS, ASM, paper: w2.PAPER_PIECES.map(p => p.land) });

// ---------------- sprites / particles ----------------
const bubbleSprites = {};
function bubbleSprite(blur, tint) {
  const key = blur + tint; if (bubbleSprites[key]) return bubbleSprites[key];
  const c = mk(128, 128), x = c.getContext('2d'); x.filter = `blur(${blur}px)`;
  x.strokeStyle = `rgba(${tint},.75)`; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.stroke();
  x.fillStyle = `rgba(${tint},.12)`; x.fill();
  x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(50, 48, 10, 6, -0.7, 0, 7); x.fill();
  bubbleSprites[key] = c; return c;
}
const BUB = (() => { const R = rng(11), a = []; for (let i = 0; i < 90; i++) a.push({ x: R() * 1.3 - .15, z: 0.35 + R() * 2.6, sp: 0.05 + R() * .08, ph: R(), sz: 6 + R() * 16, wb: R() * 6 }); return a; })();
function drawBubbles(c, t, { near, tint = '200,235,255', alpha = 1, parX = 0, parY = 0, speed = 1, rise = 1 }) {
  for (const b of BUB) {
    if (near !== (b.z < 1)) continue;
    const y = H * 1.15 - (((t * b.sp * speed * rise + b.ph) % 1.0) * H * 1.35);
    const x = b.x * W + Math.sin(t * 1.3 + b.wb) * 12 / b.z + parX / b.z;
    const r = b.sz / b.z, blur = Math.round(clamp(Math.abs(1 / b.z - 1) * 6, 0, 10));
    const lv = [0, 2, 4, 7, 10].reduce((a, v) => Math.abs(v - blur) < Math.abs(a - blur) ? v : a, 0);
    c.globalAlpha = alpha * clamp(1.4 - Math.abs(1 / b.z - 1) * .5, .25, 1);
    c.drawImage(bubbleSprite(lv, tint), x - r * 1.6, y + parY / b.z - r * 1.6, r * 3.2, r * 3.2);
  }
  c.globalAlpha = 1;
}

// ---------------- backgrounds ----------------
let paperBG = null;
function creamPaper(c, cam) {
  if (!paperBG) { paperBG = mk(W + 400, H + 400); const x = paperBG.getContext('2d'); x.fillStyle = '#f2eee5'; x.fillRect(0, 0, W + 400, H + 400); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .5; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) x.drawImage(w2.grain(), i * 512, j * 512); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
  c.drawImage(paperBG, -200 - (cam.x - 1150) * 0.6, -200 - (cam.y - 540) * 0.6);
  const v = c.createRadialGradient(W * .6, H * .5, H * .3, W * .6, H * .5, H * 1.1); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,45,25,.28)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
const WAVES = [{ c: '#33617f', lv: -160, d: 1.6 }, { c: '#26506e', lv: 300, d: 1.25 }, { c: '#1b3d5a', lv: 650, d: 1.0 }, { c: '#132c45', lv: 945, d: 0.6 }];
function wavePath(c, i, t, level, parX, step = true) {
  const tq = step ? Math.floor(t * 12) / 12 : t;
  c.beginPath(); c.moveTo(-50, H + 50);
  for (let x = -50; x <= W + 50; x += 24) { const y = level + Math.sin(x * 0.006 + i * 1.7 + tq * (0.6 + i * .2)) * (26 + i * 6) + Math.sin(x * 0.017 + i) * 7 + noise1(x * 0.05, i) * 2.5; c.lineTo(x + parX, y); }
  c.lineTo(W + 50, H + 50); c.closePath();
}
function waveLevel(i, t) { const r = eOut(seg(t, 13.7 + i * 0.32, 15.6 + i * 0.32)); return lerp(H + 260, WAVES[i].lv, r); }
function paperWaves(c, t, cam, which) {
  for (let i = 0; i < 4; i++) {
    if ((which === 'back') !== (i < 3)) continue;
    const lv = waveLevel(i, t); if (lv > H + 200) continue;
    const parX = -(cam.x - 1150) * (1.6 - WAVES[i].d) * 1.2 + (cam.r) * 6 * (1.6 - WAVES[i].d);
    c.save();
    if (i === 3) c.filter = 'blur(5px)';
    c.shadowColor = 'rgba(0,10,25,.45)'; c.shadowBlur = 22; c.shadowOffsetY = -6;
    const p = w2.paperPattern(c, WAVES[i].c); p.setTransform(new DOMMatrix().scale(1.4)); c.fillStyle = p;
    wavePath(c, i, t, lv, parX); c.fill();
    c.restore();
  }
}
function deepSea(c, t, k = 1, parX = 0) {
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a2a46'); gr.addColorStop(.55, '#061a2e'); gr.addColorStop(1, '#020812');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // god rays
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * W * 1.2 - W * .1 + Math.sin(t * .3 + i * 2.1) * 60 + parX * .3;
    const gg = c.createLinearGradient(0, 0, 0, H * .9); gg.addColorStop(0, `rgba(120,190,255,${.07 * k})`); gg.addColorStop(1, 'rgba(120,190,255,0)');
    c.fillStyle = gg; c.beginPath(); c.moveTo(x - 30, -10); c.lineTo(x + 40, -10); c.lineTo(x + 260 + i * 20, H); c.lineTo(x + 90, H); c.closePath(); c.fill();
  }
  c.restore();
}
function glowBG(c, t, cam) {
  const gr = c.createRadialGradient(cam.x, cam.y, 100, cam.x, cam.y, W * .8); gr.addColorStop(0, '#062038'); gr.addColorStop(1, '#01060d');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  // glowing wave contours (the paper sea, now as light)
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 1; i < 4; i++) {
    const parX = -(cam.x - 1150) * (1.6 - WAVES[i].d) * 1.2 + cam.r * 6 * (1.6 - WAVES[i].d);
    c.strokeStyle = `rgba(80,180,255,${.22 - i * .04})`; c.lineWidth = 2; c.shadowColor = 'rgba(80,180,255,.8)'; c.shadowBlur = 14;
    c.beginPath(); for (let x = -50; x <= W + 50; x += 24) { const y = WAVES[i].lv + Math.sin(x * 0.006 + i * 1.7 + t * (0.6 + i * .2)) * (26 + i * 6) + Math.sin(x * 0.017 + i) * 7; x === -50 ? c.moveTo(x + parX, y) : c.lineTo(x + parX, y); } c.stroke();
  }
  c.restore();
}
const FLATBG = '#0d2a46';
function flatBG(c, t, cam, az = 0) {
  c.fillStyle = FLATBG; c.fillRect(0, 0, W, H);
  // sonar rings (flat)
  c.strokeStyle = 'rgba(120,190,255,.10)'; c.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const r = ((t * 120 + i * 220) % 1100) + 380; c.beginPath(); c.arc(cam.x - az * 4, cam.y, r, 0, 7); c.stroke(); }
  const cols = ['#11355a', '#0f3050', '#0b2742'];
  for (let i = 0; i < 3; i++) {
    const lv = [560, 760, 930][i], parX = az * (6 + i * 9);
    c.fillStyle = cols[i]; c.beginPath(); c.moveTo(-60, H + 60);
    for (let x = -60; x <= W + 60; x += 30) c.lineTo(x + parX, lv + Math.sin(x * 0.005 + i * 1.3 + t * .8) * (18 + i * 6));
    c.lineTo(W + 60, H + 60); c.closePath(); c.fill();
  }
  // flat bubbles
  c.fillStyle = 'rgba(160,215,255,.25)';
  for (const b of BUB.slice(0, 30)) { const y = H * 1.1 - (((t * b.sp + b.ph) % 1) * H * 1.3); const x = b.x * W + az * 10 / b.z; c.beginPath(); c.arc(x, y, b.sz / b.z * .8, 0, 7); c.fill(); }
}

// ---------------- titles (one per stage, styled like the stage) ----------------
const TX = 118, TY = 560;
function txt(c, s, x, y, font, col, { align = 'left', track = 0, alpha = 1, base = 'alphabetic' } = {}) {
  c.save(); c.globalAlpha *= alpha; c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.letterSpacing = `${track}px`; c.fillText(s, x, y); c.restore();
}
function caption(c, s, y, col, a) { txt(c, s, TX + 4, y, '600 22px Manrope', col, { track: 5, alpha: a }); }
function titlePaper(c, t) {
  const word = 'БУМАГА', a = 1 - smooth(seg(t, 17.55, 17.95));
  c.save(); c.font = '800 132px Manrope'; c.letterSpacing = '4px';
  let x = TX;
  [...word].forEach((ch, i) => {
    const land = 10.1 + i * 0.125, tq = Math.floor(t * 12) / 12, f = seg(tq, land - .35, land);
    const w = c.measureText(ch).width + 4;
    if (tq >= land - .35) {
      const R = rng(500 + i), h = 1 - eIn(f), rot = (R() - .5) * 0.12 + h * (R() - .5) * .8;
      c.save(); c.globalAlpha = a; c.translate(x + w / 2, TY - 40 - h * 300); c.rotate(rot); c.scale(1 + h * .3, 1 + h * .3);
      c.shadowColor = 'rgba(10,20,35,.45)'; c.shadowBlur = 8 + h * 30; c.shadowOffsetX = 5 + h * 30; c.shadowOffsetY = 7 + h * 40;
      const p = w2.paperPattern(c, i % 2 ? '#efe9dc' : '#f6f1e6'); c.fillStyle = p; c.textAlign = 'center'; c.fillText(ch, 0, 45);
      c.restore();
    }
    x += w;
  });
  c.restore();
  caption(c, 'вырезанные слои · тени · stop-motion', TY + 60, '#e9eef3', a * smooth(seg(t, 10.9, 11.6)));
}
function titleGlow(gc, t) {
  // drawn into glow buffer as neon tubes
  const a = smooth(seg(t, 18.25, 18.9)) * (1 - smooth(seg(t, 25.6, 26.1)));
  if (a <= 0) return;
  const flick = 1 - 0.18 * (seg(t, 18.4, 18.5) > 0 && t < 18.62 ? 1 : 0);
  gc.save(); gc.lineCap = 'round'; gc.lineJoin = 'round';
  for (const [line, y] of [['СВЕТЯЩИЙСЯ', 0], ['КОНТУР', 1]]) {
    const st = g.strokeText(line, 0, 0, 1, { align: 0, track: .3 });
    const size = 58, x0 = TX, y0 = TY - 70 + y * 92;
    gc.setTransform(size, 0, 0, size, x0, y0);
    gc.strokeStyle = `rgba(150,225,255,${a * flick})`; gc.lineWidth = 3.2 / size;
    const prog = seg(t, 18.25 + y * .3, 19.2 + y * .3) * 1.0001;
    for (const s of st) { gc.beginPath(); gc.moveTo(s[0][0], s[0][1]); const n = Math.min(s.length, Math.max(1, Math.ceil(s.length * prog))); for (let i = 1; i < n; i++) gc.lineTo(s[i][0], s[i][1]); gc.stroke(); }
  }
  gc.restore();
}
function titleFlat(c, t) {
  const a = 1 - smooth(seg(t, 31.6, 32.4));
  const p = eOutExpo(seg(t, 26.15, 26.9));
  c.save(); c.beginPath(); c.rect(TX - 20, TY - 230, 700, 260); c.clip();
  const y = TY + (1 - p) * 240;
  c.font = '800 240px Manrope'; c.letterSpacing = '-6px';
  c.globalAlpha = a; c.fillStyle = '#0a2038'; c.fillText('2D', TX + 14, y + 14); // flat offset shadow
  c.fillStyle = '#f2f4f6'; c.fillText('2D', TX, y);
  c.restore();
  caption(c, 'плоские формы · без объёма', TY + 60, '#cfe3f5', a * smooth(seg(t, 26.6, 27.2)));
}
function title25(c, t, cam) {
  const a = smooth(seg(t, 32.1, 32.6)) * (1 - smooth(seg(t, 37.7, 38.1)));
  const sepP = smooth(seg(t, 32.2, 35.5)) * (1 - smooth(seg(t, 37.0, 38)));
  const layers = [['#123352', 2], ['#1f4f7d', 1], ['#f2f4f6', 0]];
  c.save(); c.font = '800 200px Manrope'; c.letterSpacing = '-4px';
  for (const [col, d] of layers) { c.globalAlpha = a * (d ? .95 : 1); c.fillStyle = col; c.fillText('2.5D', TX - d * sepP * (cam.az * 0.9 + 6), TY + d * sepP * 12); }
  c.restore();
  caption(c, 'плоские слои разведены по глубине', TY + 60, '#cfe3f5', a);
}
function title3D(c, t, cam) {
  const a = smooth(seg(t, 38.15, 38.6)) * (1 - smooth(seg(t, 41.0, 41.6)));
  if (a <= 0) return;
  const depth = eOutBack(seg(t, 38.0, 39.2)) * 26, dx = Math.sin(cam.az * Math.PI / 180) * -1.0 - 0.5, dy = 0.55;
  c.save(); c.font = '800 220px Manrope'; c.letterSpacing = '-4px'; c.globalAlpha = a;
  for (let i = Math.round(depth); i > 0; i--) { const k = i / 26; c.fillStyle = `rgb(${lerp(70, 18, k)},${lerp(110, 35, k)},${lerp(150, 60, k)})`; c.fillText('3D', TX + dx * i, TY + dy * i); }
  const gr = c.createLinearGradient(0, TY - 170, 0, TY); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.6, '#cfd8e2'); gr.addColorStop(1, '#8fa3b8');
  c.fillStyle = gr; c.fillText('3D', TX, TY);
  c.restore();
  caption(c, 'толщина · металл · отражения', TY + 60, '#cfe3f5', a);
}
function titleSplit(c, t, word, t0, t1, mode) {
  const a = smooth(seg(t, t0, t0 + .4)) * (1 - smooth(seg(t, t1 - .4, t1)));
  if (a <= 0) return;
  c.save(); c.font = '800 84px Manrope'; c.globalAlpha = a; c.fillStyle = '#eef3f8';
  const chars = [...word]; let x = TX; const y = 168;
  chars.forEach((ch, i) => {
    let off = 0;
    if (mode === 'apart') off = i * 9 * eOut(seg(t, 46.4 + i * .08, 48.5 + i * .08));
    else { const k = Object.values(ASM).sort()[Math.min(i, 9)]; off = (chars.length - i) * 14 * (1 - eOutBack(seg(t, k - .35, k + .1))); }
    c.fillText(ch, x + off, y); x += c.measureText(ch).width + 2;
  });
  c.restore();
  caption(c, mode === 'apart' ? 'детали расходятся по оси корпуса' : 'каждая деталь встаёт на место', 214, '#cfe3f5', a);
}

// ---------------- fixed screen-space indicator ----------------
const DEPTH = [0, 10, 40, 80, 120, 180, 240, 270, 300];
function stageAt(t) { let i = 0; STAGES.forEach(([k], j) => { if (t >= S[k][0]) i = j; }); return i; }
function indicator(c, t) {
  const i = stageAt(t), k = STAGES[i][0], [a, b] = S[k];
  const depth = lerp(DEPTH[i], DEPTH[Math.min(8, i + 1)] ?? 300, i === 8 ? 0 : eInOut(seg(t, a, b)));
  const light = clamp(1 - seg(t, 13.6, 14.6));        // dark ink on cream paper, light afterwards
  const col = (al) => `rgba(${lerp(236, 28, light)},${lerp(242, 28, light)},${lerp(248, 34, light)},${al})`;
  const x = 118, y = 990;
  // stage name rolls in at each boundary
  const roll = eOut(seg(t, a, a + .45));
  c.save(); c.beginPath(); c.rect(x - 4, y - 40, 900, 46); c.clip();
  const cur = `${String(i + 1).padStart(2, '0')}  ·  ${STAGES[i][1]}`;
  if (i > 0 && roll < 1) txt(c, `${String(i).padStart(2, '0')}  ·  ${STAGES[i - 1][1]}`, x, y - 8 - roll * 40, '700 26px Manrope', col(1 - roll), { track: 4 });
  txt(c, cur, x, y - 8 + (1 - roll) * 40, '700 26px Manrope', col(1), { track: 4 });
  c.restore();
  // segmented progress bar: nine stages
  for (let j = 0; j < 9; j++) {
    const sx = x + j * 50, done = j < i ? 1 : j === i ? seg(t, a, b) : 0;
    c.fillStyle = col(.22); c.fillRect(sx, y + 12, 42, 3);
    c.fillStyle = col(.95); c.fillRect(sx, y + 12, 42 * done, 3);
  }
  txt(c, `ГЛУБИНА  ${String(Math.round(depth)).padStart(3, '0')} м`, x + 462, y + 19, '600 17px Manrope', col(.75), { track: 3 });
  txt(c, 'ROLEX SUBMARINER', W - 118, 92, '600 18px Manrope', col(.7), { align: 'right', track: 6 });
}

// ---------------- labels for the exploded view ----------------
const LABELS = [
  ['crystal', 'Стекло', 'сапфир · линза Cyclops', [0, 0.8, 0.27]], ['bezel', 'Безель', 'Cerachrom', [0, 1.0, 0.24]], ['min', 'Стрелки', 'Mercedes', [0, 0.45, 0.19]],
  ['dial', 'Циферблат', 'Chromalight', [0, 0.7, 0.14]], ['crown', 'Заводная головка', 'Triplock', [1.3, 0, -0.02]], ['movement', 'Механизм', 'калибр 3235', [0, 0.7, 0]],
  ['caseback', 'Задняя крышка', 'завинчивающаяся', [0, 0.86, -0.2]], ['case', 'Корпус', 'Oyster · 41 мм', [-0.7, 1.15, 0.1]], ['braceBot', 'Браслет', 'Oyster', [0.38, -1.6, -0.2]],
];
function labels(c, t) {
  const show = (n) => { const t0 = DIS[n] ?? 46.5; return smooth(seg(t, t0 + .2, t0 + .6)) * (1 - smooth(seg(t, (ASM[n] ?? 56) - .7, (ASM[n] ?? 56) - .3))); };
  const items = [];
  for (const [n, s1, s2, a] of LABELS) {
    const al = n === 'case' ? smooth(seg(t, 49.8, 50.3)) * (1 - smooth(seg(t, 53.4, 53.8))) : show(n);
    const [x, y] = w3.project(w3.parts[n], new w3.V3(...a)); items.push({ n, s1, s2, x, y, al });
  }
  // stable slot order by anchor x (computed on all labels so slots don't jump when one appears)
  items.sort((p, q) => p.x - q.x);
  const top = items.filter((_, i) => i % 2 === 0), bot = items.filter((_, i) => i % 2 === 1);
  c.save(); c.letterSpacing = '1px';
  for (const [row, yy, dir] of [[top, 250, -1], [bot, 865, 1]]) {
    row.forEach((it, j) => {
      if (it.al <= 0.001) return;
      const sx = lerp(330, 1590, row.length > 1 ? j / (row.length - 1) : .5);
      c.globalAlpha = it.al;
      c.strokeStyle = 'rgba(220,235,250,.75)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(it.x, it.y);
      const ey = yy + (dir < 0 ? 26 : -40); c.lineTo(it.x, lerp(it.y, ey, .5)); c.lineTo(sx, ey); c.stroke();
      c.fillStyle = '#eaf4ff'; c.beginPath(); c.arc(it.x, it.y, 4.5, 0, 7); c.fill();
      c.font = '700 22px Manrope'; const w1 = c.measureText(it.s1).width; c.font = '500 16px Manrope'; const w2_ = c.measureText(it.s2).width; const bw = Math.max(w1, w2_) + 30;
      const by = dir < 0 ? yy - 34 : yy - 40;
      c.fillStyle = 'rgba(3,12,24,.68)'; c.fillRect(sx - bw / 2, by, bw, 60);
      c.fillStyle = 'rgba(160,210,255,.9)'; c.fillRect(sx - bw / 2, by, 3, 60);
      c.textAlign = 'center'; c.fillStyle = '#f2f7fc'; c.font = '700 22px Manrope'; c.fillText(it.s1, sx, by + 26);
      c.fillStyle = 'rgba(190,215,240,.9)'; c.font = '500 16px Manrope'; c.fillText(it.s2, sx, by + 48);
    });
  }
  c.restore();
}

// ---------------- logo ----------------
function logoState(t) {
  const u = t - 58;
  const tines = [0, 1, 2, 3, 4].map(i => {
    const ord = Math.abs(i - 2); // centre first, then pairs
    const open = smooth(seg(u, 0.3, 1.4));
    const close = seg(u, 1.55 + ord * 0.04, 2.35 + ord * 0.04);
    const spread = (i - 2) * -0.11 * open * (1 - (close > 0 ? spring(close * 1.4, 10, 5.5) : 0));
    const h = 1 + 0.06 * open * (1 - (close > 0 ? spring(close * 1.4, 10, 5.5) : 0));
    const popT = u - (2.0 + ord * 0.25);
    const ball = popT < 0 ? 1 - 0.35 * smooth(seg(u, 0.5, 1.2)) : 0.65 + 0.35 * spring(popT * 1.2, 12, 4.5) + 0.25 * Math.exp(-popT * 6) * Math.sin(Math.min(popT * 14, Math.PI));
    return { h, spread, ball };
  });
  const s = lerp(1.02, 1.22, eInOut(seg(u, 0, 1.6))) * lerp(1, 0.74, eInOut(seg(u, 3.3, 4.6)));
  const yUp = lerp(0, 0.5, eInOut(seg(u, 3.3, 4.6)));
  const ry = -0.62 * eInOut(seg(u, 0.25, 1.7)) * (1 - eInOut(seg(u, 2.2, 4.0))) + Math.sin(u * 0.7) * 0.05 * seg(u, 4, 6);
  const rx = 0.18 * eInOut(seg(u, 0.25, 1.7)) * (1 - eInOut(seg(u, 2.2, 4.0)));
  return { x: 0, y: -0.45 * s + yUp, s, rx, ry, band: 1, tines };
}
function logoBG(c, t, k) {
  const gr = c.createRadialGradient(W / 2, H * .45, 60, W / 2, H * .5, W * .75); gr.addColorStop(0, '#0f6b46'); gr.addColorStop(.5, '#04402a'); gr.addColorStop(1, '#011a10');
  c.globalAlpha = k; c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.05; const gg = c.createLinearGradient(W / 2, H * .42, W / 2 + Math.cos(a) * 900, H * .42 + Math.sin(a) * 900); gg.addColorStop(0, `rgba(240,210,140,${.05 * k})`); gg.addColorStop(1, 'rgba(240,210,140,0)'); c.fillStyle = gg; c.beginPath(); c.moveTo(W / 2, H * .42); c.lineTo(W / 2 + Math.cos(a - .06) * 1200, H * .42 + Math.sin(a - .06) * 1200); c.lineTo(W / 2 + Math.cos(a + .06) * 1200, H * .42 + Math.sin(a + .06) * 1200); c.closePath(); c.fill(); }
  c.restore(); c.globalAlpha = 1;
}
function wordmark(c, t) {
  const u = t - 58; if (u < 4.3) return;
  const word = 'ROLEX'; c.save();
  const trackPx = lerp(70, 26, eOutExpo(seg(u, 4.4, 6.4)));
  c.font = '700 150px Cinzel'; c.letterSpacing = '0px'; c.textBaseline = 'alphabetic';
  const totalW = [...word].reduce((a, ch) => a + c.measureText(ch).width, 0) + trackPx * (word.length - 1); let x = W / 2 - totalW / 2; const y = 760;
  const gr = c.createLinearGradient(0, y - 120, 0, y + 10); gr.addColorStop(0, '#fff0bf'); gr.addColorStop(.45, '#e4b75a'); gr.addColorStop(.55, '#b88a2e'); gr.addColorStop(1, '#f1d38a');
  [...word].forEach((ch, i) => {
    const lt = seg(u, 4.5 + i * 0.25, 4.5 + i * 0.25 + 0.5), e = eOut(lt);
    const w = c.measureText(ch).width;
    c.save(); c.beginPath(); c.rect(x - 20, y - 140, w + 40, 175); c.clip();
    c.globalAlpha = e; c.filter = `blur(${(1 - e) * 6}px)`; c.fillStyle = gr; c.letterSpacing = '0px';
    c.fillText(ch, x, y + (1 - e) * 120);
    c.restore();
    x += w + trackPx;
  });
  // sheen sweep across the wordmark
  const sh = seg(u, 7.0, 8.2) || 0;
  if (sh > 0 && sh < 1) {
    c.save(); c.globalCompositeOperation = 'source-atop'; c.restore();
    const sx = lerp(W / 2 - totalW / 2 - 200, W / 2 + totalW / 2 + 200, eInOut(sh));
    c.save(); c.beginPath(); c.rect(W / 2 - totalW / 2 - 40, y - 135, totalW + 80, 160); c.clip(); c.globalCompositeOperation = 'lighter';
    const sg = c.createLinearGradient(sx - 90, 0, sx + 90, 0); sg.addColorStop(0, 'rgba(255,240,200,0)'); sg.addColorStop(.5, 'rgba(255,240,200,.55)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    // mask by redrawing text
    tctx.clearRect(0, 0, W, H); tctx.font = c.font; tctx.letterSpacing = '0px';
    let xx = W / 2 - totalW / 2; for (const ch of word) { tctx.fillStyle = '#fff'; tctx.fillText(ch, xx, y); xx += tctx.measureText(ch).width + trackPx; }
    tctx.globalCompositeOperation = 'source-in'; tctx.fillStyle = sg; tctx.fillRect(0, 0, W, H); tctx.globalCompositeOperation = 'source-over';
    c.drawImage(tmpC, 0, 0); c.restore();
  }
  // subline + rules
  const s2 = eOut(seg(u, 6.4, 7.4));
  txt(c, 'OYSTER PERPETUAL  ·  SUBMARINER', W / 2, 840, '600 24px Manrope', '#e8d29a', { align: 'center', track: lerp(18, 9, s2), alpha: s2 });
  const lw = 260 * eOut(seg(u, 6.7, 7.8));
  c.fillStyle = 'rgba(232,210,154,.7)'; c.fillRect(W / 2 - 300 - lw, 832, lw, 1.5); c.fillRect(W / 2 + 300, 832, lw, 1.5);
  c.restore();
}

// ---------------- frame ----------------
function drawFrame(c, t) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over';
  const cam = cam2d(Math.min(t, 33));
  if (t < 18.4) {
    // pencil + paper share the cream sheet
    creamPaper(c, cam);
    const tip = w2.drawPencilWatch(c, t, cam, { fade: 1 });
    const ttip = w2.drawPencilTitle(c, t, TX, TY - 30, 72, 1 - smooth(seg(t, 9.5, 10.1)));
    if (t < 1.6) caption(c, '', 0, '#000', 0);
    caption(c, 'построение · штрих · штриховка', TY + 60, '#2a2a30', smooth(seg(t, 1.5, 2.2)) * (1 - smooth(seg(t, 9.5, 10.1))));
    paperWaves(c, t, cam, 'back');
    if (t >= 9.7) w2.drawPaperWatch(c, t, cam);
    if (t >= 9.9) titlePaper(c, t);
    paperWaves(c, t, cam, 'front');
    // pencil sprite: writes the title, then the watch, then lifts away
    let p = ttip || tip, lift = 0;
    if (t > 8.3) { const u = eIn(seg(t, 8.3, 9.4)); const last = w2.toScreen(cam, [0.05, 0]); p = [lerp(last[0], 2500, u), lerp(last[1], -500, u)]; lift = u; }
    if (!p && t < 1.6) p = [TX + 40, TY - 60];
    if (p && t < 9.4) w2.drawPencilSprite(c, p, lift + (t < 0.25 ? 1 - t * 4 : 0), 1.3);
    if (t > 17.6) { // light goes out
      c.fillStyle = `rgba(1,6,13,${smooth(seg(t, 17.65, 18.05)) * 0.97})`; c.fillRect(0, 0, W, H);
    }
  }
  if (t >= 17.85 && t < 26.6) {
    const k = t < 18.4 ? smooth(seg(t, 17.85, 18.4)) : 1;
    if (t >= 18.4) glowBG(c, t, cam); else { c.globalAlpha = k; glowBG(c, t, cam); c.globalAlpha = 1; }
    drawBubbles(c, t, { near: false, tint: '120,210,255', alpha: k });
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, W, H);
    w2.drawGlowWatch(gctx, t, cam, { ignite: seg(t, 17.9, 19.0) * 1.0001, power: 1 });
    titleGlow(gctx, t);
    hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, W / 2, H / 2); hctx.filter = 'blur(9px)'; hctx.drawImage(glowC, 0, 0, W / 2, H / 2); hctx.filter = 'none';
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .9;
    c.drawImage(halfC, 0, 0, W, H); c.drawImage(halfC, 0, 0, W, H);
    c.globalAlpha = 1; c.filter = 'blur(2px)'; c.drawImage(glowC, 0, 0); c.filter = 'none'; c.drawImage(glowC, 0, 0);
    c.restore();
    drawBubbles(c, t, { near: true, tint: '120,210,255', alpha: k });
    caption(c, 'кромки светятся · люминесцент в темноте', TY + 120, '#bfe6ff', smooth(seg(t, 19.0, 19.6)) * (1 - smooth(seg(t, 25.5, 26))));
  }
  if (t >= 25.75 && t < 32.2) {
    // flat 2D fills in from the centre, a wipe that rides the downbeat at 26.0
    const R = t < 26.6 ? eOut(seg(t, 25.75, 26.6)) * 2300 : 99999;
    c.save(); if (R < 99999) { c.beginPath(); c.arc(cam.x, cam.y, R, 0, 7); c.clip(); }
    flatBG(c, t, cam); w2.drawFlatWatch(c, t, cam); titleFlat(c, t);
    c.restore();
    if (R < 99999) { c.save(); c.strokeStyle = 'rgba(170,230,255,.9)'; c.lineWidth = 6; c.shadowColor = '#7fd0ff'; c.shadowBlur = 30; c.beginPath(); c.arc(cam.x, cam.y, R, 0, 7); c.stroke(); c.restore(); }
  }
  if (t >= 32 && t < 58.1) draw3D(c, t);
  if (t >= 57.9) drawLogo(c, t);
}

function draw3D(c, t) {
  const cm = cam3At(t);
  const sep = smooth(seg(t, 32.25, 35.4)) * (1 - eInOut(seg(t, 36.9, 37.95)));
  const thick = t < 38 ? 0.02 : lerp(0.02, 1, eOutBack(seg(t, 38.0, 39.3), 1.3));
  const planeFade = t < 37.95 ? 1 : 1 - smooth(seg(t, 37.95, 38.3));
  // background: flat sea with parallax -> deep sea gradient from 38
  const k3 = smooth(seg(t, 37.8, 38.6));
  if (k3 < 1) flatBG(c, t, { x: 1150 - (190 - cm.offX), y: 540 }, cm.az);
  if (k3 > 0) { c.globalAlpha = k3; deepSea(c, t, 1, -cm.az * 8); c.globalAlpha = 1; drawBubbles(c, t, { near: false, alpha: k3, parX: -cm.az * 14, tint: '190,225,255' }); }
  const mode = t < 37.95 ? 'layers' : 'model';
  const st = { mode, sep, thick, planeFade: t < 37.95 ? 1 : planeFade, explode: explodeState(t), lumeGlow: 0.25 + 0.5 * seg(t, 42, 44) * (1 - seg(t, 56, 57.5)) };
  st.sweep = { i: 40 * Math.sin(Math.PI * seg(t, 37.9, 38.9)), x: lerp(-2.4, 2.4, seg(t, 37.9, 38.9)), y: 0.8, z: 1.4 };
  w3.update(t, st);
  w3.setCamera({ az: cm.az, el: cm.el, dist: cm.dist, ty: cm.ty, tz: cm.tz, roll: cm.roll, offX: cm.offX });
  // depth of field: focus follows the hero / the part in motion
  let focus = cm.dist, ap = 0;
  if (t > 38.5) ap = 2.2;
  if (t > 41.5 && t < 44.5) ap = 4.5 * Math.sin(Math.PI * seg(t, 41.5, 44.5)) + 2.2;
  if (t > 46.3 && t < 56.5) {
    const order = ['crystal', 'bezel', 'min', 'dial', 'crown', 'movement', 'caseback', 'braceTop'];
    let target = 'case'; for (const n of order) if (t > (DIS[n] ?? 0) - .1 && t < 51) target = n;
    for (const n of [...order].reverse()) if (t > (ASM[n] ?? 99) - .5) target = n;
    const p = w3.parts[target].getWorldPosition(new w3.V3());
    const want = p.distanceTo(w3.cam.position);
    focus = lerp(cm.dist, want, 0.8); ap = 3.2;
  }
  if (t > 57.0) ap = lerp(ap, 6, seg(t, 57.0, 58));
  const img = w3.render({ focus, aperture: ap * 4, maxBlur: 14 });
  c.drawImage(img, 0, 0);
  if (k3 > 0) drawBubbles(c, t, { near: true, alpha: k3, parX: -cm.az * 30, tint: '200,230,255' });
  title25(c, t, cm); title3D(c, t, cm);
  titleSplit(c, t, 'РАЗБОРКА', 46.2, 52.2, 'apart'); titleSplit(c, t, 'СБОРКА', 52.2, 57.6, 'join');
  labels(c, t);
}

function drawLogo(c, t) {
  const k = smooth(seg(t, 57.9, 58.15));
  // iris wipe in green from the crown position
  const R = eOut(seg(t, 57.9, 58.45)) * 1400;
  c.save(); c.beginPath(); c.arc(W / 2, H / 2, R, 0, 7); c.clip();
  logoBG(c, t, 1);
  drawBubbles(c, t, { near: false, tint: '240,215,150', alpha: .5, speed: .6 });
  const L = logoState(t);
  w3.update(t, { mode: 'logo', logo: L, sweep: { i: 60 * Math.sin(Math.PI * seg(t - 58, 3.0, 4.4)) + 60 * Math.sin(Math.PI * seg(t - 58, 9.2, 10.4)), x: lerp(-2.5, 2.5, seg(t - 58, 3.0, 4.4)) + lerp(-2.5, 2.5, seg(t - 58, 9.2, 10.4)), y: 0.6, z: 1.6 } });
  const u = t - 58;
  w3.setCamera({ az: -6 * Math.sin(u * .5) * seg(u, 4, 8), el: 2, dist: Watch3D.distFor(500 * lerp(1, 1.06, seg(u, 4, 12))), ty: 0, offX: 0, offY: 0 });
  const img = w3.render({ focus: 0, aperture: 0 });
  c.drawImage(img, 0, 0);
  wordmark(c, t);
  drawBubbles(c, t, { near: true, tint: '240,215,150', alpha: .45, speed: .6 });
  c.restore();
  if (R < 1400) { c.save(); c.strokeStyle = 'rgba(255,225,150,.85)'; c.lineWidth = 5; c.shadowColor = '#ffd27a'; c.shadowBlur = 30; c.beginPath(); c.arc(W / 2, H / 2, R, 0, 7); c.stroke(); c.restore(); }
}

// motion-blur sample count per moment (subframe accumulation, 180° shutter)
function samples(t) {
  if (t > 27.3 && t < 30.8) return 4;          // time-lapse hands + bezel ratchet
  if (t > 37.85 && t < 39.4) return 3;         // thickness grows
  if ((t > 46.4 && t < 50.8) || (t > 52.0 && t < 56.3)) return 3; // parts flying
  if (t > 57.1 && t < 58.05) return 5;         // dive into the logo
  if (t > 58.25 && t < 61.2) return 3;         // crown tines
  if (t > 62.4 && t < 64.2) return 2;
  return 1;
}
export function renderAt(t) {
  const K = samples(t);
  if (K === 1) drawFrame(octx, t);
  else {
    for (let k = 0; k < K; k++) {
      const tk = t + ((k + .5) / K - .5) * (0.5 / FPS);
      drawFrame(fctx, tk);
      octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1 / (k + 1); octx.drawImage(frameC, 0, 0);
    }
    octx.globalAlpha = 1;
  }
  octx.setTransform(1, 0, 0, 1, 0, 0);
  indicator(octx, t);
}

async function init() {
  await document.fonts.load('700 100px Cinzel'); await document.fonts.load('800 100px Manrope'); await document.fonts.load('700 100px Manrope'); await document.fonts.load('600 100px Manrope');
  await document.fonts.load('500 100px Manrope'); await document.fonts.load('700 26px Manrope'); await document.fonts.ready;
  w3 = new Watch3D(); w3.V3 = (await import('three')).Vector3;
  w2.pencilSchedule();
  window.renderAt = renderAt; window.soundEvents = soundEvents;
  window.pencilActivity = () => { // tip speed per 1/120 s for the scratch SFX
    const a = []; let prev = null; const sc = mk(4, 4).getContext('2d');
    for (let i = 0; i < 10 * 120; i++) { const t = i / 120; const cam = cam2d(t); const tip = w2.drawPencilTitle(sc, t, TX, TY - 30, 72) || w2.drawPencilWatch(sc, t, cam); a.push(tip && prev ? Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) * 120 : 0); prev = tip; }
    return a;
  };
  window.ready = true;
  const q = new URLSearchParams(location.search); if (q.has('t')) renderAt(+q.get('t'));
}
init();
