#!/usr/bin/env python3
"""Render a specimen PNG of all 85 Pocket Grotesk characters from the compiled
TTF (real rasterization via FreeType/PIL, not a preview of the outlines), so
bugs in the actual shipped font — not just the SVG preview — are visible."""
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/Users/agentsattari/thecreateco-marketing/packs-build/font/PocketGrotesk-Regular.ttf"
OUT_PATH = "/Users/agentsattari/thecreateco-marketing/packs-build/font/specimen.png"

UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
LOWER = "abcdefghijklmnopqrstuvwxyz"
DIGITS = "0123456789"
PUNCT = ".,;:!?'\"-()&@#/*+=%$_[]"
GROUPS = [("Uppercase", UPPER), ("Lowercase", LOWER), ("Figures", DIGITS), ("Punctuation", PUNCT)]
ALL_CHARS = UPPER + LOWER + DIGITS + PUNCT
assert len(ALL_CHARS) == 85, len(ALL_CHARS)

CELL = 130
COLS = 13
BG = (255, 255, 255)
INK = (17, 17, 20)
MUTED = (140, 140, 148)
GRID = (228, 228, 232)

glyph_font = ImageFont.truetype(FONT_PATH, 84)
label_font = ImageFont.truetype(FONT_PATH if False else "/System/Library/Fonts/Helvetica.ttc", 14)
title_font = ImageFont.truetype(FONT_PATH, 72)
tester_font = ImageFont.truetype(FONT_PATH, 40)
section_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)

rows_total = sum(-(-len(chars) // COLS) for _, chars in GROUPS)
header_h = 170
section_h = 40
grid_h = rows_total * CELL
tester_lines = ["The quick brown fox jumps over the lazy dog", "Pocket Grotesk: & @ R n h m u / 0123456789"]
tester_h = 40 + len(tester_lines) * 70
W = COLS * CELL + 80
H = header_h + len(GROUPS) * section_h + grid_h + tester_h + 60

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

x0 = 40
y = 50
d.text((x0, y), "Pocket Grotesk", font=title_font, fill=INK)
y += 90
d.text((x0, y), "A FREE MONOLINE DISPLAY FONT FROM THECREATECO — 85 CHARACTERS", font=section_font, fill=MUTED)
y += 40
d.line([(x0, y), (W - x0, y)], fill=GRID, width=2)
y += 20

for label, chars in GROUPS:
    d.text((x0, y), label.upper(), font=section_font, fill=MUTED)
    y += section_h
    for i, ch in enumerate(chars):
        cx = x0 + (i % COLS) * CELL
        cy = y + (i // COLS) * CELL
        d.rectangle([cx, cy, cx + CELL - 6, cy + CELL - 6], outline=GRID, width=1)
        bbox = d.textbbox((0, 0), ch, font=glyph_font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((cx + (CELL - 6 - tw) / 2 - bbox[0], cy + (CELL - 6 - th) / 2 - bbox[1]), ch, font=glyph_font, fill=INK)
    rows = -(-len(chars) // COLS)
    y += rows * CELL + 10

y += 10
d.line([(x0, y), (W - x0, y)], fill=GRID, width=2)
y += 30
for line in tester_lines:
    d.text((x0, y), line, font=tester_font, fill=INK)
    y += 70

img.save(OUT_PATH)
print("saved", img.size, "->", OUT_PATH)
