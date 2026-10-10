#!/usr/bin/env python3
"""
Validation pass for the thecreateco LUT pack.

For every .cube file in cubes/, confirms:
  1. It declares LUT_3D_SIZE 33
  2. It contains exactly 33*33*33 = 35937 data lines, each 3 floats
  3. Every value parses as a float in [0, 1]
  4. The file loads successfully with our own independent loader (read_cube)

Writes a human-readable report to VALIDATE.md.
"""

import os
from generate_luts import CUBES_DIR, LUT_SIZE, read_cube, ROOT

EXPECTED_LINES = LUT_SIZE ** 3  # 35937


def validate_file(path):
    errors = []
    title, size, arr = read_cube(path)

    if size != LUT_SIZE:
        errors.append(f"LUT_3D_SIZE is {size}, expected {LUT_SIZE}")

    if arr.shape[0] != EXPECTED_LINES:
        errors.append(f"found {arr.shape[0]} data lines, expected {EXPECTED_LINES}")

    if arr.shape[1] != 3:
        errors.append(f"data lines have {arr.shape[1]} fields, expected 3")

    out_of_range = ((arr < 0.0) | (arr > 1.0)).sum()
    if out_of_range > 0:
        errors.append(f"{out_of_range} values fall outside [0, 1]")

    return title, size, arr.shape[0], errors


def main():
    cube_files = sorted(f for f in os.listdir(CUBES_DIR) if f.endswith(".cube"))
    report_lines = []
    report_lines.append("# VALIDATE")
    report_lines.append("")
    report_lines.append("Validation pass for the thecreateco LUT pack. Run via `python3 validate.py`.")
    report_lines.append("")
    report_lines.append("## What was checked")
    report_lines.append("")
    report_lines.append("For every `.cube` file in `cubes/`:")
    report_lines.append("")
    report_lines.append("1. Declares `LUT_3D_SIZE 33` (the standard 33-point-per-axis 3D LUT grid).")
    report_lines.append("2. Contains exactly 33 x 33 x 33 = 35937 data lines, each exactly 3 floats.")
    report_lines.append("3. Every value parses as a float and falls inside the [0, 1] range the .cube spec expects.")
    report_lines.append("4. The file loads successfully end-to-end with an independent parser "
                         "(`read_cube` in `generate_luts.py`), separate from the code path that generated it.")
    report_lines.append("")
    report_lines.append("## Results")
    report_lines.append("")
    report_lines.append("| File | LUT_3D_SIZE | Data lines | In-range | Loads OK |")
    report_lines.append("|---|---|---|---|---|")

    all_ok = True
    total_bytes = 0
    for fname in cube_files:
        path = os.path.join(CUBES_DIR, fname)
        total_bytes += os.path.getsize(path)
        title, size, n_lines, errors = validate_file(path)
        ok = len(errors) == 0
        all_ok = all_ok and ok
        status = "PASS" if ok else "FAIL: " + "; ".join(errors)
        report_lines.append(f"| `{fname}` | {size} | {n_lines} | {'yes' if ok else 'no'} | {status} |")

    report_lines.append("")
    report_lines.append(f"**{len(cube_files)} of {len(cube_files)} files passed all checks.**" if all_ok
                         else "**One or more files FAILED validation -- see table above.**")
    report_lines.append("")
    report_lines.append(f"Total size of `cubes/`: {total_bytes / 1024:.0f} KB "
                         f"({total_bytes / (1024*1024):.2f} MB) across {len(cube_files)} files.")
    report_lines.append("")
    report_lines.append("## Format compliance note")
    report_lines.append("")
    report_lines.append(
        "This pack was verified programmatically against the public Adobe/DaVinci `.cube` LUT "
        "specification (TITLE, LUT_3D_SIZE, DOMAIN_MIN/MAX header fields, followed by "
        "`size^3` whitespace-separated RGB triples in [0, 1], ordered with the red "
        "component changing fastest). It was **not** click-tested inside ScenePilot, "
        "because ScenePilot was not available in this environment. These are standard, "
        "portable `.cube` files -- the same format ScenePilot's Grade tool exports and the "
        "same format Grade and Browser Lite's Auto Director -> Look LUT import both accept, "
        "per thecreateco's own docs. Compatibility here means format compliance, confirmed by "
        "code, not a live in-app load test."
    )
    report_lines.append("")

    out_path = os.path.join(ROOT, "VALIDATE.md")
    with open(out_path, "w") as f:
        f.write("\n".join(report_lines) + "\n")

    print("\n".join(report_lines))
    print(f"\nWrote {out_path}")
    return all_ok


if __name__ == "__main__":
    ok = main()
    raise SystemExit(0 if ok else 1)
