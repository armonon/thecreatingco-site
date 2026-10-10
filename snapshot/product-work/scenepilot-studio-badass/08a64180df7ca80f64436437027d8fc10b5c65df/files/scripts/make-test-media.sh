#!/usr/bin/env bash
# Generate deterministic test media for verifying the montage pipeline.
# A 12s / 120 BPM "song" (kick every 0.5s, louder 4-8s so section energy varies)
# plus three solid-colour clips, so montage cuts are obvious when sampling the
# rendered MP4's pixels. Requires ffmpeg.
set -euo pipefail
OUT="${1:-./test-media}"
mkdir -p "$OUT"

ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=60:duration=12" -af "
volume='if(lt(mod(t,0.5),0.09), 1.0, 0.02)':eval=frame,
volume='if(between(t,4,8), 1.8, 0.7)':eval=frame
" -c:a aac -b:a 128k "$OUT/song.m4a"

ffmpeg -y -loglevel error -f lavfi -i "color=c=black:s=640x360:d=12:r=30" -i "$OUT/song.m4a" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT/source.mp4"

for c in red green blue; do
  ffmpeg -y -loglevel error -f lavfi -i "color=c=$c:s=640x360:d=6:r=30" \
    -c:v libx264 -pix_fmt yuv420p "$OUT/clip-$c.mp4"
done

# Silent, low-detail footage must still produce a scene-following draft. Its
# boundaries are exactly 2s and 4s; quality-ranked "clean selects" may reject it.
ffmpeg -y -loglevel error -i "$OUT/clip-blue.mp4" -i "$OUT/clip-green.mp4" -i "$OUT/clip-red.mp4" \
  -filter_complex '[0:v]trim=duration=2,setpts=PTS-STARTPTS[a];[1:v]trim=duration=2,setpts=PTS-STARTPTS[b];[2:v]trim=duration=2,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[v]' \
  -map '[v]' -c:v libx264 -pix_fmt yuv420p "$OUT/silent-scenes.mp4"

echo "Test media written to $OUT"
