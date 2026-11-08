#!/usr/bin/env bash
# Chunked, resumable render that survives tool timeouts.
# Usage: render_chunks.sh <composition> <fps> <name> [chunk_frames]   (CONC env sets concurrency)
set -u
cd "$(dirname "$0")"
COMP=${1:-LyricVideoV2}; FPS=${2:-60}; NAME=${3:-arise-my-heart-v2}; CHUNK=${4:-900}
TOTAL=$(node -e "const b=require('./src/data/beats.json');console.log(Math.ceil(b.duration*$FPS)+2*$FPS)")
DIR="out/$NAME-parts"; LOG="out/$NAME.log"
mkdir -p "$DIR"
echo "total $TOTAL frames, chunk $CHUNK, start $(date +%T)" >> "$LOG"
npx remotion bundle src/index.ts --out-dir build --log=error >> "$LOG" 2>&1 || { echo "BUNDLE FAILED" >> "$LOG"; exit 1; }
start=0
while [ "$start" -lt "$TOTAL" ]; do
  end=$(( start + CHUNK - 1 )); [ "$end" -ge "$TOTAL" ] && end=$(( TOTAL - 1 ))
  part=$(printf '%s/part_%06d.mp4' "$DIR" "$start")
  if [ ! -s "$part.done" ]; then
    npx remotion render build "$COMP" "$part" --frames="$start-$end" --muted --codec h264 --crf 20 --concurrency "${CONC:-2}" --log=error >> "$LOG" 2>&1 \
      && echo ok > "$part.done" && echo "chunk $start-$end done $(date +%T)" >> "$LOG" \
      || { echo "chunk $start-$end FAILED $(date +%T)" >> "$LOG"; exit 1; }
  fi
  start=$(( end + 1 ))
done
(cd "$DIR" && ls part_*.mp4 | sort | sed "s/^/file '/;s/$/'/" > list.txt)
# apad keeps the title-card tail after the song ends.
ffmpeg -loglevel error -y -f concat -safe 0 -i "$DIR/list.txt" -c copy "out/$NAME-video.mp4" \
  && ffmpeg -loglevel error -y -i "out/$NAME-video.mp4" -i public/song.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -af apad -shortest -movflags +faststart "out/$NAME.mp4" \
  && echo "FINAL DONE $(date +%T)" >> "$LOG" || echo "MUX FAILED" >> "$LOG"
