# Exact Pro → native scene translation (translator `scenepilot-cut` v3)

**File › Review Existing Pro Project** links the project's sources, then attempts an
**exact** translation of the Pro `scenepilot-cut` document into a native scene
(`LegacySceneTranslation.swift`). The outcome is binary:

- **Exact**: every rendered feature has a native equivalent. *Open Exact Translation*
  creates a new, unsaved native project stamped `translation: scenepilot-cut v3`, with
  the original document archived byte-for-byte (`legacyArchive`).
- **Blocked**: nothing is imported. The report lists every blocker (all of them, not
  the first) with a stable feature key, e.g. `[clip.transition]`. The existing
  *Import Linked Media Only* and explicitly lossy *Rebuild Editorial Cuts* remain.

Nothing is approximated, flattened or dropped. Cross-engine agreement is measured, not
assumed: see [engine parity](engine-parity.md).

## Equivalence rules (derived from the Pro compositor, not appearance)

| Rule | Why |
| --- | --- |
| Effects are evaluated through Pro's loader defaults | `coerceEffectSettings` fills a missing or unknown value with `DEFAULT_EFFECTS`, which are **not neutral**: cinematic look, dynamic punch, zoom transitions, drop ramp on. They translate as those defaults. |
| Unknown fields block | Clip, document, `proState` and `settings` fields are allowlisted. A newer Pro feature fails loudly instead of vanishing. |
| Gamma blending | Pro's canvas blends opacity in gamma-encoded sRGB; native defaults to linear light (75% blue: 191 in Pro, ~225 linear). Translated projects set `blendSpace: gamma`, the native equivalent of After Effects' *Blend Colors Using 1.0 Gamma*. |
| Fades must not overlap | Pro takes the lesser of the in/out ramps; native multiplies them. They agree only when the ramps don't overlap. |
| Clip colour/effects must be neutral | Pro uses CSS filters in gamma sRGB; native uses Core Image. `brightness(1.2)` is not `+log2(1.2)` EV. |
| Keyframe easing: linear, ease-in, ease-out, hold only | Identical curves on both engines. Pro's `ease-in-out` ≠ native `smooth`; custom béziers and spatial paths block. |
| Overlay scale and opacity fold into keyframes | Pro multiplies them into keyed motion; native keys replace the clip value. Constant factors commute with every easing, so folding is exact. |
| One clip per lane at a time | Pro shows the latest-starting clip on an overlap; overlaps block. Solo becomes track enablement. |
| Music-driven picture is ported formula for formula | Beat punch, zoom transitions, the drop ramp and the look are native features (`SequenceRhythm.swift`, `NativeLookRenderer.swift`) whose math matches `lib/motion.ts`, `lib/transitions.ts`, `lib/speed.ts` and `lib/grade.ts` term for term; `SequenceRhythmTests` compare against values produced by Pro's own functions. |

## Pro's default music-video look (new in v3)

| Pro | Native |
| --- | --- |
| Beat grid, song sections (energy), saved accents | `Sequence.rhythm` |
| Punch preset (off/subtle/dynamic/slam), scaled 0.4×–1.25× by section energy, accents × boost | `Sequence.punch`, applied to tracks with `followsBeat` (the picture lane; Pro never punches overlays) |
| Zoom transition, per-cut or sequence default, Pro's clamps (≥ 0.04 s, ≤ 2 s, ≤ this and the previous cut) | `Clip.transitionIn` (the first cut zooms too, as in Pro) |
| Slow-mo drop ramp: 8 beats of ramp-out, strength 3.2, into the saved (or hand-placed) drop | `Clip.speedRamp` on picture clips in the window; overlays keep real time. Built as frame-grid pieces so each frame shows the source frame Pro shows |
| Look preset + manual grade + mirror + streak; strength follows section energy; bloom/aberration/exposure pulse with the punch preset's envelope | `Sequence.look`, a Core Image port of `GRADE_FRAGMENT_SHADER`, run on display-encoded values in either blend space |

Accents and the drop come from `renderAnalysis`, which Pro now saves with every
document. A document saved before that has no accents and no drop ramp **in Pro
either** when reopened, so it translates without them, which is still exact.

Native documents are schema **version 7** (rhythm, punch, look, transitions, speed
ramps, track `followsBeat`). Versions 1–6 open and upgrade in memory; 8+ is refused.

## What translates exactly

Picture cuts (timing, source in, linear speed, flips, cover framing), picture fades,
overlay tracks (order, scale, opacity, track opacity and fades, enablement, solo, lock),
keyframed position/scale/rotation/opacity (with the easings above), a letterboxed
continuous main source when there are no cuts, the main song at unity gain, and Pro's
default look: beat punch, zoom transitions, drop ramp, every look preset with manual
grade, mirror and streak.

## Evidence

- `LegacySceneTranslationTests` (12 tests): neutral and Pro-default documents translate
  with every field checked; rhythm, punch, zoom clamps, drop-ramp window, hand-placed
  drop and look resolution are asserted; 38 distinct blocker cases each produce their
  own finding and no partial project; archive, round-trip and version 7 are verified.
- `SequenceRhythmTests` (6 tests): punch, envelopes, zoom, drop ramp and energy-scaled
  look equal Pro's own functions to 1e-12.
- `LegacyTranslationMediaTests`: a translated document renders like the same scene
  authored natively, and the gamma blend space reproduces the canvas math.
- [Engine parity](engine-parity.md): ten documents, including one with every Pro
  default on, rendered by both engines within the agreed tolerances.

## Still blocked (ranked by how many real projects they affect)

1. Other transitions (flash, whip, glitch, dissolve, dip, slide).
2. Strobe, stutter, speed-ramp presets, echo, camera shake, audio-reactive motion.
3. Timeline audio clips and mixing; titles and captions.
4. Clip colour and effects, tone curves, 3D LUTs, wide-gamut colour management.
5. Layered Pro compositions (text, shapes, masks, roto, 3D).
