"""Beat grid and loudness envelopes (writes src/data/beats.json). Run from video/."""
import json

import librosa
import numpy as np

AUDIO = "public/song.mp3"

y, sr = librosa.load(AUDIO, sr=22050, mono=True)
dur = len(y) / sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", trim=False)
rms = librosa.feature.rms(y=y)[0]
rms_t = librosa.times_like(rms, sr=sr)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(freqs >= 40) & (freqs <= 140)].sum(axis=0)
low = low / (low.max() + 1e-9)
low_t = librosa.frames_to_time(np.arange(len(low)), sr=sr, hop_length=512)


def resample(t, v, hz=20):
    grid = np.arange(0, dur, 1 / hz)
    return np.interp(grid, t, v).tolist()


json.dump({
    "duration": dur,
    "tempo": float(np.atleast_1d(tempo)[0]),
    "beats": [float(b) for b in beats],
    "energy_hz": 20,
    "rms": resample(rms_t, rms / (rms.max() + 1e-9)),
    "low": resample(low_t, low),
}, open("src/data/beats.json", "w"))
print("duration", round(dur, 2), "tempo", float(np.atleast_1d(tempo)[0]), "beats", len(beats))
