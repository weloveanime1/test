# Arise, My Heart — kinetic typography lyric video

Beat- and word-synced typographic music video for the Suno track *Sung Jinwoo × Cha Hae-In*.
Built with [Remotion](https://remotion.dev) (React → MP4), driven by data extracted from the audio.

## Pipeline

1. **Beat / energy analysis** – `analysis/beats.py` (librosa): tempo (≈92 BPM), 399 beat timestamps,
   RMS loudness and 40–140 Hz kick energy sampled at 20 Hz → `src/data/beats.json`.
2. **Word-level alignment** – `analysis/align.py` (stable-ts + faster-whisper, CPU int8):
   forced-aligns the lyric sheet to the vocal section-by-section inside time windows taken from a free
   transcription (`analysis/transcribe.py`) → `src/data/lines.json` (93 lines, every word timed).
   Suno inserted an early chorus at 0:16–0:36 and re-ordered the outro; `analysis/lyrics.txt` reflects what was sung.
3. **Render** – `src/` Remotion composition, 1920×1080 @ 30 fps.

## How the visuals follow the music

| Signal | Visual |
|---|---|
| Word start time | Word pops in (back-eased scale + rotate), glows while sung |
| Beat grid | Text scale pulse, shock ring, 4-step beat meter, HUD glow |
| Kick energy | Core glow breathes, text shake on hard hits, particle brightness |
| Section | Palette + typeface: spoken = Cinzel, verse = Anton, chorus/final = Bebas Neue; violet → blue → rose → red/gold → gold |
| Keywords | "shadow/monarch/arise/..." in section accent, "she/her/Cha Hae-In" in gold |
| "Arise" | Expanding ring shockwave on every occurrence |
| Lyric "System popped up" | Solo-Leveling style notification window |
| Song progress | LV. counter (one level per line), progress bar, timecode |

## Run

```bash
npm install
cp "<song>.mp3" public/song.mp3
npx remotion studio          # live preview
npx remotion render src/index.ts LyricVideo out/arise-my-heart.mp4 --codec h264 --crf 18
```

Re-analysis (optional, needs Python 3.12 + `uv`):

```bash
uv venv .venv && source .venv/bin/activate
uv pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchaudio stable-ts faster-whisper librosa soundfile
ffmpeg -i public/song.mp3 -ac 1 -ar 16000 /tmp/song.wav
python analysis/beats.py && python analysis/align.py   # writes src/data/*.json
```
