"""Drum-hit and downbeat features for the v2 video (writes src/data/features.json).

Run from the video/ directory after analysis/beats.py.
"""
import json

import librosa
import numpy as np

AUDIO = "public/song.mp3"
SR, HOP = 22050, 256

y, _ = librosa.load(AUDIO, sr=SR, mono=True)
# Percussive component keeps vocals' sibilance out of the snare band.
_, y_perc = librosa.effects.hpss(y, margin=(1.0, 3.0))
S = np.abs(librosa.stft(y_perc, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)


def band_flux(lo, hi):
    band = np.log1p(100 * S[(freqs >= lo) & (freqs < hi)])
    flux = np.maximum(0, np.diff(band, axis=1)).mean(axis=0)
    flux = np.concatenate([[0.0], flux])
    return flux / (np.percentile(flux, 99.5) + 1e-9)


def hits(env, delta):
    frames = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=12, post_avg=12,
                                    delta=delta, wait=int(0.12 * SR / HOP))
    times = librosa.frames_to_time(frames, sr=SR, hop_length=HOP)
    return [{"t": round(float(t), 3), "s": round(float(min(1.0, env[f])), 3)} for t, f in zip(times, frames)]


kick_env = band_flux(30, 160)
snare_env = band_flux(1200, 6000)
kicks = hits(kick_env, 0.15)
snares = hits(snare_env, 0.15)

beats = np.array(json.load(open("src/data/beats.json"))["beats"])
idx = np.clip((beats * SR / HOP).astype(int), 0, len(kick_env) - 1)
k_at = np.array([kick_env[max(0, i - 2):i + 3].max() for i in idx])
s_at = np.array([snare_env[max(0, i - 2):i + 3].max() for i in idx])
# Downbeat = phase with strong kicks on beat 1 and snares on beats 2 and 4.
scores = [float(k_at[p::4].mean() + 0.5 * (s_at[p + 1::4].mean() + s_at[p + 3::4].mean()) - 0.5 * s_at[p::4].mean())
          for p in range(4)]
phase = int(np.argmax(scores))

json.dump({"downbeatPhase": phase, "downbeats": [round(float(b), 3) for b in beats[phase::4]],
           "kicks": kicks, "snares": snares}, open("src/data/features.json", "w"))
print("phase", phase, "scores", [round(s, 3) for s in scores], "kicks", len(kicks), "snares", len(snares))
