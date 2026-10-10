#!/usr/bin/env python3
"""Generate a small ElevenLabs Music pilot set and analyze key/BPM locally."""

from __future__ import annotations

import json
import os
import argparse
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import librosa
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SERVICE = "com.sattari.elevenlabs.api-key"
ACCOUNT = os.environ.get("USER", "agentsattari")
API_URL = "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192"
ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


CASES = [
    {
        "id": "pilot_01_low_resonant_acappella",
        "expected_key": "C",
        "expected_mode": "minor",
        "seed": 9101,
        "duration_ms": 12000,
        "styles": [
            "solo low resonant fictional male vocal",
            "a cappella",
            "dry close microphone",
            "C minor",
            "72 BPM",
            "sustained vowels",
            "subtle breath before phrases",
            "natural phrase endings",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "heavy reverb",
            "autotune",
            "distortion",
        ],
        "text": "[Verse]\nLow moon over quiet streets\nI hold the note and let it lean\nA slow blue line returns to me",
    },
    {
        "id": "pilot_02_mid_pop_vocal",
        "expected_key": "A",
        "expected_mode": "major",
        "seed": 9102,
        "duration_ms": 12000,
        "styles": [
            "fictional mid range pop vocal",
            "light minimal pop backing",
            "A major",
            "96 BPM",
            "clear consonants",
            "connected melodic phrase",
            "small scoop into first note",
            "dry lead vocal forward",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "dense mix",
            "heavy reverb",
            "spoken word",
        ],
        "text": "[Verse]\nOpen the window and count to three\nMorning is moving in time with me\nEvery little echo finds the key",
    },
    {
        "id": "pilot_03_bright_high_vibrato",
        "expected_key": "G",
        "expected_mode": "major",
        "seed": 9103,
        "duration_ms": 14000,
        "styles": [
            "bright high fictional female vocal",
            "sparse piano and soft pulse",
            "G major",
            "108 BPM",
            "expressive vibrato",
            "gentle portamento",
            "sustained high vowel",
            "breath gaps",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "opera",
            "choir",
            "heavy effects",
        ],
        "text": "[Verse]\nSilver in the ceiling light\nI rise and fall on every line\nCarry me softly through the night",
    },
    {
        "id": "pilot_04_instrumental_key_bpm",
        "expected_key": "D",
        "expected_mode": "minor",
        "seed": 9104,
        "duration_ms": 12000,
        "styles": [
            "instrumental alt pop loop",
            "D minor",
            "84 BPM",
            "clear bass root motion",
            "simple drums",
            "short hook",
            "no vocals",
            "steady tonal center",
            "great production quality",
        ],
        "negative_styles": [
            "vocals",
            "speech",
            "atonal",
            "key changes",
            "ambient wash",
        ],
        "text": "[Instrumental]\n{tight drums}\n{warm bass holds D minor}\n{short electric piano hook}",
        "force_instrumental": True,
    },
]

CASES.extend([
    {
        "id": "pilot_05_breathy_intimate_close",
        "expected_key": "E",
        "expected_mode": "minor",
        "seed": 9205,
        "duration_ms": 12000,
        "styles": [
            "breathy intimate fictional alto vocal",
            "nearly a cappella",
            "dry close microphone",
            "E minor",
            "76 BPM",
            "quiet dynamics",
            "soft consonants",
            "audible breath gaps",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "heavy reverb",
            "distortion",
        ],
        "text": "[Verse]\nAlmost under every word\nI leave a little air unheard\nMeet me where the shadows turn",
    },
    {
        "id": "pilot_06_strong_projected_belt",
        "expected_key": "B",
        "expected_mode": "minor",
        "seed": 9206,
        "duration_ms": 12000,
        "styles": [
            "strong projected fictional tenor vocal",
            "minimal cinematic drums",
            "B minor",
            "92 BPM",
            "belted phrase endings",
            "wide sustained vowels",
            "clear pitch center",
            "lead vocal forward",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "shouted speech",
            "heavy reverb",
        ],
        "text": "[Verse]\nRaise the signal over stone\nHold the fire in my tone\nI will carry this alone",
    },
    {
        "id": "pilot_07_fast_note_changes",
        "expected_key": "C",
        "expected_mode": "major",
        "seed": 9207,
        "duration_ms": 12000,
        "styles": [
            "fictional pop vocal agility exercise",
            "light metronomic percussion",
            "C major",
            "126 BPM",
            "fast note changes",
            "short syllables",
            "clean articulation",
            "dry vocal upfront",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "rap",
            "choir",
            "heavy effects",
        ],
        "text": "[Verse]\nTicking over tiny lights\nLittle ladders lifting bright\nEvery letter lands in flight",
    },
    {
        "id": "pilot_08_portamento_slides",
        "expected_key": "A",
        "expected_mode": "minor",
        "seed": 9208,
        "duration_ms": 14000,
        "styles": [
            "expressive fictional mezzo vocal",
            "sparse electric piano",
            "A minor",
            "88 BPM",
            "obvious portamento slides",
            "scoops into notes",
            "slow downward drift",
            "natural vibrato",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "hard autotune",
            "choir",
            "dense mix",
        ],
        "text": "[Verse]\nFalling into every line\nSliding slowly out of time\nStill the center answers mine",
    },
    {
        "id": "pilot_09_sustained_vowels",
        "expected_key": "F",
        "expected_mode": "major",
        "seed": 9209,
        "duration_ms": 12000,
        "styles": [
            "fictional warm baritone vocal",
            "a cappella",
            "F major",
            "68 BPM",
            "long sustained vowels",
            "steady tone",
            "small natural vibrato",
            "dry studio vocal",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "backing vocals",
            "heavy reverb",
            "instrumental solo",
        ],
        "text": "[Verse]\nAh I remain\nOh I remain\nStay on the open plain",
    },
    {
        "id": "pilot_10_consonant_heavy",
        "expected_key": "G",
        "expected_mode": "minor",
        "seed": 9210,
        "duration_ms": 12000,
        "styles": [
            "fictional crisp conversational vocal",
            "very light pulse",
            "G minor",
            "104 BPM",
            "consonant heavy lyrics",
            "plosives and fricatives",
            "tight phrase endings",
            "dry vocal present",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "mumble",
            "heavy reverb",
            "choir",
        ],
        "text": "[Verse]\nBright clocks click past black brick steps\nSharp sparks skip through kept regrets\nSmall truths split the quiet net",
    },
    {
        "id": "pilot_11_low_bass_voice",
        "expected_key": "D",
        "expected_mode": "major",
        "seed": 9211,
        "duration_ms": 12000,
        "styles": [
            "very low resonant fictional bass vocal",
            "a cappella",
            "D major",
            "70 BPM",
            "low sustained notes",
            "warm chest resonance",
            "slow phrase endings",
            "dry close microphone",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "sub bass instrument",
            "heavy reverb",
        ],
        "text": "[Verse]\nDeep river under the door\nOne note settles on the floor\nI return and ask for more",
    },
    {
        "id": "pilot_12_high_bright_soprano",
        "expected_key": "E",
        "expected_mode": "major",
        "seed": 9212,
        "duration_ms": 12000,
        "styles": [
            "bright high fictional soprano pop vocal",
            "minimal bell pad",
            "E major",
            "112 BPM",
            "high clear sustained note",
            "light vibrato",
            "gentle breath before line",
            "lead vocal forward",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "opera",
            "choir",
            "heavy reverb",
        ],
        "text": "[Verse]\nCrystal morning opens wide\nLift the melody inside\nLet the upper color glide",
    },
    {
        "id": "pilot_13_quiet_breathy_minor",
        "expected_key": "F#",
        "expected_mode": "minor",
        "seed": 9213,
        "duration_ms": 12000,
        "styles": [
            "quiet breathy fictional vocal",
            "almost unaccompanied",
            "F# minor",
            "80 BPM",
            "low volume phrases",
            "breath noise",
            "fragile note attacks",
            "dry vocal",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "loud drums",
            "heavy reverb",
        ],
        "text": "[Verse]\nWhisper through the paper wall\nBarely there but still I call\nSoftly let the edges fall",
    },
    {
        "id": "pilot_14_wrong_note_color",
        "expected_key": "C",
        "expected_mode": "major",
        "seed": 9214,
        "duration_ms": 12000,
        "styles": [
            "fictional pop vocal",
            "C major",
            "90 BPM",
            "one bluesy out of scale note",
            "passing tone tension",
            "connected melody",
            "dry vocal upfront",
            "small band backing",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "heavy autotune",
            "atonal",
        ],
        "text": "[Verse]\nGreen light bends across the blue\nOne strange note is passing through\nThen it finds the center too",
    },
    {
        "id": "pilot_15_octave_leap",
        "expected_key": "A",
        "expected_mode": "major",
        "seed": 9215,
        "duration_ms": 12000,
        "styles": [
            "fictional energetic vocal",
            "A major",
            "118 BPM",
            "sudden octave leap",
            "clear low note then high note",
            "short breath before leap",
            "minimal pop backing",
            "lead vocal forward",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "scream",
            "heavy reverb",
        ],
        "text": "[Verse]\nStart below the city line\nJump above the rooftop sign\nHold the daylight, make it shine",
    },
    {
        "id": "pilot_16_repeated_staccato",
        "expected_key": "B",
        "expected_mode": "major",
        "seed": 9216,
        "duration_ms": 12000,
        "styles": [
            "fictional clean pop vocal",
            "B major",
            "122 BPM",
            "repeated staccato notes",
            "short syllable pattern",
            "precise note starts",
            "dry close vocal",
            "light kick pulse",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "legato only",
            "choir",
            "heavy effects",
        ],
        "text": "[Verse]\nTap tap take the tiny train\nStep step send it back again\nBright bright bits of silver rain",
    },
    {
        "id": "pilot_17_wide_vibrato",
        "expected_key": "C#",
        "expected_mode": "minor",
        "seed": 9217,
        "duration_ms": 14000,
        "styles": [
            "expressive fictional soul vocal",
            "C# minor",
            "82 BPM",
            "wide vibrato",
            "sustained emotional note",
            "slow attack",
            "minimal organ pad",
            "vocal upfront",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "hard autotune",
            "distortion",
        ],
        "text": "[Verse]\nHold me in the turning sound\nWide and warm and circling round\nLet the center settle down",
    },
    {
        "id": "pilot_18_slide_up_fast",
        "expected_key": "D",
        "expected_mode": "minor",
        "seed": 9218,
        "duration_ms": 12000,
        "styles": [
            "fictional agile alto vocal",
            "D minor",
            "100 BPM",
            "fast upward slide",
            "scoop into target note",
            "connected melodic phrase",
            "sparse percussion",
            "dry vocal lead",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "heavy reverb",
            "rap",
        ],
        "text": "[Verse]\nClimb the line and do not break\nSlide the spark across the lake\nLand it clean for morning's sake",
    },
    {
        "id": "pilot_19_breath_gap_reentry",
        "expected_key": "G#",
        "expected_mode": "minor",
        "seed": 9219,
        "duration_ms": 12000,
        "styles": [
            "fictional breathy tenor vocal",
            "G# minor",
            "78 BPM",
            "obvious breath gap",
            "silence before reentry",
            "soft reattack",
            "nearly a cappella",
            "dry close microphone",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "continuous pad",
            "heavy reverb",
        ],
        "text": "[Verse]\nI leave the line\n{breath}\nThen find the sign\nI leave the line\n{breath}\nThen make it mine",
    },
    {
        "id": "pilot_20_dynamic_swell",
        "expected_key": "F",
        "expected_mode": "minor",
        "seed": 9220,
        "duration_ms": 14000,
        "styles": [
            "fictional dramatic vocal",
            "F minor",
            "86 BPM",
            "quiet to loud dynamic swell",
            "crescendo on sustained note",
            "clear vowel",
            "minimal cinematic backing",
            "vocal upfront",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "clipping",
            "heavy reverb",
        ],
        "text": "[Verse]\nBegin as smoke beneath the wire\nGrow into a steady fire\nHold the word and lift it higher",
    },
    {
        "id": "pilot_21_chromatic_run",
        "expected_key": "E",
        "expected_mode": "minor",
        "seed": 9221,
        "duration_ms": 12000,
        "styles": [
            "fictional vocal scale run",
            "E minor",
            "132 BPM",
            "brief chromatic passing run",
            "fast syllables",
            "return to stable key center",
            "dry lead vocal",
            "light rhythm section",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "choir",
            "spoken word",
            "heavy effects",
        ],
        "text": "[Verse]\nStep by step the colors race\nHalf steps flash across the phrase\nThen I settle into place",
    },
    {
        "id": "pilot_22_harmonized_phrase",
        "expected_key": "A",
        "expected_mode": "minor",
        "seed": 9222,
        "duration_ms": 12000,
        "styles": [
            "fictional lead vocal with subtle harmony",
            "A minor",
            "94 BPM",
            "two voice harmony on last phrase",
            "lead still dominant",
            "connected melodic phrase",
            "small room ambience",
            "great production quality",
        ],
        "negative_styles": [
            "celebrity impression",
            "recognizable artist",
            "large choir",
            "heavy reverb",
            "atonal",
        ],
        "text": "[Verse]\nFollow where the candle bends\nSing the line before it ends\nTwo small voices meet as friends",
    },
    {
        "id": "pilot_23_instrumental_stable_major",
        "expected_key": "C",
        "expected_mode": "major",
        "seed": 9223,
        "duration_ms": 12000,
        "styles": [
            "instrumental piano bass drum loop",
            "C major",
            "100 BPM",
            "clear tonic bass",
            "simple I IV V progression",
            "no vocals",
            "steady tempo",
            "great production quality",
        ],
        "negative_styles": [
            "vocals",
            "speech",
            "key changes",
            "atonal",
            "ambient wash",
        ],
        "text": "[Instrumental]\n{simple piano hook in C major}\n{bass plays clear C root}\n{steady drums}",
    },
    {
        "id": "pilot_24_instrumental_stable_minor",
        "expected_key": "A",
        "expected_mode": "minor",
        "seed": 9224,
        "duration_ms": 12000,
        "styles": [
            "instrumental synth bass drum loop",
            "A minor",
            "90 BPM",
            "clear tonic bass",
            "simple minor progression",
            "no vocals",
            "steady tempo",
            "great production quality",
        ],
        "negative_styles": [
            "vocals",
            "speech",
            "major key",
            "key changes",
            "atonal",
        ],
        "text": "[Instrumental]\n{dark synth hook in A minor}\n{bass holds A root}\n{tight simple drums}",
    },
])


def get_key() -> str:
    return subprocess.check_output(
        ["security", "find-generic-password", "-a", ACCOUNT, "-s", SERVICE, "-w"],
        text=True,
    ).strip()


def compose(case: dict, out_mp3: Path) -> dict:
    payload = {
        "composition_plan": {
            "chunks": [
                {
                    "text": case["text"],
                    "duration_ms": case["duration_ms"],
                    "positive_styles": case["styles"],
                    "negative_styles": case["negative_styles"],
                    "context_adherence": "high",
                }
            ]
        },
        "model_id": "music_v2_5",
        "seed": case["seed"],
        "store_for_inpainting": False,
        "sign_with_c2pa": False,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": get_key(),
        },
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = resp.read()
            headers = dict(resp.headers.items())
            status = resp.status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"{case['id']} generation failed HTTP {exc.code}: {detail[:1000]}") from exc

    out_mp3.write_bytes(body)
    return {
        "status": status,
        "elapsed_sec": round(time.time() - start, 3),
        "bytes": len(body),
        "content_type": headers.get("content-type", ""),
        "request_id": headers.get("request-id", headers.get("x-request-id", "")),
        "song_id": headers.get("song-id", headers.get("x-song-id", "")),
    }


def convert_to_wav(mp3: Path, wav: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(mp3), "-ar", "48000", "-ac", "1", str(wav)],
        check=True,
    )


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    a = a - np.mean(a)
    b = b - np.mean(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else -1.0


def estimate_key_bpm(wav: Path) -> dict:
    y, sr = librosa.load(wav, sr=48000, mono=True)
    duration = len(y) / sr if sr else 0.0
    rms = float(np.sqrt(np.mean(np.square(y)))) if len(y) else 0.0
    peak = float(np.max(np.abs(y))) if len(y) else 0.0
    tempo_raw, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.asarray(tempo_raw).reshape(-1)[0]) if np.asarray(tempo_raw).size else 0.0
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    candidates: list[tuple[float, str, str]] = []
    for root in range(12):
        candidates.append((pearson(np.roll(MAJOR_PROFILE, root), chroma_mean), ROOT_NAMES[root], "major"))
        candidates.append((pearson(np.roll(MINOR_PROFILE, root), chroma_mean), ROOT_NAMES[root], "minor"))
    candidates.sort(reverse=True, key=lambda item: item[0])
    top = candidates[:5]
    return {
        "duration_sec": round(duration, 3),
        "rms": rms,
        "peak": peak,
        "bpm_estimate": round(tempo, 3),
        "detected_key": top[0][1],
        "detected_mode": top[0][2],
        "key_confidence_gap": round(top[0][0] - top[1][0], 4) if len(top) > 1 else 0.0,
        "top_key_candidates": [
            {"key": key, "mode": mode, "score": round(score, 4)}
            for score, key, mode in top
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    out_dir = args.out.resolve() if args.out else ROOT / "validation" / f"elevenlabs_music_pilot_{time.strftime('%Y%m%d_%H%M%S')}"
    audio_dir = out_dir / "audio"
    meta_dir = out_dir / "metadata"
    audio_dir.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "created_at_unix": int(time.time()),
        "tool": "scripts/elevenlabs_music_pilot.py",
        "api": "ElevenLabs Music POST /v1/music",
        "output_format": "mp3_48000_192",
        "model_id": "music_v2_5",
        "cases": [],
        "tunebat": {
            "status": "not_machine_verified",
            "reason": "Tunebat Analyzer is a browser upload flow and returned 403/Cloudflare to headless fetch during this run.",
        },
    }

    tunebat_rows = ["id,audio_path,expected_key,expected_mode,source"]
    autokey_rows = ["id,audio_path,expected_key,expected_mode,source"]

    for case in CASES:
        mp3 = audio_dir / f"{case['id']}.mp3"
        wav = audio_dir / f"{case['id']}.wav"
        if mp3.exists():
            generation = {
                "status": "reused_existing_file",
                "bytes": mp3.stat().st_size,
            }
        else:
            generation = compose(case, mp3)
        if not wav.exists() or wav.stat().st_mtime < mp3.stat().st_mtime:
            convert_to_wav(mp3, wav)
        analysis = estimate_key_bpm(wav)
        case_manifest = {
            **case,
            "audio_mp3": str(mp3),
            "audio_wav": str(wav),
            "generation": generation,
            "analysis": analysis,
            "local_key_match": analysis["detected_key"] == case["expected_key"] and analysis["detected_mode"] == case["expected_mode"],
        }
        (meta_dir / f"{case['id']}.json").write_text(json.dumps(case_manifest, indent=2) + "\n")
        manifest["cases"].append(case_manifest)
        rel_wav = os.path.relpath(wav, out_dir)
        tunebat_rows.append(f"{case['id']},{rel_wav},{case['expected_key']},{case['expected_mode']},Tunebat-upload-pending")
        autokey_rows.append(f"{case['id']},{rel_wav},{case['expected_key']},{case['expected_mode']},ElevenLabs-pilot")
        print(f"{case['id']}: {analysis['detected_key']} {analysis['detected_mode']} / {analysis['bpm_estimate']} BPM / local_match={case_manifest['local_key_match']}")

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (out_dir / "tunebat_upload_manifest.csv").write_text("\n".join(tunebat_rows) + "\n")
    (out_dir / "autokey_reference.csv").write_text("\n".join(autokey_rows) + "\n")
    print(out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
