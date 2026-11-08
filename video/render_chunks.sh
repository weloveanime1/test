#!/usr/bin/env bash
# Chunked render: survives tool timeouts, resumable. Usage: render_chunks.sh [chunk_frames]
set -u
cd "$(dirname "$0")"
CHUNK=${1:-600}
TOTAL=$(node -e "const b=require('./src/data/beats.json');console.log(Math.ceil(b.duration*30)+60)")
mkdir -p out/parts
echo "total frames $TOTAL chunk $CHUNK start $(date +%T)" >> out/chunks.log
start=0
while [ "$start" -lt "$TOTAL" ]; do
  end=$(( start + CHUNK - 1 )); [ "$end" -ge "$TOTAL" ] && end=$(( TOTAL - 1 ))
  part=$(printf 'out/parts/part_%05d.mp4' "$start")
  if [ ! -s "$part.done" ]; then
    npx remotion render src/index.ts LyricVideo "$part" --frames="$start-$end" --muted --codec h264 --crf 18 --concurrency 2 --log=error >> out/chunks.log 2>&1 \
      && echo ok > "$part.done" && echo "chunk $start-$end done $(date +%T)" >> out/chunks.log \
      || { echo "chunk $start-$end FAILED $(date +%T)" >> out/chunks.log; exit 1; }
  fi
  start=$(( end + 1 ))
done
ls out/parts/part_*.mp4 | sort | sed "s/^/file '/;s/$/'/" | sed "s#out/parts/##" > out/parts/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i out/parts/list.txt -c copy out/video_only.mp4 \
  && ffmpeg -loglevel error -y -i out/video_only.mp4 -i public/song.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/arise-my-heart.mp4 \
  && echo "FINAL DONE $(date +%T)" >> out/chunks.log || echo "MUX FAILED" >> out/chunks.log
