"""Generate Project Planner feedback sounds. Deterministic, no samples, licence-free.
Usage: python3 make_feedback_sounds.py <out_dir>   (needs numpy)"""
import sys, os, wave
import numpy as np

SR = 44100
PEAK = 10 ** (-6 / 20)  # -6 dBFS

def bell(freq, dur, decay=7.0, partials=((1, 1.0), (2.0, 0.30), (3.01, 0.10), (4.2, 0.04))):
    t = np.arange(int(SR * dur)) / SR
    tone = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-decay * m ** 0.5 * t) for m, a in partials)
    return tone * np.minimum(1, t / 0.004)

def glide(f0, f1, dur, decay=18.0):
    t = np.arange(int(SR * dur)) / SR
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-decay * t) * np.minimum(1, t / 0.003)

def soft_buzz(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    w = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 3 * freq * t)
    return w * np.minimum(1, t / 0.006) * np.minimum(1, (dur - t) / 0.03)

def seq(parts, total):
    out = np.zeros(int(SR * total))
    for start, sig, gain in parts:
        i = int(SR * start); n = min(len(sig), len(out) - i)
        out[i:i + n] += gain * sig[:n]
    return out

def finish(x):
    fade = int(SR * 0.02)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x / np.max(np.abs(x)) * PEAK

SOUNDS = {
    'success':  seq([(0, bell(659.25, .32), 1), (.075, bell(987.77, .30), .8)], .40),
    'sent':     glide(520, 820, .16),
    'approved': seq([(0, bell(523.25, .5), .9), (.07, bell(659.25, .5), .85), (.14, bell(783.99, .5), .8), (.21, bell(1046.5, .45), .6)], .62),
    'resolved': seq([(0, bell(783.99, .32, 8), 1), (.09, bell(587.33, .36, 8), .85)], .46),
    'removed':  bell(440, .24, 12, ((1, 1.0), (2.0, .15))),
    'error':    seq([(0, soft_buzz(220, .09), 1), (.15, soft_buzz(196, .11), 1)], .28),
    'queued':   bell(880, .09, 30, ((1, 1.0),)),
}

def write(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    for name, sig in SOUNDS.items():
        x = finish(np.array(sig, dtype=float))
        write(os.path.join(out, f'pp-{name}.wav'), x)
        print(f'pp-{name}.wav  {len(x)/SR*1000:.0f} ms')
