"""
Corpus Bench — runs all 308 neural vocal clips through frozen Auto Pitch
and measures: crashes, NaN/Inf, octave_errors, correction_error,
max_jump_cents, chatter_pct.
"""

import subprocess, wave, struct, math, os, json, sys
from pathlib import Path

BENCH = Path("/Users/agentsattari/code/sattari-plugins-suite/build/plugins/auto-pitch/AutoPitchBench")
CORPUS_DIR = Path(__file__).parent.parent / "corpus" / "neural_vocal"
DRY_DIR    = CORPUS_DIR / "dry"
PROC_DIR   = CORPUS_DIR / "processed"
FAIL_DIR   = CORPUS_DIR / "failures"
OUT_JSON   = CORPUS_DIR / "results.json"
OUT_REPORT = Path(__file__).parent.parent / "validation" / "neural_vocal" / "CORPUS_REPORT.md"

PROC_DIR.mkdir(parents=True, exist_ok=True)
FAIL_DIR.mkdir(parents=True, exist_ok=True)
OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)

MANIFEST = json.loads((CORPUS_DIR / "manifest.json").read_text())


def wav_nan_inf(path):
    with wave.open(str(path), "r") as wf:
        raw = wf.readframes(wf.getnframes())
        sw = wf.getsampwidth()
    if sw != 2:
        return False
    samps = struct.unpack(f"<{len(raw)//2}h", raw)
    return any(math.isnan(v / 32768.0) or math.isinf(v / 32768.0) for v in samps)


def run_clip(clip, key="A", scale="minor", block=256):
    name = clip["name"]
    dry = Path(clip["path"])
    out = PROC_DIR / f"{name}_out.wav"
    tr  = PROC_DIR / f"{name}_trace.json"

    cmd = [str(BENCH), str(dry), "--output", str(out), "--trace", str(tr),
           "--key", key, "--scale", scale, "--amount", "0.82",
           "--speed", "0.7", "--block", str(block), "--intent-mode", "v2_active"]

    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        return {"name": name, "crash": True, "timeout": True, "error": "timeout"}
    except Exception as e:
        return {"name": name, "crash": True, "error": str(e)}

    if r.returncode != 0:
        return {"name": name, "crash": True, "rc": r.returncode, "stderr": r.stderr[:200]}

    nan_inf = out.exists() and wav_nan_inf(out)

    # Parse trace
    metrics = {
        "name": name, "category": clip.get("category", ""),
        "crash": False, "nan_inf": nan_inf,
        "octave_errors": 0, "correction_error_mean": 0.0,
        "max_jump_cents": 0.0, "chatter_pct": 0.0,
        "voiced_frames": 0,
    }

    if not tr.exists():
        return metrics

    try:
        trace = json.loads(tr.read_text())
        frames = trace.get("frames", [])
        voiced = [f for f in frames if f.get("voiced")]
        metrics["voiced_frames"] = len(voiced)

        if voiced:
            corrs = [abs(f.get("correctionCents", 0) or 0) for f in voiced]
            metrics["correction_error_mean"] = round(sum(corrs) / len(corrs), 2)
            metrics["max_jump_cents"] = round(max(corrs), 2)

            # Octave errors: intentTarget vs prod target differs by ≥ 12
            oct_err = sum(
                1 for f in voiced
                if f.get("intentTarget", -1) >= 0
                and f.get("gtIntendedDest") is not None
                and abs(f.get("intentTarget", 0) - (f.get("gtIntendedDest") or 0)) >= 12
            )
            metrics["octave_errors"] = oct_err

            # Chatter: successive frames with different intentTarget
            targets = [f.get("prodTarget", -1) for f in voiced]
            changes = sum(1 for i in range(1, len(targets)) if targets[i] != targets[i-1])
            metrics["chatter_pct"] = round(100 * changes / max(len(targets) - 1, 1), 2)

    except Exception as e:
        metrics["trace_error"] = str(e)

    return metrics


def main():
    results = []
    severe = []
    n = len(MANIFEST)

    for i, clip in enumerate(MANIFEST):
        m = run_clip(clip)
        results.append(m)

        # Flag severe cases
        is_severe = (
            m.get("crash")
            or m.get("nan_inf")
            or m.get("octave_errors", 0) > 0
            or m.get("max_jump_cents", 0) > 350
        )
        if is_severe:
            severe.append(m)
            name = clip["name"]
            # Preserve failure artifacts
            for suffix in ["_out.wav", "_trace.json"]:
                src = PROC_DIR / f"{name}{suffix}"
                dst = FAIL_DIR / f"{name}{suffix}"
                if src.exists():
                    import shutil
                    shutil.copy2(src, dst)

        if (i + 1) % 50 == 0:
            print(f"[CorpusBench] {i+1}/{n} complete  severe={len(severe)}")

    # Aggregate
    crashes   = sum(1 for r in results if r.get("crash"))
    nan_infs  = sum(1 for r in results if r.get("nan_inf"))
    oct_errs  = sum(r.get("octave_errors", 0) for r in results)
    max_jump  = max((r.get("max_jump_cents", 0) for r in results), default=0)
    mean_corr = [r.get("correction_error_mean", 0) for r in results if not r.get("crash")]
    avg_corr  = sum(mean_corr) / len(mean_corr) if mean_corr else 0
    chatter   = [r.get("chatter_pct", 0) for r in results if not r.get("crash")]
    avg_chatter = sum(chatter) / len(chatter) if chatter else 0

    gate = "NEURAL VOCAL CORPUS PASS" if not severe else "NEURAL VOCAL CORPUS HOLD"

    # Save results JSON
    summary = {
        "total": n, "crashes": crashes, "nan_inf": nan_infs,
        "octave_errors": oct_errs, "max_jump_cents": round(max_jump, 2),
        "avg_correction_error": round(avg_corr, 2),
        "avg_chatter_pct": round(avg_chatter, 2),
        "severe_count": len(severe),
        "gate": gate,
        "severe": severe,
        "per_clip": results,
    }
    OUT_JSON.write_text(json.dumps(summary, indent=2))

    # Category breakdown
    from collections import defaultdict
    by_cat = defaultdict(lambda: {"total": 0, "severe": 0})
    for r in results:
        cat = r.get("category", "unknown")
        by_cat[cat]["total"] += 1
        if r.get("crash") or r.get("nan_inf") or r.get("octave_errors", 0) > 0 or r.get("max_jump_cents", 0) > 350:
            by_cat[cat]["severe"] += 1

    # Write report
    lines = [
        "# Neural Vocal Corpus — Bench Report",
        f"**Total clips:** {n}",
        f"**Crashes:** {crashes}",
        f"**NaN/Inf:** {nan_infs}",
        f"**Octave errors:** {oct_errs}",
        f"**Max correction jump:** {max_jump:.1f}¢",
        f"**Avg correction error:** {avg_corr:.1f}¢",
        f"**Avg chatter:** {avg_chatter:.1f}%",
        f"**Severe failures:** {len(severe)}",
        "",
        f"## Gate",
        f"```",
        gate,
        f"```",
        "",
        "## Category Breakdown",
        "",
        "| Category | Total | Severe |",
        "|----------|-------|--------|",
    ]
    for cat, v in sorted(by_cat.items()):
        flag = " ⚠" if v["severe"] > 0 else ""
        lines.append(f"| {cat} | {v['total']} | {v['severe']}{flag} |")

    if severe:
        lines += ["", "## Severe Failures", ""]
        for s in severe:
            lines.append(f"- **{s['name']}**: crash={s.get('crash')} nan={s.get('nan_inf')} "
                         f"oct_err={s.get('octave_errors',0)} max_jump={s.get('max_jump_cents',0):.0f}¢")

    OUT_REPORT.write_text("\n".join(lines))
    print(f"\n[CorpusBench] Complete: {n} clips")
    print(f"  crashes={crashes} nan_inf={nan_infs} oct_err={oct_errs}")
    print(f"  max_jump={max_jump:.0f}¢  avg_corr={avg_corr:.1f}¢  avg_chatter={avg_chatter:.1f}%")
    print(f"  severe={len(severe)}")
    print(f"\n  Gate: {gate}")

    return gate == "NEURAL VOCAL CORPUS PASS"


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
