#!/usr/bin/env bash
# Renders preview stills at the given times (seconds) and tiles them 2x2 for review.
# Usage: tools/stills.sh <composition> <fps> <t1> [t2 ...]
set -u
cd "$(dirname "$0")/.."
COMP=$1; FPS=$2; shift 2
mkdir -p out/stills
npx remotion bundle src/index.ts --out-dir build --log=error > /dev/null 2>> out/stills/err.log || { echo "bundle failed"; exit 1; }
files=()
for t in "$@"; do
  f=$(node -e "console.log(Math.round($t*$FPS))")
  out="out/stills/${COMP}_${t}.jpg"
  npx remotion still build "$COMP" "$out" --frame="$f" --log=error > /dev/null 2>> out/stills/err.log || echo "still $t failed"
  files+=("$out")
done
i=0; g=0
while [ "$i" -lt "${#files[@]}" ]; do
  grp=("${files[@]:$i:4}")
  while [ "${#grp[@]}" -lt 4 ]; do grp+=("${grp[0]}"); done
  ffmpeg -loglevel error -y -i "${grp[0]}" -i "${grp[1]}" -i "${grp[2]}" -i "${grp[3]}" \
    -filter_complex "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack" \
    "out/stills/grid_$g.jpg"
  echo "grid_$g: ${grp[*]}"
  i=$((i + 4)); g=$((g + 1))
done
