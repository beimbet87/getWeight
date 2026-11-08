// Shared timeline, easing and helpers.
export const W = 1920, H = 1080, FPS = 60, DUR = 70;

// Scene boundaries fall on 2-second bars (120 BPM).
export const S = {
  pencil: [0, 10], paper: [10, 18], glow: [18, 26], flat: [26, 32],
  l25: [32, 38], d3: [38, 46], dis: [46, 52], asm: [52, 58], logo: [58, 70],
};
export const STAGES = [
  ['pencil', 'КАРАНДАШНЫЙ ЭСКИЗ'], ['paper', 'БУМАГА'], ['glow', 'СВЕТЯЩИЙСЯ КОНТУР'],
  ['flat', '2D'], ['l25', '2.5D'], ['d3', '3D'], ['dis', 'РАЗБОРКА'], ['asm', 'СБОРКА'], ['logo', 'ЛОГОТИП'],
];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const eIn = t => { t = clamp(t); return t * t * t; };
export const eOut = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const eInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eOutExpo = t => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const eOutBack = (t, s = 1.70158) => { t = clamp(t); const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
// Damped spring settle: 0 -> 1 with overshoot.
export const spring = (t, k = 7, d = 5) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(k * t);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// Smooth 1D value noise.
export function noise1(x, seed = 0) {
  const h = i => { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// Cubic Hermite through keyframes [{t, ...values}] with Catmull-Rom tangents (continuous velocity).
export function track(keys) {
  return t => {
    if (t <= keys[0].t) return { ...keys[0] };
    if (t >= keys[keys.length - 1].t) return { ...keys[keys.length - 1] };
    let i = 0; while (keys[i + 1].t < t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const dt = k2.t - k1.t, u = (t - k1.t) / dt, u2 = u * u, u3 = u2 * u;
    const out = { t };
    for (const key in k1) {
      if (key === 't') continue;
      const m1 = (k2[key] - k0[key]) / (k2.t - k0.t || 1) * dt;
      const m2 = (k3[key] - k1[key]) / (k3.t - k1.t || 1) * dt;
      out[key] = (2 * u3 - 3 * u2 + 1) * k1[key] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[key] + (u3 - u2) * m2;
    }
    return out;
  };
}

// Watch time (seconds on a 12h dial). Starts 10:10:00, sweeps 8 beats/s,
// with a one-hour time-lapse during the 2D scene.
export function watchTime(t) {
  const beat = Math.floor(t * 8) / 8;
  const lapse = 3600 * eInOut(seg(t, 27.2, 31.0));
  return 10 * 3600 + 10 * 60 + beat + lapse;
}
// Bezel rotation in degrees (unidirectional, counter-clockwise, 120 clicks / turn).
export function bezelAngle(t) {
  const clicks1 = Math.floor(30 * eInOut(seg(t, 20.0, 22.0)));        // glow: 30 clicks
  const clicks2 = Math.floor(90 * eInOut(seg(t, 28.0, 30.6)));        // 2D: 90 clicks -> full turn
  return -(clicks1 + clicks2) * 3;
}
