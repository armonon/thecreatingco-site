# MANIFEST -- thecreateco LUT Pack

Nine 33^3 `.cube` 3D LUTs, built from original, parameterized color-grading
math (3x3 channel matrices, per-channel tone curves, luma-preserving
saturation, split toning, hue-dependent pushes). No third-party LUTs, no
scraped content -- thecreateco owns this outright.

## Looks

| Look | File | Description | Size |
|---|---|---|---|
| Warm Film | `cubes/warm-film.cube` | Gentle warm color-matrix push with lifted shadows and a soft S-curve, like a sun-warmed print. | 737 KB |
| Cool Night | `cubes/cool-night.cube` | Blue-leaning matrix with deepened shadows and a cooled highlight rolloff for night and blue-hour footage. | 737 KB |
| Bleach Bypass | `cubes/bleach-bypass.cube` | Silver-retention style skip: desaturated, high-contrast, with a cool steel cast and punched highlights. | 737 KB |
| Faded Matte | `cubes/faded-matte.cube` | Low-contrast matte finish: lifted black floor, rolled highlights, and gently muted color. | 737 KB |
| Teal & Orange | `cubes/teal-orange.cube` | Hue-targeted push toward teal shadows and orange skin/highlights with a confident contrast curve. | 737 KB |
| Mono Contrast | `cubes/mono-contrast.cube` | Near-desaturated contrasty black & white with a whisper of warmth retained in the highlights. | 737 KB |
| Golden Hour | `cubes/golden-hour.cube` | Warm matrix skew toward amber with lifted shadow glow and a gentle highlight bloom. | 737 KB |
| Soft Pastel | `cubes/soft-pastel.cube` | Airy low-contrast pastel grade: lifted blacks, gentle desaturation, and a cool-pink highlight tint. | 737 KB |
| Deep Shadow | `cubes/deep-shadow.cube` | Crushed, inky blacks with a protected, gently rolled highlight for a dense, graphic contrast look. | 737 KB |

## License

**CC BY 4.0 thecreateco.** Free to use, modify, and redistribute in your own
work, including commercial projects, with attribution to thecreateco
(https://thecreatingco.com). No attribution needed in the graded footage or
final output itself -- just don't resell the LUT files as your own pack.

## Format

33x33x33 (33^3) 3D LUT, standard `.cube` text format (Adobe/DaVinci spec:
`TITLE`, `LUT_3D_SIZE`, `DOMAIN_MIN`/`DOMAIN_MAX` header, then 35,937
whitespace-separated RGB triples in [0, 1], red fastest). Values are written
to 4 decimal places -- well past the precision a monitor or export codec can
show, and well under the file size of full 6-decimal exports. See
`VALIDATE.md` for the full check.

## Pack contents and size

| Item | Size |
|---|---|
| `cubes/` (9 LUT files) | ~6.5 MB on disk (plain text; compresses to ~2.1 MB in the zip) |
| `previews/` (test chart + 9 graded PNGs) | ~30 KB |
| `contact-sheet.png` | ~45 KB |
| `hero-preview.png` | ~85 KB |
| `thecreateco-lut-pack.zip` (cubes + docs, the shippable download) | see below |

LUT text files are inherently large as plain text (35,937 lines each), so the
working folder is a few megabytes -- but the actual download,
`thecreateco-lut-pack.zip`, is compressed and comes to **2.13 MB** (2,233,806
bytes), well under the 5 MB target.
