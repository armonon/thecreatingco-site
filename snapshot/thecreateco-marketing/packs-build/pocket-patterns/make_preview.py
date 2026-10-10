#!/usr/bin/env python3
"""Render preview.png: a clean step-grid visualization of all 8 patterns'
kick/snare/hat rows, with pattern names as labels. Uses PIL only (no SVG
rasterizer available on this Mac)."""

import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "all-patterns.json")) as f:
    patterns = json.load(f)

W, H = 1200, 630
BG = (18, 18, 20)
FG = (235, 235, 230)
MUTED = (120, 120, 126)
ACCENT_KICK = (214, 179, 109)   # matches Pocket's kick color
ACCENT_SNARE = (255, 138, 128)  # matches Pocket's snare color
ACCENT_HAT = (159, 216, 255)    # matches Pocket's hat color
CELL_OFF = (40, 40, 44)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


title_font = font(34, bold=True)
sub_font = font(16)
name_font = font(20, bold=True)
tag_font = font(13)

# Header
draw.text((48, 36), "Pocket Starter Patterns", font=title_font, fill=FG)
draw.text((48, 80), "8 original 16-step grooves for thecreateco's Pocket  —  thecreateco", font=sub_font, fill=MUTED)

# Grid layout: 8 rows, each with name label + 16-step mini-grid x3 rows (kick/snare/hat)
top = 130
row_h = (H - top - 30) / 8
cell = 11
gap = 3
grid_w = 16 * (cell + gap) - gap
label_w = 190
grid_x = 48 + label_w

for i, p in enumerate(patterns):
    ry = top + i * row_h
    name = p["name"]
    bpm = p["bpm"]
    scale = p["scale"]
    draw.text((48, ry + row_h / 2 - 20), name, font=name_font, fill=FG)
    draw.text((48, ry + row_h / 2 + 4), f"{bpm} bpm · {scale}", font=tag_font, fill=MUTED)

    tracks = [
        (p["drums"]["kick"], ACCENT_KICK),
        (p["drums"]["snare"], ACCENT_SNARE),
        (p["drums"]["hat"], ACCENT_HAT),
    ]
    track_h = 9
    track_gap = 3
    block_h = len(tracks) * track_h + (len(tracks) - 1) * track_gap
    by0 = ry + (row_h - block_h) / 2

    for t, (steps, color) in enumerate(tracks):
        y0 = by0 + t * (track_h + track_gap)
        for s, hit in enumerate(steps):
            x0 = grid_x + s * (cell + gap)
            fill = color if hit else CELL_OFF
            draw.rectangle([x0, y0, x0 + cell, y0 + track_h], fill=fill)
            if s % 4 == 0 and t == 0:
                draw.line([x0 - 1, by0 - 2, x0 - 1, by0 + block_h + 2], fill=(55, 55, 60), width=1)

    if i < len(patterns) - 1:
        draw.line([48, ry + row_h - 4, W - 48, ry + row_h - 4], fill=(32, 32, 36), width=1)

# Legend
leg_y = H - 24
lx = grid_x
for label, color in [("kick", ACCENT_KICK), ("snare", ACCENT_SNARE), ("hat", ACCENT_HAT)]:
    draw.rectangle([lx, leg_y, lx + 12, leg_y + 12], fill=color)
    draw.text((lx + 18, leg_y - 2), label, font=tag_font, fill=MUTED)
    lx += 90

draw.text((W - 220, leg_y - 2), "sattarimusic.com/studio/pocket", font=tag_font, fill=MUTED)

out_path = os.path.join(HERE, "preview.png")
img.save(out_path)
print(f"Saved {out_path} ({img.size[0]}x{img.size[1]})")
