# VALIDATE

Validation pass for the thecreateco LUT pack. Run via `python3 validate.py`.

## What was checked

For every `.cube` file in `cubes/`:

1. Declares `LUT_3D_SIZE 33` (the standard 33-point-per-axis 3D LUT grid).
2. Contains exactly 33 x 33 x 33 = 35937 data lines, each exactly 3 floats.
3. Every value parses as a float and falls inside the [0, 1] range the .cube spec expects.
4. The file loads successfully end-to-end with an independent parser (`read_cube` in `generate_luts.py`), separate from the code path that generated it.

## Results

| File | LUT_3D_SIZE | Data lines | In-range | Loads OK |
|---|---|---|---|---|
| `bleach-bypass.cube` | 33 | 35937 | yes | PASS |
| `cool-night.cube` | 33 | 35937 | yes | PASS |
| `deep-shadow.cube` | 33 | 35937 | yes | PASS |
| `faded-matte.cube` | 33 | 35937 | yes | PASS |
| `golden-hour.cube` | 33 | 35937 | yes | PASS |
| `mono-contrast.cube` | 33 | 35937 | yes | PASS |
| `soft-pastel.cube` | 33 | 35937 | yes | PASS |
| `teal-orange.cube` | 33 | 35937 | yes | PASS |
| `warm-film.cube` | 33 | 35937 | yes | PASS |

**9 of 9 files passed all checks.**

Total size of `cubes/`: 6634 KB (6.48 MB) across 9 files.

## Format compliance note

This pack was verified programmatically against the public Adobe/DaVinci `.cube` LUT specification (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX header fields, followed by `size^3` whitespace-separated RGB triples in [0, 1], ordered with the red component changing fastest). It was **not** click-tested inside ScenePilot, because ScenePilot was not available in this environment. These are standard, portable `.cube` files -- the same format ScenePilot's Grade tool exports and the same format Grade and Browser Lite's Auto Director -> Look LUT import both accept, per thecreateco's own docs. Compatibility here means format compliance, confirmed by code, not a live in-app load test.

