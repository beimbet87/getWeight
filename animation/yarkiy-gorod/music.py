"""Саундтрек «Яркий город»: музыка + звуковой дизайн, синтез на numpy.

120 BPM (доля = 0.5 с, такт = 2 с). Все события стоят на тех же таймкодах,
что и в анимации (index.html). Запуск: python3 music.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); Rch = np.zeros(N)          # музыка
SL = np.zeros(N); SRc = np.zeros(N)        # эффекты


def note(name):
    names = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3,
             'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(sig, t0, gain=1.0, pan=0.0, sfx=False):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    s = sig[: max(0, N - i0)] * gain
    if i0 < 0:
        s = s[-i0:]; i0 = 0
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    a, b = (SL, SRc) if sfx else (L, Rch)
    a[i0:i0 + len(s)] += s * lg * 1.414
    b[i0:i0 + len(s)] += s * rg * 1.414


def fft_filter(x, lo=None, hi=None, slope=0.15):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def env_ad(n, a=0.005, d=None):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    return e


# ---------- инструменты ----------
def piano(f, dur=2.5, bright=1.0):
    t = tt(dur); s = np.zeros_like(t)
    for n in range(1, 8):
        fn = f * n * (1 + 0.0004 * n * n)
        s += (1 / n ** 1.6) * (bright ** (n - 1)) * np.sin(2 * np.pi * fn * t) * np.exp(-t * (1.2 + 0.9 * n))
    s *= env_ad(len(t), 0.004)
    hammer = fft_filter(rng.standard_normal(len(t)), 800, 4000) * np.exp(-t * 90) * 0.04
    return (s + hammer) * 0.5


def marimba(f, dur=1.2):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 6.5) + 0.32 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 22) \
        + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 45)
    s *= env_ad(len(t), 0.0015)
    return s * 0.55


def bell(f, dur=2.5):
    t = tt(dur)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.2), (2.76, .5, 4), (5.4, .25, 7), (8.9, .12, 12)])
    return s * env_ad(len(t), 0.002) * 0.35


def pad(freqs, dur, att=0.6, rel=0.8, bright=0.5):
    t = tt(dur); s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            for n in range(1, 6):
                s += (bright ** (n - 1)) / n * np.sin(2 * np.pi * ff * n * t + rng.random() * 6.28) * (1 + 0.1 * np.sin(2 * np.pi * 0.3 * t))
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel)
    return s * np.clip(e, 0, 1) / (len(freqs) * 6)


def bass(f, dur=0.45):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 8)
    return s * env_ad(len(t), 0.006) * np.exp(-t * 4) * np.minimum(1, (dur - t) / 0.03) * 0.5


def kick(g=1.0):
    t = tt(0.5); f = 48 + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 7) + 0.3 * fft_filter(rng.standard_normal(len(t)), 1000, 5000) * np.exp(-t * 120)) * g * 0.9


def clap():
    t = tt(0.35); nz = fft_filter(rng.standard_normal(len(t)), 900, 5000)
    e = np.exp(-t * 22) + sum(np.exp(-np.maximum(0, t - k * .011) * 140) * (t >= k * .011) for k in range(3)) * 0.6
    return nz * e * 0.28


def shaker():
    t = tt(0.09); return fft_filter(rng.standard_normal(len(t)), 6000, None) * np.exp(-t * 55) * 0.09


def crash(dur=2.5):
    t = tt(dur); return fft_filter(rng.standard_normal(len(t)), 3500, None) * np.exp(-t * 1.6) * env_ad(len(t), .002) * 0.32


def thud(g=1.0):
    t = tt(0.9); f = 36 + 70 * np.exp(-t * 14)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6)
    grit = fft_filter(rng.standard_normal(len(t)), 80, 900) * np.exp(-t * 18) * 0.6
    return (body + grit) * g * 0.9


def boing(f0=170, dur=0.9, depth=0.55):
    t = tt(dur)
    f = f0 * (1 + depth * np.exp(-t * 3.5) * np.sin(2 * np.pi * 15 * t)) * (1 + 0.5 * np.exp(-t * 6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    return s * np.exp(-t * 3.2) * env_ad(len(t), .003) * 0.4


def thunk():
    t = tt(0.4); f = 130 * np.exp(-t * 6) + 60
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + .3 * np.sin(2 * ph)) * np.exp(-t * 12) * 0.7


def pop(f0=900):
    t = tt(0.12); f = f0 * (0.35 + 0.65 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 38) * env_ad(len(t), .001) * 0.55


def splash(g=1.0):
    t = tt(0.7); s = fft_filter(rng.standard_normal(len(t)), 1200, 9000) * np.exp(-t * 9) * 0.35
    for k in range(9):
        t0 = rng.random() * 0.25; f0 = 1400 + rng.random() * 2200; d = tt(0.06)
        ch = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2.5 * d / 0.06)) / SR) * np.exp(-d * 70) * 0.18
        i = int(t0 * SR); s[i:i + len(ch)] += ch[: len(s) - i]
    return s * g


def drip(f0=1800):
    d = tt(0.09); return np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.6 * d / 0.09)) / SR) * np.exp(-d * 50) * 0.3


def whoosh(dur, rise=True, lo=300, hi=3000):
    t = tt(dur); nz = rng.standard_normal(len(t))
    a = fft_filter(nz, lo, lo * 3); b = fft_filter(nz, hi / 3, hi)
    x = t / dur if rise else 1 - t / dur
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return (a * (1 - x) + b * x) * e * 0.35


def squeak(dur=0.5):
    t = tt(dur); f = 260 + 520 * (t / dur) ** 1.5 + 25 * np.sin(2 * np.pi * 23 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .5 * np.sin(2 * ph) + .25 * np.sin(3 * ph)
    return s * (0.3 + 0.7 * t / dur) * np.minimum(1, (dur - t) / 0.02) * 0.13


def chirp_bird():
    s = np.zeros(int(0.35 * SR))
    for k in range(3):
        d = tt(0.07); f = 3200 + 1500 * np.sin(np.pi * d / 0.07) + rng.random() * 400
        c = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * d / 0.07) ** 2 * 0.12
        i = int(k * 0.1 * SR); s[i:i + len(c)] += c
    return s


# =================== СЕРЫЙ ГОРОД (ля минор) ===================
Am = ['A2', 'E3', 'A3', 'C4', 'E4']
for nm in Am:
    place(piano(note(nm), 3.0, .55), 0.0, 0.35)
place(pad([note(x) for x in ['A2', 'E3', 'C4']], 4.2, att=1.2, rel=1.0, bright=.35), 0.0, 0.9)
for t0, nm in [(0.5, 'E5'), (1.0, 'C5'), (1.5, 'A4')]:
    place(piano(note(nm), 2.0, .6), t0, 0.45, 0.15)
for nm in ['F2', 'C3', 'F3', 'A3', 'C4']:
    place(piano(note(nm), 2.5, .55), 2.0, 0.3)
place(piano(note('D5'), 1.5, .6), 2.5, 0.4, 0.15)
# голос шарика — маримба на отскоках
for t0, nm in [(3.0, 'E5'), (3.5, 'G5'), (4.0, 'C6')]:
    place(marimba(note(nm)), t0, 0.75, -0.1)
# башня «НЕЛЬЗЯ»: тяжёлый аккорд и удары
for nm in ['D2', 'A2', 'D3', 'F3']:
    place(piano(note(nm), 3.0, .4), 4.0, 0.55)
place(pad([note(x) for x in ['D2', 'A2', 'F3']], 2.6, att=.05, rel=1.2, bright=.3), 4.0, 1.0)
# столкновение 5.25 — диссонанс
for nm in ['A2', 'A#2', 'E3']:
    place(piano(note(nm), 1.6, .5), 5.25, 0.45)
# грустная нисходящая фраза
for t0, nm in [(5.5, 'E5'), (5.75, 'D5'), (6.0, 'C5'), (6.25, 'B4'), (6.5, 'A4')]:
    place(piano(note(nm), 1.6 if nm != 'A4' else 2.5, .55), t0, 0.42, 0.1)
for nm in ['A2', 'E3', 'C4']:
    place(piano(note(nm), 2.0, .5), 6.0, 0.28)
# решимость: F – G – E7, бас восьмыми, дробь
for t0, ch in [(7.0, ['F2', 'C3', 'A3', 'C4']), (7.5, ['G2', 'D3', 'B3', 'D4']), (8.0, ['E2', 'B2', 'D3', 'G#3'])]:
    for nm in ch:
        place(piano(note(nm), 1.2, .6), t0, 0.32)
for k in range(12):
    t0 = 7.0 + k * 0.125; root = 'F2' if t0 < 7.5 else ('G2' if t0 < 8.0 else 'E2')
    place(bass(note(root), 0.12), t0, 0.5 + 0.03 * k)
# дробь малого барабана с ускорением 7.0–8.5
t0 = 7.0
while t0 < 8.48:
    g = 0.25 + 0.75 * (t0 - 7.0) / 1.5
    place(clap() * 0.6, t0, g * 0.5, 0.1 * np.sin(t0 * 9))
    t0 += 0.125 if t0 < 7.5 else (0.0625 if t0 < 8.0 else 0.03125)
# райзер
t = tt(1.5); f = 220 * 2 ** (2 * t / 1.5)
riser = (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 + fft_filter(rng.standard_normal(len(t)), 1500, 8000) * 0.25) * (t / 1.5) ** 2
place(riser, 7.0, 0.7)

# =================== ПРЫЖОК: дыхание ===================
place(pad([note('E6')], 1.6, att=.3, rel=.4, bright=.2), 8.5, 0.55)
place(pad([note('B5')], 1.4, att=.4, rel=.4, bright=.2), 8.6, 0.3)
rc = crash(1.1)[::-1] * np.linspace(0, 1, int(1.1 * SR)) ** 2
place(rc, 8.9, 0.9)

# =================== ЯРКИЙ ГОРОД (ля мажор) ===================
CH = [(10.0, ['A2', 'E3', 'A3', 'C#4', 'E4']), (11.0, ['E2', 'B2', 'E3', 'G#3', 'B3']), (12.0, ['F#2', 'C#3', 'F#3', 'A3', 'C#4']),
      (13.0, ['D2', 'A2', 'D3', 'F#3', 'A3']), (14.0, ['A2', 'E3', 'A3', 'C#4', 'E4']), (15.0, ['E2', 'B2', 'E3', 'G#3', 'B3'])]
for t0, ch in CH:
    place(pad([note(x) for x in ch[1:]], 1.08, att=.03, rel=.15, bright=.55), t0, 0.75)
    for nm in ch[2:]:
        place(piano(note(nm), 1.0, .9), t0, 0.22)
    for k in range(8):
        f = note(ch[0]) * (2 if k % 2 else 1)
        place(bass(f, 0.12), t0 + k * 0.125, 0.75)
for k in range(12):
    tb = 10.0 + k * 0.5
    place(kick(), tb, 0.95)
    if k % 2 == 1:
        place(clap(), tb, 0.55, 0.05)
for k in range(48):
    place(shaker(), 10.0 + k * 0.125, 0.8 if k % 2 else 0.5, 0.3)
# маримба = мелодия отскоков
for t0, nm in [(10.0, 'A5'), (10.5, 'C#6'), (11.0, 'B5'), (11.5, 'G#5'), (12.0, 'A5'), (12.5, 'C#6'),
               (13.0, 'D6'), (13.5, 'F#6'), (14.0, 'E6'), (14.5, 'C#6')]:
    place(marimba(note(nm)), t0, 0.8, -0.15)
    place(marimba(note(nm) / 2), t0, 0.25, 0.15)
# восходящее глиссандо на взлёте
for k, nm in enumerate(['E6', 'F#6', 'G#6', 'A6', 'B6']):
    place(marimba(note(nm), 0.6), 14.625 + k * 0.1, 0.45, 0.2)
# «ЯРКИЙ» — по ноте на букву
for i, nm in enumerate(['E6', 'F#6', 'G#6', 'A6', 'C#7']):
    place(bell(note(nm), 1.8), 15.28 + 0.12 * i, 0.5, -0.3 + 0.15 * i)
# финал: A мажор, плагальная каденция D → A
for nm in ['A1', 'A2', 'E3', 'A3', 'C#4', 'E4', 'A4', 'C#5']:
    place(piano(note(nm), 3.5, .85), 16.0, 0.32)
place(pad([note(x) for x in ['A2', 'E3', 'A3', 'C#4', 'E4']], 1.2, att=.05, rel=.5, bright=.5), 16.0, 0.9)
place(kick(1.2), 16.0, 1.0)
for k in range(8):
    place(marimba(note(['E6', 'C#6', 'A5', 'E5', 'A5', 'C#6', 'E6', 'A6'][k]), 0.9), 16.5 + k * 0.125 + 0.004 * k * k, 0.42, -0.2 + 0.05 * k)
for k in range(4):
    place(kick(.7), 16.5 + k * 0.5, 0.5)
    place(shaker(), 16.75 + k * 0.5, 0.6, 0.3)
place(pad([note(x) for x in ['D3', 'A3', 'D4', 'F#4']], 1.3, att=.2, rel=.4, bright=.45), 17.0, 0.75)
for nm in ['D3', 'F#3', 'A3', 'D4']:
    place(piano(note(nm), 1.2, .8), 17.0, 0.22)
for nm in ['A1', 'A2', 'E3', 'A3', 'C#4', 'E4', 'A4', 'E5']:
    place(piano(note(nm), 3.0, .8), 18.0, 0.3)
place(pad([note(x) for x in ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4']], 2.0, att=.15, rel=1.5, bright=.45), 18.0, 0.95)
for nm in ['A6', 'E6', 'C#7']:
    place(bell(note(nm), 2.0), 18.0, 0.25)

# =================== ЗВУКОВОЙ ДИЗАЙН ===================
# дождь: шум, стихает после волны
rain = fft_filter(rng.standard_normal(N), 700, 5000) * 0.035
re = np.ones(N); tt_all = np.arange(N) / SR
re *= np.clip(tt_all / 0.7, 0, 1) * (1 - np.clip((tt_all - 10.15) / 1.4, 0, 1))
rain *= re
SL += rain; SRc += np.roll(rain, 997)
for k in range(40):
    t0 = rng.random() * 10.0
    place(drip(1500 + rng.random() * 1500), t0, 0.12 * (1 - t0 / 12), rng.random() * 1.6 - .8, sfx=True)
# падение и шлепок в лужу
place(whoosh(1.0, rise=False, lo=400, hi=2500), 2.05, 0.35, sfx=True)
place(splash(1.0), 3.0, 0.7, -0.1, sfx=True)
place(boing(240, 0.35, 0.3), 3.0, 0.35, sfx=True)
for t0 in (3.5, 4.0, 5.75):
    place(boing(260, 0.3, 0.25), t0, 0.25, sfx=True); place(splash(.35), t0, 0.3, sfx=True)
# башня
for k in range(6):
    place(whoosh(0.3, rise=True, lo=150, hi=900), 3.7 + 0.075 * k, 0.15, 0.2, sfx=True)
    place(thud(1.0 if k == 0 else 0.6), 4.0 + 0.075 * k, 0.9 if k == 0 else 0.6, 0.15, sfx=True)
# столкновение
place(thunk(), 5.25, 0.8, 0.2, sfx=True); place(boing(140, 0.5, 0.7), 5.25, 0.35, 0.2, sfx=True)
# капля смелости
place(drip(1900), 6.5, 0.9, sfx=True)
for k, nm in enumerate(['A6', 'C#7', 'E7']):
    place(bell(note(nm), 1.5), 6.52 + k * 0.06, 0.18, -0.2 + 0.2 * k, sfx=True)
# скрип сжатия и запуск
place(squeak(0.5), 8.0, 1.0, sfx=True)
place(boing(150, 0.95, 0.6), 8.5, 0.9, sfx=True)
place(whoosh(0.9, rise=True, lo=250, hi=3500), 8.5, 0.6, sfx=True)
place(whoosh(0.7, rise=False, lo=300, hi=2500), 9.35, 0.4, sfx=True)
# удар цвета
place(crash(3.0), 10.0, 0.9, sfx=True)
t = tt(1.4); sub = np.sin(2 * np.pi * np.cumsum(30 + 40 * np.exp(-t * 5)) / SR) * np.exp(-t * 2.5)
place(sub, 10.0, 0.9, sfx=True)
place(boing(200, 0.5, 0.4), 10.0, 0.45, sfx=True)
for t0 in [10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5]:
    place(boing(300, 0.25, 0.2), t0, 0.18, sfx=True)
for k in range(6):
    place(pop(700 + 120 * k), 10.52 + (5 - k) * 0.07, 0.7, -0.5 + 0.2 * k, sfx=True)
# взлёт и удар по титру
place(whoosh(0.7, rise=True, lo=300, hi=5000), 14.5, 0.55, sfx=True)
place(pop(1200), 15.2, 0.8, sfx=True)
place(crash(1.2), 15.2, 0.25, sfx=True)
# приземление: весь город подпрыгивает
place(boing(110, 0.9, 0.5), 16.0, 0.6, sfx=True)
place(whoosh(0.8, rise=False, lo=200, hi=1500), 16.0, 0.3, sfx=True)
place(crash(2.5), 16.0, 0.4, sfx=True)
for t0 in (16.45, 16.75):
    place(boing(320, 0.25, 0.2), t0, 0.15, sfx=True)
for t0 in (16.7, 17.3, 18.1, 18.8):
    place(chirp_bird(), t0, 0.5, rng.random() - .5, sfx=True)

# =================== СВЕДЕНИЕ ===================
def reverb(x, t60=1.4, seed=1):
    r = np.random.default_rng(seed); n = int(t60 * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / t60); ir = fft_filter(ir, 200, 7000); ir /= np.sqrt(np.sum(ir ** 2))
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]

wetL, wetR = reverb(L + SL * .4, seed=1), reverb(Rch + SRc * .4, seed=2)
outL = L + SL + 0.22 * wetL
outR = Rch + SRc + 0.22 * wetR
mix = np.stack([outL, outR], 1)
mix = fft_filter(mix[:, 0], 28, None)[:, None] * [1, 0] + fft_filter(mix[:, 1], 28, None)[:, None] * [0, 1]
mix /= np.max(np.abs(mix)) / 0.98
mix = np.tanh(mix * 1.35) / np.tanh(1.35)          # мягкий лимитер
fade = np.ones(N); nf = int(0.6 * SR); fade[-nf:] = np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
fade[: int(0.01 * SR)] = np.linspace(0, 1, int(0.01 * SR))
mix *= fade[:, None]
mix *= 0.891 / np.max(np.abs(mix))                  # пик -1 dBFS
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('written', out, 'peak', np.max(np.abs(mix)), 'rms dB', 20 * np.log10(np.sqrt(np.mean(mix ** 2))))
