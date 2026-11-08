#!/usr/bin/env bash
# Сборка MP4: кадры (render.js) + саундтрек (music.py) → 1920×1080, 60 fps, H.264 yuv420p, AAC.
# bash build.sh <framesDir> <out.mp4>
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; FR="${1:-frames}"; OUT="${2:-yarkiy-gorod.mp4}"
python3 "$DIR/music.py" "$FR/soundtrack.wav"
ffmpeg -y -hide_banner -loglevel error -framerate 60 -i "$FR/f%05d.jpg" -i "$FR/soundtrack.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -r 60 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t 20 "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,sample_rate,channels,duration -of compact "$OUT"
