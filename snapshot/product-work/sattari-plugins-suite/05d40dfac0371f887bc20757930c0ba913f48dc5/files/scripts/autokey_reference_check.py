#!/usr/bin/env python3
"""Compare Auto Pitch AutoKey output against a reference-key CSV.

CSV columns:
  id,audio_path,expected_key,expected_mode,source

`source` is free text, e.g. "Tunebat", "fixture", or "manual".
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOTE_NAMES = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
MODE_NAMES = {"major", "minor", "chromatic"}
STATUS_RE = re.compile(r"\bAutoKey\s+([A-G](?:#)?)\s+(major|minor|chromatic)\b", re.IGNORECASE)


def normalise_note(value: str) -> str:
    note = value.strip().replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#")
    if note not in NOTE_NAMES:
        raise ValueError(f"unsupported key {value!r}")
    return note


def normalise_mode(value: str) -> str:
    mode = value.strip().lower()
    if mode in {"maj", "major"}:
        return "major"
    if mode in {"min", "minor"}:
        return "minor"
    if mode in {"chromatic", "chrom"}:
        return "chromatic"
    raise ValueError(f"unsupported mode {value!r}")


def resolve_audio(path_text: str, csv_path: Path) -> Path:
    path = Path(path_text).expanduser()
    if not path.is_absolute():
        path = (csv_path.parent / path).resolve()
    return path


def run_case(row: dict[str, str], csv_path: Path, bench: Path, out_dir: Path) -> dict[str, object]:
    case_id = row["id"].strip()
    expected_key = normalise_note(row["expected_key"])
    expected_mode = normalise_mode(row["expected_mode"])
    audio_path = resolve_audio(row["audio_path"], csv_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"{case_id}: audio not found: {audio_path}")

    case_dir = out_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    trace_path = case_dir / "autokey_trace.json"

    cmd = [
        str(bench),
        str(audio_path),
        "--trace",
        str(trace_path),
        "--key",
        "C",
        "--scale",
        expected_mode,
        "--style",
        "Natural",
        "--amount",
        "0",
        "--speed",
        "0.7",
        "--block",
        "512",
        "--auto-key",
    ]
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=False)

    detected_key = ""
    detected_mode = ""
    status = ""
    if trace_path.exists():
        trace = json.loads(trace_path.read_text())
        status = str(trace.get("processorStatus", ""))
        match = STATUS_RE.search(status)
        if match:
            detected_key = normalise_note(match.group(1).upper())
            detected_mode = normalise_mode(match.group(2))

    passed = result.returncode == 0 and detected_key == expected_key and detected_mode == expected_mode
    return {
        "id": case_id,
        "source": row.get("source", ""),
        "audio_path": str(audio_path),
        "expected_key": expected_key,
        "expected_mode": expected_mode,
        "detected_key": detected_key,
        "detected_mode": detected_mode,
        "processor_status": status,
        "returncode": result.returncode,
        "stderr": result.stderr.strip(),
        "trace": str(trace_path),
        "pass": passed,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path)
    parser.add_argument("--bench", type=Path, default=ROOT / "build/plugins/auto-pitch/AutoPitchBench")
    parser.add_argument("--out", type=Path, default=ROOT / "validation/autokey_reference/results")
    args = parser.parse_args()

    csv_path = args.csv.expanduser().resolve()
    bench = args.bench.expanduser().resolve()
    out_dir = args.out.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = list(csv.DictReader(csv_path.read_text().splitlines()))
    required = {"id", "audio_path", "expected_key", "expected_mode"}
    missing = required - set(rows[0].keys() if rows else [])
    if missing:
        raise SystemExit(f"missing CSV columns: {', '.join(sorted(missing))}")

    results = [run_case(row, csv_path, bench, out_dir) for row in rows]
    (out_dir / "autokey_reference_results.json").write_text(json.dumps(results, indent=2) + "\n")

    writer_path = out_dir / "autokey_reference_results.csv"
    with writer_path.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id", "source", "expected_key", "expected_mode", "detected_key",
                "detected_mode", "pass", "processor_status", "trace",
            ],
        )
        writer.writeheader()
        for row in results:
            writer.writerow({key: row.get(key, "") for key in writer.fieldnames})

    for row in results:
        verdict = "PASS" if row["pass"] else "FAIL"
        print(f"{verdict} {row['id']}: expected {row['expected_key']} {row['expected_mode']}, got {row['detected_key']} {row['detected_mode']}")

    return 0 if all(row["pass"] for row in results) else 1


if __name__ == "__main__":
    sys.exit(main())
