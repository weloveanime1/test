import json, re, sys, numpy as np, librosa, stable_whisper
AUDIO="/tmp/song.mp3"
# --- beats ---
y, sr = librosa.load(AUDIO, sr=22050, mono=True)
dur = len(y)/sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", trim=False)
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
times = librosa.times_like(onset_env, sr=sr)
rms = librosa.feature.rms(y=y)[0]
rms_t = librosa.times_like(rms, sr=sr)
# low-band (kick) energy for pulses
y_low = librosa.effects.preemphasis(y, coef=-0.97)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(freqs>=40)&(freqs<=140)].sum(axis=0)
low = low/ (low.max()+1e-9)
low_t = librosa.frames_to_time(np.arange(len(low)), sr=sr, hop_length=512)
# downsample energy curves to 20Hz for the video
def resample(t, v, hz=20):
    grid = np.arange(0, dur, 1/hz)
    return grid.tolist(), np.interp(grid, t, v).tolist()
g, rms_r = resample(rms_t, rms/ (rms.max()+1e-9))
_, low_r = resample(low_t, low)
print("duration", dur, "tempo", float(np.atleast_1d(tempo)[0]), "beats", len(beats))
json.dump({"duration":dur,"tempo":float(np.atleast_1d(tempo)[0]),"beats":[float(b) for b in beats],
           "energy_hz":20,"rms":rms_r,"low":low_r}, open("beats.json","w"))
# --- lyrics alignment ---
raw = open("lyrics.txt").read()
sections=[]; cur=None; lines=[]
for ln in raw.splitlines():
    m = re.match(r"\[(.+)\]", ln.strip())
    if m: cur=m.group(1); continue
    if ln.strip(): lines.append((cur, ln.strip()))
text = "\n".join(l for _,l in lines)
model = stable_whisper.load_faster_whisper("small", device="cpu", compute_type="int8")
res = model.align(AUDIO, text, language="en", original_split=True)
res.save_as_json("align.json")
out=[]
segs = res.segments
print("segments", len(segs), "lines", len(lines))
for i, seg in enumerate(segs):
    sec = lines[i][0] if i < len(lines) else None
    out.append({"section":sec,"text":seg.text.strip(),"start":seg.start,"end":seg.end,
                "words":[{"w":w.word.strip(),"s":w.start,"e":w.end,"p":getattr(w,'probability',None)} for w in seg.words]})
json.dump(out, open("lines.json","w"), indent=1)
for o in out: print(f"{o['start']:7.2f} {o['end']:7.2f} [{o['section']}] {o['text'][:60]}")
# --- transcription for sanity check ---
tr = model.transcribe(AUDIO, language="en", word_timestamps=True, vad=True)
tr.save_as_json("transcript.json")
print("--- TRANSCRIPT ---")
for s in tr.segments: print(f"{s.start:7.2f} {s.text}")
