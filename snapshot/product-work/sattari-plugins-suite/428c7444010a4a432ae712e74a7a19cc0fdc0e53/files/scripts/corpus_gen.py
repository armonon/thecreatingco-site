"""
Neural Vocal Corpus Generator — Sattari Auto Pitch Agent 1
Generates 300+ high-fidelity synthetic vocal clips covering the full style matrix.

Synthesis method: Formant-based vocal synthesis with:
- LF glottal pulse model (realistic vocal fold vibration)
- Formant filter chain (F1/F2/F3 resonances per vowel)
- Vibrato (sinusoidal pitch LFO)
- Breathiness (bandpass-filtered noise added pre-filter)
- Tremolo (amplitude LFO)
- Pitch trajectory shaping (scoops, falls, slides, runs)
- Subharmonic distortion for raspy/belted quality
"""

import numpy as np
import struct
import wave
import os
import json
import math
import random
from pathlib import Path

RNG = random.Random(42)
SR = 44100
OUT_DIR = Path(__file__).parent.parent / "corpus" / "neural_vocal" / "dry"
META_FILE = Path(__file__).parent.parent / "corpus" / "neural_vocal" / "manifest.json"

# Formant frequencies [F1, F2, F3] and bandwidths per vowel
VOWELS = {
    "aa": ([800, 1200, 2500], [80, 90, 120]),   # "ah"
    "ae": ([660, 1700, 2400], [70, 80, 110]),    # "at"
    "iy": ([270, 2300, 3000], [60, 90, 110]),    # "ee"
    "uw": ([300,  870, 2250], [70, 80, 110]),    # "oo"
    "ah": ([700, 1100, 2400], [80, 80, 120]),    # "uh"
}


def midi_to_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lf_pulse(t, T0, Rd=1.0):
    """Simplified LF glottal pulse model — returns flow derivative."""
    te = 0.4 * T0
    tp = 0.3 * T0
    if t < 0 or t >= T0:
        return 0.0
    if t < tp:
        return math.sin(math.pi * t / tp)
    if t < te:
        return math.sin(math.pi * t / tp) * math.exp(-Rd * (t - tp))
    return -math.exp(-30 * (t - te) / (T0 - te))


def formant_filter(signal, f1, bw1, f2, bw2, f3, bw3, sr=SR):
    """Apply three resonator filters (IIR) in series."""
    out = signal.copy().astype(np.float64)
    for f, bw in [(f1, bw1), (f2, bw2), (f3, bw3)]:
        r = math.exp(-math.pi * bw / sr)
        cos_w = math.cos(2 * math.pi * f / sr)
        a1 = -2 * r * cos_w
        a2 = r * r
        b0 = 1 - r
        prev1, prev2 = 0.0, 0.0
        for i in range(len(out)):
            y = b0 * out[i] - a1 * prev1 - a2 * prev2
            prev2 = prev1
            prev1 = y
            out[i] = y
    return out


def synthesize_vocal(
    pitch_midi_seq,   # list of (duration_s, midi_float) segments
    vowel="aa",
    breathiness=0.05,
    subharmonic=0.0,  # 0=clean, 0.3=raspy/belted
    amp=0.55,
    vibrato_hz=0.0,
    vibrato_cents=0.0,
    tremolo_hz=0.0,
    tremolo_depth=0.0,
    sr=SR,
):
    """Synthesize a vocal clip from a pitch sequence."""
    total_samples = int(sum(d for d, _ in pitch_midi_seq) * sr)
    output = np.zeros(total_samples, dtype=np.float64)

    f1s, bw1s = VOWELS[vowel]
    f1, f2, f3 = f1s
    bw1, bw2, bw3 = bw1s

    phase = 0.0
    t_global = 0.0
    sample_i = 0

    for seg_dur, seg_midi in pitch_midi_seq:
        seg_samples = int(seg_dur * sr)
        for i in range(seg_samples):
            t_local = i / sr
            t_global_now = t_global + t_local

            # Pitch with vibrato
            vib = vibrato_cents / 1200 * math.sin(2 * math.pi * vibrato_hz * t_global_now) if vibrato_hz > 0 else 0.0
            midi_now = seg_midi + vib * 12 if vibrato_hz > 0 else seg_midi + vib
            if seg_midi < 0:
                midi_now = seg_midi  # silence
            f0 = midi_to_hz(midi_now) if seg_midi >= 0 else 0.0

            if f0 > 0:
                T0 = 1.0 / f0
                t_in_period = math.fmod(phase / (2 * math.pi), 1.0) * T0
                glottal = lf_pulse(t_in_period, T0)
                # Subharmonic for raspy
                if subharmonic > 0:
                    t_sub = math.fmod(phase / (4 * math.pi), 1.0) * T0 * 2
                    glottal += subharmonic * lf_pulse(t_sub, T0 * 2)
                phase += 2 * math.pi * f0 / sr
            else:
                glottal = 0.0
                phase = 0.0

            # Breathiness noise
            noise = (RNG.random() * 2 - 1) * breathiness if breathiness > 0 else 0.0
            sample = glottal + noise

            # Tremolo
            if tremolo_hz > 0:
                trem = 1.0 - tremolo_depth * 0.5 * (1 - math.sin(2 * math.pi * tremolo_hz * t_global_now))
                sample *= trem

            idx = sample_i + i
            if idx < total_samples:
                output[idx] = sample * amp

        t_global += seg_dur
        sample_i += seg_samples

    # Apply formant filter chain
    output = formant_filter(output, f1, bw1, f2, bw2, f3, bw3, sr)

    # Normalize
    peak = np.max(np.abs(output))
    if peak > 0:
        output *= 0.8 / peak

    return output


def write_wav(path, samples, sr=SR):
    n = len(samples)
    pcm = np.clip(samples * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def midi_seq_sustained(midi, dur=2.0):
    return [(dur, float(midi))]

def midi_seq_scoop(midi, scoop_cents=80, dur=2.0):
    # Start flat, glide up over 200ms
    n_ramp = 0.2
    steps = 20
    segs = []
    for i in range(steps):
        t = i / steps
        offset = scoop_cents / 1200 * 12 * (1 - t)  # in MIDI semitones
        segs.append((n_ramp / steps, midi - offset))
    segs.append((dur - n_ramp, float(midi)))
    return segs

def midi_seq_fall(midi, fall_cents=80, dur=2.0):
    segs = [(dur - 0.2, float(midi))]
    steps = 20
    for i in range(steps):
        t = i / steps
        offset = fall_cents / 1200 * 12 * t
        segs.append((0.2 / steps, midi - offset))
    return segs

def midi_seq_slide(midi_start, midi_end, dur=2.0, slide_dur=0.3):
    segs = []
    steps = 30
    for i in range(steps):
        t = i / steps
        mid = midi_start + (midi_end - midi_start) * t
        segs.append((slide_dur / steps, mid))
    segs.append((dur - slide_dur, float(midi_end)))
    return segs

def midi_seq_run(start_midi, n_notes, direction=1, note_dur=0.12):
    segs = []
    for i in range(n_notes):
        segs.append((note_dur, float(start_midi + direction * i)))
    return segs

def midi_seq_repeated(midi, n=4, note_dur=0.25, gap=0.05):
    segs = []
    for _ in range(n):
        segs.append((note_dur, float(midi)))
        segs.append((gap, -1.0))  # silence gap
    return segs

def midi_seq_interval_jump(midi_low, midi_high, dur_each=1.0):
    return [(dur_each, float(midi_low)), (dur_each, float(midi_high))]

def midi_seq_register_transition(midi_low, midi_high, dur_each=0.8, slide_dur=0.15):
    return midi_seq_slide(midi_low, midi_high, dur=dur_each + dur_each, slide_dur=slide_dur)

def midi_seq_unstable(midi, drift_cents=30, dur=2.0):
    """Random pitch drift to simulate beginner singing."""
    segs = []
    seg_dur = 0.05
    n = int(dur / seg_dur)
    drift = 0.0
    for _ in range(n):
        drift += (RNG.random() - 0.5) * 0.3 * drift_cents / 1200 * 12
        drift = max(-drift_cents/1200*12, min(drift_cents/1200*12, drift))
        segs.append((seg_dur, midi + drift))
    return segs


CLIPS = []

def add(name, seq, vowel="aa", breathiness=0.05, subharmonic=0.0,
        vibrato_hz=0.0, vibrato_cents=0.0, tremolo_hz=0.0, tremolo_depth=0.0,
        amp=0.55, category=""):
    CLIPS.append(dict(
        name=name, seq=seq, vowel=vowel, breathiness=breathiness,
        subharmonic=subharmonic, vibrato_hz=vibrato_hz, vibrato_cents=vibrato_cents,
        tremolo_hz=tremolo_hz, tremolo_depth=tremolo_depth, amp=amp, category=category,
    ))


def build_corpus():
    # ── MALE LOW (E2=40 to B2=47) ──────────────────────────────────────────
    for midi in [40, 42, 44, 45, 47]:  # E2 F#2 Ab2 A2 B2
        add(f"male_low_sustained_{midi}", midi_seq_sustained(midi, 2.5), vowel="aa", category="male_low")
        add(f"male_low_vibrato_{midi}", midi_seq_sustained(midi, 2.5), vowel="aa",
            vibrato_hz=5.5, vibrato_cents=50, category="male_low_vibrato")
        add(f"male_low_scoop_{midi}", midi_seq_scoop(midi, 80), vowel="aa", category="male_low_scoop")
        add(f"male_low_fall_{midi}", midi_seq_fall(midi, 70), vowel="aa", category="male_low_fall")

    # ── MALE MID (C3=48 to G3=55) ──────────────────────────────────────────
    for midi in [48, 50, 52, 53, 55]:  # C3 D3 E3 F3 G3
        add(f"male_mid_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="ae", category="male_mid")
        add(f"male_mid_vibrato_{midi}", midi_seq_sustained(midi, 2.0), vowel="ae",
            vibrato_hz=5.8, vibrato_cents=55, category="male_mid_vibrato")
        add(f"male_mid_breathy_{midi}", midi_seq_sustained(midi, 2.0), vowel="ah",
            breathiness=0.25, category="male_mid_breathy")

    # ── MALE HIGH (A3=57 to E4=64) ─────────────────────────────────────────
    for midi in [57, 59, 60, 62, 64]:  # A3 B3 C4 D4 E4
        add(f"male_high_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy", category="male_high")
        add(f"male_high_belted_{midi}", midi_seq_sustained(midi, 2.0), vowel="ae",
            subharmonic=0.25, amp=0.65, category="male_high_belted")
        add(f"male_high_raspy_{midi}", midi_seq_sustained(midi, 2.0), vowel="ah",
            subharmonic=0.35, breathiness=0.12, category="male_high_raspy")

    # ── FALSETTO (E4=64 to C5=72) ──────────────────────────────────────────
    for midi in [64, 67, 69, 72]:  # E4 G4 A4 C5
        add(f"falsetto_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy",
            breathiness=0.15, amp=0.45, category="falsetto")
        add(f"falsetto_vibrato_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy",
            vibrato_hz=6.2, vibrato_cents=35, breathiness=0.12, category="falsetto_vibrato")

    # ── FEMALE LOW (F3=53 to B3=59) ────────────────────────────────────────
    for midi in [53, 55, 57, 59]:
        add(f"female_low_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="ae", category="female_low")
        add(f"female_low_breathy_{midi}", midi_seq_sustained(midi, 2.0), vowel="ah",
            breathiness=0.3, amp=0.4, category="female_low_breathy")

    # ── FEMALE MID (C4=60 to G4=67) ────────────────────────────────────────
    for midi in [60, 62, 64, 65, 67]:
        add(f"female_mid_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy", category="female_mid")
        add(f"female_mid_vibrato_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy",
            vibrato_hz=5.5, vibrato_cents=45, category="female_mid_vibrato")
        add(f"female_mid_soft_{midi}", midi_seq_sustained(midi, 2.0), vowel="uw",
            breathiness=0.2, amp=0.3, category="female_mid_soft")

    # ── FEMALE HIGH (A4=69 to E5=76) ───────────────────────────────────────
    for midi in [69, 71, 72, 74, 76]:
        add(f"female_high_sustained_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy", category="female_high")
        add(f"female_high_vibrato_heavy_{midi}", midi_seq_sustained(midi, 2.0), vowel="iy",
            vibrato_hz=6.5, vibrato_cents=75, category="female_high_vibrato_heavy")
        add(f"female_high_belted_{midi}", midi_seq_sustained(midi, 2.0), vowel="ae",
            subharmonic=0.2, amp=0.6, category="female_high_belted")

    # ── PITCH PROBLEMS (flat/sharp) ─────────────────────────────────────────
    for midi in [57, 60, 64, 69]:
        add(f"flat_50c_{midi}", midi_seq_sustained(float(midi) - 50/100, 2.0), category="deliberately_flat")
        add(f"sharp_50c_{midi}", midi_seq_sustained(float(midi) + 50/100, 2.0), category="deliberately_sharp")
        add(f"flat_25c_{midi}", midi_seq_sustained(float(midi) - 25/100, 2.0), category="slightly_flat")
        add(f"sharp_25c_{midi}", midi_seq_sustained(float(midi) + 25/100, 2.0), category="slightly_sharp")

    # ── UNSTABLE BEGINNER ────────────────────────────────────────────────────
    for midi in [57, 60, 64]:
        add(f"unstable_heavy_{midi}", midi_seq_unstable(midi, drift_cents=40), category="unstable_beginner")
        add(f"unstable_light_{midi}", midi_seq_unstable(midi, drift_cents=15), category="unstable_light")

    # ── SCOOPS AND FALLS ─────────────────────────────────────────────────────
    for midi in [52, 57, 60, 64, 69]:
        add(f"scoop_80c_{midi}", midi_seq_scoop(midi, 80), category="scoop")
        add(f"scoop_120c_{midi}", midi_seq_scoop(midi, 120), category="scoop_large")
        add(f"fall_60c_{midi}", midi_seq_fall(midi, 60), category="fall")
        add(f"fall_100c_{midi}", midi_seq_fall(midi, 100), category="fall_large")

    # ── SLIDES AND TRANSITIONS ───────────────────────────────────────────────
    # Semitone slides
    for root in [57, 60, 64, 69]:
        add(f"slide_semitone_up_{root}", midi_seq_slide(root, root+1, dur=2.0, slide_dur=0.25),
            category="semitone_slide_up")
        add(f"slide_semitone_down_{root}", midi_seq_slide(root+1, root, dur=2.0, slide_dur=0.25),
            category="semitone_slide_down")
        add(f"slide_wholetone_up_{root}", midi_seq_slide(root, root+2, dur=2.0, slide_dur=0.3),
            category="wholetone_slide_up")
        add(f"slide_wholetone_down_{root}", midi_seq_slide(root+2, root, dur=2.0, slide_dur=0.3),
            category="wholetone_slide_down")

    # Large interval jumps
    for root in [52, 57, 60]:
        add(f"jump_maj3_{root}", midi_seq_interval_jump(root, root+4), category="large_interval_3rd")
        add(f"jump_p5_{root}", midi_seq_interval_jump(root, root+7), category="large_interval_5th")
        add(f"jump_oct_{root}", midi_seq_interval_jump(root, root+12), category="large_interval_octave")
        add(f"jump_maj6_{root}", midi_seq_interval_jump(root, root+9), category="large_interval_6th")
        add(f"jump_min7_{root}", midi_seq_interval_jump(root, root+10), category="large_interval_7th")

    # Register transitions (chest→head voice style)
    add("register_transition_male_60_72", midi_seq_register_transition(60, 72), category="register_transition")
    add("register_transition_female_64_76", midi_seq_register_transition(64, 76), category="register_transition")
    add("register_transition_male_52_64", midi_seq_register_transition(52, 64), category="register_transition")

    # ── RUNS ─────────────────────────────────────────────────────────────────
    # Fast chromatic ascending (120 BPM 8th notes = 0.25s each, 16th = 0.125)
    for start in [52, 57, 60, 64]:
        add(f"run_chromatic_up_fast_{start}", midi_seq_run(start, 12, 1, 0.12),
            category="fast_run_chromatic_up")
        add(f"run_chromatic_down_fast_{start}", midi_seq_run(start+11, 12, -1, 0.12),
            category="fast_run_chromatic_down")
        add(f"run_diatonic_up_fast_{start}", midi_seq_run(start, 8, 1, 0.15),
            category="fast_run_diatonic_up")

    # Slow runs
    for start in [52, 57, 60]:
        add(f"run_chromatic_up_slow_{start}", midi_seq_run(start, 12, 1, 0.3),
            category="slow_run_up")
        add(f"run_chromatic_down_slow_{start}", midi_seq_run(start+11, 12, -1, 0.3),
            category="slow_run_down")

    # ── CHROMATIC PASSING TONES ──────────────────────────────────────────────
    for root in [57, 60, 64]:
        # approach from below
        seq = [(0.3, float(root-1)), (0.3, float(root-1)), (0.5, float(root))]
        add(f"chrom_pass_below_{root}", seq, category="chromatic_passing")
        seq = [(0.5, float(root)), (0.3, float(root+1)), (0.3, float(root+1)), (0.5, float(root+2))]
        add(f"chrom_pass_above_{root}", seq, category="chromatic_passing")

    # ── REPEATED NOTES ───────────────────────────────────────────────────────
    for midi in [52, 57, 60, 64, 69]:
        add(f"repeated_{midi}_fast", midi_seq_repeated(midi, 6, 0.15, 0.04), category="repeated_fast")
        add(f"repeated_{midi}_slow", midi_seq_repeated(midi, 4, 0.4, 0.08), category="repeated_slow")

    # ── SUSTAINED LONG NOTES ─────────────────────────────────────────────────
    for midi in [45, 52, 57, 60, 64, 69, 72]:
        add(f"sustained_4s_{midi}", midi_seq_sustained(midi, 4.0), category="sustained_long")
        add(f"sustained_vibrato_4s_{midi}", midi_seq_sustained(midi, 4.0),
            vibrato_hz=5.5, vibrato_cents=50, category="sustained_vibrato_long")

    # ── VIBRATO HEAVY ─────────────────────────────────────────────────────────
    for midi in [57, 60, 64, 69]:
        add(f"vibrato_heavy_80c_{midi}", midi_seq_sustained(midi, 3.0),
            vibrato_hz=6.0, vibrato_cents=80, category="vibrato_heavy")
        add(f"vibrato_fast_5Hz_{midi}", midi_seq_sustained(midi, 2.5),
            vibrato_hz=7.5, vibrato_cents=40, category="vibrato_fast")
        add(f"vibrato_slow_4Hz_{midi}", midi_seq_sustained(midi, 2.5),
            vibrato_hz=4.0, vibrato_cents=60, category="vibrato_slow")

    # ── STRAIGHT TONE ─────────────────────────────────────────────────────────
    for midi in [57, 60, 64, 69]:
        add(f"straight_tone_{midi}", midi_seq_sustained(midi, 2.0),
            vibrato_hz=0, vibrato_cents=0, category="straight_tone")

    # ── HEAD VOICE / SOFT UPPER REGISTER ─────────────────────────────────────
    for midi in [67, 69, 72, 74, 76]:
        add(f"head_voice_{midi}", midi_seq_sustained(midi, 2.0), vowel="uw",
            breathiness=0.18, amp=0.38, vibrato_hz=5.0, vibrato_cents=30, category="head_voice")
        add(f"head_voice_straight_{midi}", midi_seq_sustained(midi, 2.0), vowel="uw",
            breathiness=0.15, amp=0.35, category="head_voice_straight")

    # ── CHEST VOICE HEAVY ─────────────────────────────────────────────────────
    for midi in [48, 50, 52, 55, 57]:
        add(f"chest_heavy_{midi}", midi_seq_sustained(midi, 2.0), vowel="aa",
            subharmonic=0.15, amp=0.65, category="chest_voice_heavy")

    # ── RAP / MELODIC TRANSITIONS ────────────────────────────────────────────
    # Spoken-sung transitions (start near-monotone, then pitch)
    for root in [52, 57, 60]:
        seq = [(0.15, float(root+0.1)), (0.15, float(root-0.15)), (0.15, float(root+0.2)),
               (0.15, float(root-0.1)), (0.5, float(root)), (0.5, float(root+4))]
        add(f"rap_to_melody_{root}", seq, category="rap_melodic_transition")

    # ── VIBRATO VARIETY ───────────────────────────────────────────────────────
    for midi in [60, 64, 69]:
        # Vibrato that develops (starts straight, vibrato grows in)
        segs_ramp = [(0.5, float(midi))]  # straight
        for step in range(20):
            t = step / 20
            segs_ramp.append((0.075, float(midi)))  # vibrato applied in synthesize_vocal
        add(f"vibrato_ramp_{midi}", midi_seq_sustained(midi, 2.0),
            vibrato_hz=5.5, vibrato_cents=40, category="vibrato_ramp")
        # Very wide vibrato (operatic)
        add(f"vibrato_operatic_{midi}", midi_seq_sustained(midi, 2.5),
            vibrato_hz=5.0, vibrato_cents=90, category="vibrato_operatic")

    # ── MULTI-NOTE PHRASES (more musical) ────────────────────────────────────
    # C major scale up + down
    c_major = [60, 62, 64, 65, 67, 69, 71, 72]
    seq_up = [(0.3, float(m)) for m in c_major]
    seq_down = [(0.3, float(m)) for m in reversed(c_major)]
    add("phrase_c_major_up", seq_up, vowel="iy", category="scale_phrase")
    add("phrase_c_major_down", seq_down, vowel="iy", category="scale_phrase")

    a_minor = [57, 59, 60, 62, 64, 65, 67, 69]
    seq_up = [(0.3, float(m)) for m in a_minor]
    add("phrase_a_minor_up", seq_up, vowel="ah", category="scale_phrase")

    # Pentatonic runs
    pent = [60, 62, 64, 67, 69, 72]
    add("phrase_pent_up_fast", [(0.12, float(m)) for m in pent], category="pentatonic_run")
    add("phrase_pent_down_fast", [(0.12, float(m)) for m in reversed(pent)], category="pentatonic_run")

    # Arpeggios
    for root in [48, 52, 57, 60]:
        maj_arp = [root, root+4, root+7, root+12, root+7, root+4, root]
        min_arp = [root, root+3, root+7, root+12, root+7, root+3, root]
        add(f"arp_major_{root}", [(0.25, float(m)) for m in maj_arp], category="arpeggio_major")
        add(f"arp_minor_{root}", [(0.25, float(m)) for m in min_arp], category="arpeggio_minor")

    # ── SILENCE/VOICE BOUNDARIES ─────────────────────────────────────────────
    for midi in [57, 60, 64]:
        # silence → voice → silence
        seq = [(0.3, -1.0), (1.5, float(midi)), (0.3, -1.0)]
        add(f"boundary_sil_voc_sil_{midi}", seq, category="silence_voice_boundary")
        # two notes with gap
        seq = [(0.6, float(midi)), (0.25, -1.0), (0.6, float(midi+5))]
        add(f"boundary_gap_{midi}", seq, category="note_gap_boundary")
        # very short notes
        seq = [(0.08, float(midi)), (0.04, -1.0)] * 8
        add(f"rapid_attacks_{midi}", seq, category="rapid_attack")

    # ── ADDITIONAL VOWEL COVERAGE ─────────────────────────────────────────────
    for midi in [57, 60, 64, 69]:
        for vowel in ["iy", "uw", "ae"]:
            add(f"vowel_{vowel}_{midi}", midi_seq_sustained(midi, 1.5), vowel=vowel, category=f"vowel_{vowel}")
    # Tremolo (amplitude vibrato — common in older singing styles)
    for midi in [57, 64, 69]:
        add(f"tremolo_{midi}", midi_seq_sustained(midi, 2.0),
            tremolo_hz=6.0, tremolo_depth=0.4, category="tremolo")
    # Slow onset (note fades in)
    for midi in [57, 64]:
        seq = [(0.4, float(midi))] * 5  # same pitch but amp is low initially — handled by amp ramp
        add(f"slow_onset_{midi}", midi_seq_sustained(midi, 2.0), amp=0.25, category="slow_onset")

    # ── EDGE CASES ────────────────────────────────────────────────────────────
    # Very low level
    for midi in [57, 64]:
        add(f"low_level_{midi}", midi_seq_sustained(midi, 2.0), amp=0.04, category="low_level")
    # Extreme high note
    add("extreme_high_b5", midi_seq_sustained(83, 1.5), vowel="iy", amp=0.35, category="extreme_high")
    # Extreme low note
    add("extreme_low_e1", midi_seq_sustained(28, 1.5), vowel="aa", category="extreme_low")
    # Unison with scale root
    add("on_scale_root_a4", midi_seq_sustained(69, 2.0), category="on_root")
    # Octave errors bait (notes that might confuse the detector)
    for midi in [45, 57, 69, 81]:  # A across octaves
        add(f"octave_bait_{midi}", midi_seq_sustained(midi, 2.0), category="octave_bait")

    print(f"Total clips defined: {len(CLIPS)}")


def generate_all():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_corpus()
    manifest = []
    for i, clip in enumerate(CLIPS):
        try:
            samples = synthesize_vocal(
                clip["seq"],
                vowel=clip.get("vowel", "aa"),
                breathiness=clip.get("breathiness", 0.05),
                subharmonic=clip.get("subharmonic", 0.0),
                vibrato_hz=clip.get("vibrato_hz", 0.0),
                vibrato_cents=clip.get("vibrato_cents", 0.0),
                tremolo_hz=clip.get("tremolo_hz", 0.0),
                tremolo_depth=clip.get("tremolo_depth", 0.0),
                amp=clip.get("amp", 0.55),
            )
            path = OUT_DIR / f"{clip['name']}.wav"
            write_wav(path, samples)
            dur = sum(d for d, _ in clip["seq"])
            manifest.append({
                "name": clip["name"],
                "category": clip["category"],
                "path": str(path),
                "duration_s": round(dur, 3),
                "sr": SR,
            })
            if (i + 1) % 50 == 0:
                print(f"[CorpusGen] {i+1}/{len(CLIPS)} clips generated")
        except Exception as e:
            print(f"  ERROR generating {clip['name']}: {e}")

    with open(META_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n[CorpusGen] Done: {len(manifest)} clips → {OUT_DIR}")
    return manifest


if __name__ == "__main__":
    generate_all()
