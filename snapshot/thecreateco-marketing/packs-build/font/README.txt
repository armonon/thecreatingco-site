Pocket Grotesk
==============
A free, original monoline display typeface from thecreateco, drawn and
compiled entirely with Glyph's own font engine (no outside foundry tools).

What's in this zip
-------------------
  PocketGrotesk-Regular.otf   CFF outlines (opentype.js compiler)
  PocketGrotesk-Regular.ttf   TrueType outlines, incl. a legacy "kern" table
  specimen.png                full specimen: all 85 characters + a type tester
  OFL.txt                     license (SIL Open Font License 1.1)
  README.txt                  this file

Character set (85 glyphs + space)
----------------------------------
  Uppercase     A-Z
  Lowercase     a-z
  Figures       0-9 (lining)
  Punctuation   . , ; : ! ? ' " - ( ) & @ # / * + = % $ _ [ ]

Design
------
Single-weight monoline construction: every stroke is the same skeleton
width, offset into round-capped outlines and unioned into solid contours
(no bezier hand-drawing — every curve is generated from arcs/polylines by
the same code that drives Glyph's canvas). Diagonal strokes that read
optically thin at the same literal width (e.g. R's leg) are deliberately
widened; round joins (the arches of n/h/m, the cup of u, every bowl)
overshoot the cap/x-height/baseline by a small constant for optical
alignment, same convention Glyph Studio uses throughout.

License
-------
SIL Open Font License, Version 1.1. Copyright 2026 thecreateco
(https://thecreatingco.com). Free to use, modify and redistribute per the
OFL — see OFL.txt. The font may not be sold by itself.

Made with Glyph, thecreateco's font editor: https://glyph-studio-610.netlify.app
