"""Offline score + sound design for the Rolex Submariner style film (70 s, 120 BPM, bar = 2 s).
Events come from audio/events.json (exported by the page) so picture and sound share one timeline."""
import json, os, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000; DUR = 70.0; N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
EV = json.load(open(os.path.join(HERE, 'events.json')))
rng = np.random.default_rng(3)
music = np.zeros((2, N)); sfx = np.zeros((2, N)); dry = np.zeros((2, N))

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def put(buf, t, sig, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    s = sig * gain
    if i < 0: s = s[-i:]; i = 0
    s = s[:N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(s)] += s * l * 1.414; buf[1, i:i + len(s)] += s * r * 1.414
def env_t(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)

def mixs(*xs):
    o = np.zeros(max(len(x) for x in xs))
    for x in xs: o[:len(x)] += x
    return o
# ---------------- instruments ----------------
def piano(m, dur=2.5, vel=0.6):
    f = mtof(m); t = env_t(dur); s = np.zeros_like(t)
    for n in range(1, 9):
        fn = f * n * np.sqrt(1 + 0.0004 * n * n)
        if fn > 16000: break
        s += np.sin(2 * np.pi * fn * t) * (1 / n ** 1.4) * np.exp(-t * (1.1 + 0.45 * n) * (0.6 + f / 900))
    s *= np.minimum(1, t / 0.004)
    s += hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 90) * 0.04
    rel = np.ones_like(t); k = int(0.15 * SR); rel[-k:] = np.linspace(1, 0, k)
    return s * rel * vel * 0.35
def bell(m, dur=2.0, vel=0.5):
    f = mtof(m); t = env_t(dur)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 3)
    s = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.2)
    return lp(s * np.minimum(1, t / 0.002), 9000, 4) * vel * 0.18
def pluck(m, vel=0.5):
    f = mtof(m); t = env_t(0.9)
    s = sum(np.sin(2 * np.pi * f * n * t) / n ** 1.2 * np.exp(-t * (8 + 3 * n)) for n in range(1, 7))
    return s * np.minimum(1, t / 0.002) * vel * 0.3
def pad(ms, dur, vel=0.25, bright=1800):
    t = env_t(dur); s = np.zeros_like(t)
    for m in ms:
        f = mtof(m)
        for det in (-0.12, 0.0, 0.11):
            fd = f * 2 ** (det / 12)
            for n in range(1, 12):
                if fd * n > bright * 2: break
                s += np.sin(2 * np.pi * fd * n * t + n * det * 7) / n * (1 / (1 + (fd * n / bright) ** 2))
    a = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.7)
    return s * a * vel * 0.05
def bass(m, dur=0.45, vel=0.6):
    f = mtof(m); t = env_t(dur)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    s = np.tanh(1.6 * s) * np.exp(-t * 2.2) * np.minimum(1, t / 0.005) * np.minimum(1, (dur - t) / 0.02)
    return s * vel * 0.32
def kick(vel=1.0):
    t = env_t(0.5); f = 45 + 95 * np.exp(-t * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    s += hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 250) * 0.15
    return np.tanh(s * 1.5) * vel * 0.5
def snare(vel=0.6):
    t = env_t(0.35)
    n = bp(rng.standard_normal(len(t)), 1200, 8000) * np.exp(-t * 18)
    return (n * 0.8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4) * vel * 0.4
def tick(vel=0.3, f=3800):
    t = env_t(0.05)
    return (hp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 400) * 0.6 + np.sin(2 * np.pi * f * t) * np.exp(-t * 160)) * vel * 0.25
def metal_ping(f0=1800, vel=0.5, dur=1.2):
    t = env_t(dur); s = np.zeros_like(t)
    for r, a, d in ((1, 1, 5), (2.76, .6, 7), (5.4, .4, 9), (8.93, .25, 12)):
        if f0 * r > 15000: continue
        s += np.sin(2 * np.pi * f0 * r * t) * a * np.exp(-t * d)
    s += hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 300) * 0.5
    return s * vel * 0.12
def whoosh(dur=0.8, f0=300, f1=4000, vel=0.4, rev=False):
    t = env_t(dur); n = rng.standard_normal(len(t)); out = np.zeros_like(t)
    seg = 8; L = len(t) // seg
    for k in range(seg):
        fc = f0 * (f1 / f0) ** (k / (seg - 1)); x = bp(n, fc * 0.6, min(fc * 1.6, 20000))
        w = np.zeros_like(t); a = max(0, k * L - L // 2); b = min(len(t), (k + 1) * L + L // 2); w[a:b] = np.hanning(b - a); out += x * w
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    if rev: e = (t / dur) ** 3
    return out * e * vel * 0.5
def boom(vel=1.0, dur=2.5):
    t = env_t(dur); f = 32 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 4) * 0.4
    return np.tanh(s * 1.3) * vel * 0.6
def paper_flap(vel=0.6):
    t = env_t(0.22); n = rng.standard_normal(len(t))
    s = bp(n, 300, 3500) * np.exp(-t * 28) * (1 + 0.6 * np.sin(2 * np.pi * 37 * t))
    s += np.sin(2 * np.pi * 95 * t) * np.exp(-t * 30) * 0.6
    return s * vel * 0.5
def bubble(vel=0.2):
    t = env_t(0.09); f = 500 + 1500 * (t / 0.09) ** 1.5
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.09) * vel * 0.3

# ---------------- harmony ----------------
CH = {'Dm': (50, [0, 3, 7]), 'Bb': (46, [0, 4, 7]), 'C': (48, [0, 4, 7]), 'F': (53, [0, 4, 7]), 'Gm': (55, [0, 3, 7]), 'A': (45, [0, 4, 7]), 'D': (50, [0, 4, 7])}
BARS = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm', 'Bb', 'Gm', 'Dm', 'Bb', 'A', 'Dm', 'F', 'C', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'A', 'Bb', 'C', 'A', 'D', 'Bb', 'C', 'D', 'D', 'D']
def tones(name, octave_base=60):
    r, iv = CH[name]; root = r % 12
    return [octave_base + ((root + i) % 12) for i in iv], r - 12

for b, name in enumerate(BARS):
    t0 = b * 2.0; (c1, c2, c3), broot = tones(name)
    if t0 >= DUR: break
    v = [c1, c2, c3]
    # pad everywhere (underwater dark in glow, bright in 3D / logo)
    bright = 900 if 18 <= t0 < 26 else 2600 if t0 >= 38 else 1600
    padvel = 0.18 if t0 < 10 else 0.42 if 18 <= t0 < 26 else 0.26 if t0 < 38 else 0.32
    if t0 < 58 or t0 < 68: put(music, t0, pad([m - 12 for m in v] + [v[0]], 2.25 if t0 < 68 else 2.0, padvel, bright))
    # pencil + paper: gentle broken chords on the piano
    if t0 < 18:
        patt = [v[0], v[2], v[1] + 12, v[2], v[0] + 12, v[2], v[1] + 12, v[2]]
        for k, m in enumerate(patt): put(music, t0 + k * 0.25, piano(m, 1.6, 0.42 if k % 2 == 0 else 0.3), pan=-0.2 + 0.4 * (k % 2))
        mel = {0: 74, 1: 72, 2: 77, 3: 76, 4: 74, 5: 81, 6: 79, 7: 77, 8: 74}
        if b in mel: put(music, t0, piano(mel[b], 2.5, 0.5), pan=0.1)
    # glow: shimmering bell arpeggios
    if 18 <= t0 < 26:
        seq = [v[0] + 12, v[1] + 12, v[2] + 12, v[0] + 24]
        for k in range(16): put(music, t0 + k * 0.125, bell(seq[k % 4] + (12 if k >= 8 and k % 4 == 3 else 0), 1.2, 0.6 + 0.2 * (k % 4 == 0)), pan=np.sin(k * 0.8) * 0.6)
    # groove from 26 (2D) onwards, breakdown in the disassembly, back for assembly
    if 26 <= t0 < 58:
        for k in range(4):
            tb = t0 + k * 0.5
            if not (46 <= t0 < 52) or k % 2 == 0: put(music, tb, bass(broot, 0.42, 0.7))
            put(music, tb + 0.25, bass(broot + (12 if k % 2 else 7), 0.2, 0.35))
            drums = not (46 <= t0 < 52)
            if drums and (k % 2 == 0 or t0 >= 38): put(dry, tb, kick(0.85 if k % 2 == 0 else 0.6))
            if drums and k % 2 == 1 and t0 >= 32: put(music, tb, snare(0.55))
            if t0 >= 26: put(music, tb + 0.25, piano(v[1] + 12, 0.4, 0.22), pan=0.3)
        if t0 >= 38 and t0 < 46: put(music, t0, piano(v[0] + 24, 2.0, 0.38), pan=-0.1)
    # logo: big chord then melody follows events
    if t0 >= 58:
        put(music, t0, piano(v[0] - 12, 4.0, 0.45)); put(music, t0, piano(v[1], 4.0, 0.3), pan=-0.2); put(music, t0, piano(v[2], 4.0, 0.3), pan=0.2)

# clock ticks: the movement under everything (quieter when drums play)
for k in range(int(DUR / 0.25)):
    t = k * 0.25
    if t >= 68: break
    vol = 0.5 if t < 26 else 0.28 if t < 46 else 0.6 if t < 52 else 0.25 if t < 58 else 0.18
    put(sfx, t, tick(vol, 3800 if k % 2 == 0 else 3300), pan=0.15 if k % 2 else -0.15)

# ---------------- sound design from picture events ----------------
# pencil scratch follows tip speed
act = np.clip(np.array(EV['pencil']), 0, 3000) / 3000.0
act = np.convolve(act, np.ones(6) / 6, 'same')
ae = np.interp(np.arange(int(10 * SR)) / SR, np.arange(len(act)) / 120.0, act)
scr = bp(rng.standard_normal(len(ae)), 1800, 7000) * (0.6 + 0.4 * np.abs(bp(rng.standard_normal(len(ae)), 20, 60)))
put(sfx, 0, scr * ae * 0.16, pan=0.25)
for tl in EV['paper']: put(sfx, tl, paper_flap(0.7), pan=rng.uniform(-.4, .4)); put(music, tl, pluck(rng.choice([62, 65, 69, 74]), 0.45), pan=rng.uniform(-.3, .3))
# light goes out
put(sfx, 17.65, tick(0.9, 1500)); put(sfx, 17.0, whoosh(1.0, 3000, 200, 0.5, rev=True)); put(dry, 18.0, boom(0.9, 3))
for k in range(26): put(sfx, 18.3 + k * 0.3 + rng.uniform(0, .25), bubble(rng.uniform(.1, .25)), pan=rng.uniform(-.7, .7))
# bezel clicks: same easing as common.js
def eio(u): u = np.clip(u, 0, 1); return np.where(u < .5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)
for (a, b, n) in ((20.0, 22.0, 30), (28.0, 30.6, 90)):
    ts = np.linspace(a, b, 4000); c = np.floor(n * eio((ts - a) / (b - a))); idx = np.nonzero(np.diff(c))[0]
    for i in idx: put(sfx, ts[i + 1], mixs(metal_ping(2600, 0.22, 0.12), tick(0.4, 4200)), pan=0.35)
# flat wipe, time-lapse whir
put(sfx, 25.6, whoosh(0.5, 400, 5000, 0.5)); put(dry, 26.0, kick(0.9))
t = env_t(3.8); f = 200 + 900 * eio(t / 3.8); whir = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(rng.standard_normal(len(t)), 600, 3000) * 0.4
put(sfx, 27.2, whir * np.sin(np.pi * t / 3.8) * 0.12)
# 2.5D layers separate / collapse, 3D impact
put(sfx, 32.2, whoosh(2.4, 200, 2500, 0.35), pan=-0.3); put(sfx, 36.9, whoosh(1.1, 4000, 300, 0.5, rev=True))
put(dry, 38.0, boom(1.0, 3)); put(music, 38.0, metal_ping(900, 0.8, 2.5)); put(music, 38.0, pad([50, 57, 62, 65, 69], 3.0, 0.4, 3000))
for k in range(8): put(music, 38.05 + k * 0.09, bell(86 + [0, 3, 7, 12][k % 4], 1.5, 0.25), pan=-0.6 + k * 0.17)
# exploded view: release clinks + airy moves; assembly: snaps
for i, (n, tt) in enumerate(sorted(EV['DIS'].items(), key=lambda x: x[1])):
    if n == 'braceBot': continue
    put(sfx, tt - 0.05, metal_ping(1400 + 180 * i, 0.55, 0.9), pan=-0.5 + i * 0.1); put(sfx, tt, whoosh(0.6, 500, 3500, 0.28), pan=-0.5 + i * 0.1)
for i, (n, tt) in enumerate(sorted(EV['ASM'].items(), key=lambda x: x[1])):
    if n == 'braceTop': continue
    put(sfx, tt - 0.45, whoosh(0.45, 3000, 500, 0.22, rev=True), pan=0.4 - i * 0.08)
    put(sfx, tt, mixs(tick(1.0, 2200), metal_ping(1900 + 120 * i, 0.5, 0.5), kick(0.25)), pan=0.4 - i * 0.08)
# dive into the logo
put(sfx, 56.6, whoosh(1.4, 200, 9000, 0.6, rev=True)); put(dry, 58.0, boom(1.0, 4))
put(music, 58.0, pad([38, 50, 57, 62, 66, 69], 6.0, 0.55, 3200))
put(sfx, 58.3, whoosh(1.0, 300, 2500, 0.25), pan=-0.3); put(sfx, 59.55, whoosh(0.5, 2500, 400, 0.25), pan=0.3)
for k, tt in enumerate((60.0, 60.25, 60.5)):
    for m in ((86,), (90, 81), (93, 74))[k]: put(music, tt, bell(m, 2.5, 0.55), pan=(-.4, .4)[k % 2] if k else 0)
for k, m in enumerate((74, 76, 78, 81, 86)): put(music, 62.5 + k * 0.25, piano(m, 3.5, 0.55), pan=-0.4 + k * 0.2)
put(music, 64.0, pad([50, 57, 62, 66, 69, 74], 6.0, 0.45, 2800))
for tt in (61.0, 65.0, 67.2):
    for k in range(10): put(music, tt + k * 0.06, bell(98 + [0, 2, 4, 7, 9][k % 5], 1.6, 0.16), pan=-0.7 + k * 0.15)
put(music, 64.0, piano(38, 6.0, 0.55)); put(music, 64.0, piano(50, 6.0, 0.4)); put(music, 64.0, piano(66, 6.0, 0.35)); put(music, 64.0, piano(69, 6.0, 0.35))

# ---------------- mix ----------------
def ir(sec, seed):
    r = np.random.default_rng(seed); t = np.arange(int(sec * SR)) / SR
    return r.standard_normal(len(t)) * np.exp(-t * 3.0 / sec * 2.2) * 0.12
rv = np.stack([fftconvolve(music[0] + 0.5 * sfx[0], ir(2.6, 1))[:N], fftconvolve(music[1] + 0.5 * sfx[1], ir(2.6, 2))[:N]])
# underwater section: muffle the music between 18 and 26
mix = music + sfx + dry + rv * 0.35
mask = np.interp(np.arange(N) / SR, [0, 17.9, 18.2, 25.8, 26.0, 70], [0, 0, 1, 1, 0, 0])
for c in range(2):
    m = lp(mix[c], 1400, 2); mix[c] = mix[c] * (1 - mask * 0.55) + m * mask * 0.55
mix = hp(mix, 25, 2)
fade = np.ones(N); k = int(1.6 * SR); fade[-k:] = np.linspace(1, 0, k) ** 1.5; fade[:int(0.02 * SR)] = np.linspace(0, 1, int(0.02 * SR))
mix *= fade
pk = np.max(np.abs(mix)); mix = mix / pk * 1.4; mix = np.tanh(mix) / np.tanh(1.4) * 0.89
out = (mix.T * 32767).astype(np.int16)
import wave
with wave.open(os.path.join(HERE, 'mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('peak', np.max(np.abs(mix)), 'rms dB', 20 * np.log10(np.sqrt(np.mean(mix ** 2))))
