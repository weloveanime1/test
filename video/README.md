# Arise, My Heart — kinetic typography lyric video

Beat- and word-synced typographic music video for the Suno track *Sung Jinwoo × Cha Hae-In*.
Built with [Remotion](https://remotion.dev) (React → MP4), driven by data extracted from the audio.

Two compositions:

| ID | Format | Look |
|---|---|---|
| `LyricVideoV2` | 1920×1080 @ 60 fps | Justified block typography, Solo Leveling story set pieces (main version) |
| `LyricVideo` | 1920×1080 @ 30 fps | First version: centered lines, word pops, HUD |

## Pipeline

1. **Beat / energy analysis** – `analysis/beats.py` (librosa): tempo (≈92 BPM), beat grid, RMS loudness and
   40–140 Hz kick energy at 20 Hz → `src/data/beats.json`.
2. **Drum hits** – `analysis/features.py`: HPSS percussive split, band-limited onset peaks for kicks and snares,
   downbeat phase → `src/data/features.json`.
3. **Word-level alignment** – `analysis/align.py` (stable-ts + faster-whisper, CPU int8) forced-aligns
   `analysis/lyrics.txt` section-by-section → `src/data/lines.json` (93 lines, every word timed).
   Suno added an early chorus at 0:16–0:36 and reordered the outro; the lyric sheet reflects what was sung.
4. **Typographic layout** – `tools/layout.cjs` splits each line into phrase blocks (dynamic programming over
   punctuation and function words), then picks row breaks so every row is justified to the same width using real
   font metrics (fontkit), emphasizing content words → `src/data/layout.json` (also all story cue times).
5. **Textures** – `analysis/textures.py`: tileable smoke masks and film grain → `public/tex/`.
6. **Render** – `render_chunks.sh` renders resumable chunks and muxes the audio.

## v2 visual language

| Music / lyric | Visual |
|---|---|
| Each sung word | Slides up from behind its baseline (mask reveal) over a faint outline of the phrase |
| Verse / chorus / spoken | Anton blocks · Bebas Neue anthem blocks over a rotating Gate portal · Cinzel cinematic lines with letterbox |
| Kicks, snares, downbeats | Block punch-zoom, chromatic aberration, portal pulse, beat meter |
| Section changes | Impact frames (invert + flash + shake) on every chorus, chapter cards on verses |
| "Cha Hae-In", she/her | Gold; name card with "S-RANK HUNTER" |
| "System popped up…" | Player notification window (YES selects on "accept") |
| "Hundred push-ups…" | Daily Quest counters filling with the words |
| "Level up…" | LEVEL UP window, LONELINESS +99 |
| "S-rank, swordsman" | Sword slash across the frame |
| "Jeju Island" | Location stamp |
| "the war went quiet… paused the apocalypse" | Time freeze: particles stop, frame desaturates |
| "turn the clock back / Rewind" | VHS rewind, particles and timecode run backwards |
| "no System" | HUD glitches out until the final chorus restores it (LV. MAX, Shadow Monarch) |
| "Erase my name" | Line is wiped away |
| "save file… loading it. Every. Single. Life." | Save-file loading bar hitting 100% on "Life" |

## Run

```bash
npm install
cp "<song>.mp3" public/song.mp3
npx remotion studio                                   # live preview
./render_chunks.sh LyricVideoV2 60 arise-my-heart-v2  # → out/arise-my-heart-v2.mp4
tools/stills.sh LyricVideoV2 60 16.5 56.9 217.9       # quick review stills → out/stills/
```

Re-analysis (optional, Python 3.12 + `uv`):

```bash
uv venv .venv && source .venv/bin/activate
uv pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchaudio stable-ts faster-whisper librosa soundfile pillow
ffmpeg -i public/song.mp3 -ac 1 -ar 16000 /tmp/song.wav
python analysis/beats.py && python analysis/align.py && python analysis/features.py && python analysis/textures.py
node tools/layout.cjs
```
