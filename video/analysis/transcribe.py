import soundfile as sf, numpy as np
from faster_whisper import WhisperModel
audio, sr = sf.read("/tmp/song.wav", dtype="float32")
model = WhisperModel("small", device="cpu", compute_type="int8")
segs, info = model.transcribe(audio, language="en", word_timestamps=True, beam_size=3)
for s in segs: print(f"{s.start:7.2f} {s.end:7.2f} {s.text}")
