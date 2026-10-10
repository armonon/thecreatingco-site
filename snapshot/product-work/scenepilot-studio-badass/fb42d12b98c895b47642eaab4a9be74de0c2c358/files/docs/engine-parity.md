# Engine parity: Pro and native render the same documents

`npm run qa:engine-parity` (`scripts/certify-engine-parity.mjs`) renders the **same
saved Pro documents** through both engines and measures the difference:

- **Pro**: the real export path (`renderProject`) in Electron, with the document mapped
  to render options exactly as the app's loader and delivery do
  (`scripts/certify-engine-parity-pro.ts` names the source of every mapping). GPU
  compositing and `no-preference` encoding, as `app/video-delivery.ts` exports.
- **Native**: `LegacySceneTranslation` → `NativeMedia.build` → `NativeExporter`
  (AVFoundation + Core Image on Metal), via `testEngineParityExportsTranslatedDocuments`.
- **One decoder**: ffmpeg decodes both MP4s to RGB; every frame is compared.

Fixtures are generated: solid red, solid blue and `testsrc2` (moving detail, text,
gradients), 640×360 @ 30 fps, 3 s, tagged BT.709. The report is written to
`outputs/engine-parity/report.json` with per-case mean/worst MAE, worst p99, minimum
PSNR, stream colour tags, and each document next to both renders.

## Agreed tolerances

8-bit RGB, per frame, Pro export vs native export (`TOLERANCES` in
`scripts/engine-parity-cases.mjs`):

| Class | mean MAE | worst-frame MAE | worst p99 | min PSNR |
| --- | --- | --- | --- | --- |
| `engine` | ≤ 3.0 | ≤ 4.0 | ≤ 80 | ≥ 24 dB |
| `grain` (a look with film grain) | ≤ 3.5 | ≤ 5.0 | ≤ 80 | ≥ 24 dB |

Frame counts must match exactly.

**Why these numbers.** The floor is Pro's encoder, not either compositor. Pro exports
this fixture at ~765 kb/s; native at ~1.9 Mb/s. Against the source footage, Pro's
export alone measures **2.25 mean / 2.46 worst MAE (p99 47)** and native's **1.04 /
1.21 (p99 15)**. The engine budget is that floor plus a 1.5 margin. p99 is loose
because a low-bitrate encoder smears the pattern's text edges; mean and worst MAE do
the discriminating. Film grain is independent per-pixel noise in each engine (a hash of
the pixel position in 32-bit float, which GPUs don't evaluate bit-identically), so a
graded case gets one more level.

**Proof the budget is tight enough.** Every run re-checks the baseline slipped by one
source frame; it must fail the `engine` tolerance (measured **7.13** worst MAE). Two
real defects found while setting these budgets also exceed it:

| Defect | Measured |
| --- | --- |
| One source frame off at a ramp boundary (native truncated `0.3999…9 s` to a tick below frame 12) | worst 5.52, p99 154 |
| Pro tinting translucent overlays with the track colour (below) | mean 6.80, worst 10.69 |

## Results (2026-09-27, Apple silicon, macOS 26, Electron 43)

| Case | What it exercises | mean | worst | p99 | PSNR |
| --- | --- | --- | --- | --- | --- |
| baseline | one untouched cut | 2.43 | 2.71 | 46 | 29.6 |
| cuts-flip | hard cut, source offset, horizontal flip | 1.57 | 3.28 | 59 | 26.0 |
| overlay-motion | half-scale overlay on an eased keyframe path | 1.78 | 2.56 | 48 | 28.3 |
| fades-opacity | picture fades, overlay/track opacity (gamma blending) | 1.24 | 2.74 | 45 | 29.7 |
| punch-accents | dynamic punch, saved accents, section energy | 2.26 | 3.09 | 47 | 28.9 |
| zoom-transitions | zoom into every cut, one with its own duration | 2.82 | 3.30 | 58 | 26.0 |
| drop-ramp | 8-beat slow-mo into a freeze on the drop, then a cut | 2.51 | 2.95 | 54 | 26.4 |
| look-cinematic | bloom, aberration, contrast, warmth, vignette, grain, beat pulse | 1.64 | 2.72 | 41 | 30.3 |
| look-mirror-streak | graded quad mirror with anamorphic streaks | 2.04 | 2.90 | 69 | 25.2 |
| pro-defaults | a document with **no** effect settings: every Pro default at once | 2.95 | 4.18 | 53 | 27.4 |

All ten pass. Cuts are frame-exact (error drops to 0.00 after a cut to flat colour).

## Findings that changed the code

1. **Pro bug: translucent overlays took the track colour.** `trackFilter` always
   appended `drop-shadow(0 0 0px <track colour>)`. Under an opaque clip it is invisible,
   but at partial opacity the canvas draws the shadow at the same alpha: red at 60% over
   blue rendered pink (211, 60, 101) instead of (153, 0, 100), and with a real track
   colour every translucent overlay was tinted. The shadow is now emitted only for a
   real glow (`lib/compositor.ts`, test in `tests/compositor.test.mjs`).
2. **Pro lost accents and the drop on reopen.** They came only from live analysis,
   which reopening (and adding or removing media) clears, so a saved project rendered
   without accented punches or its drop ramp. Pro now keeps them as
   `renderAnalysis: { accents, dropRamp }` (`lib/render-analysis.ts`), saved with the
   document and autosave and used whenever live analysis is absent.
3. **Frame choice at float knife-edges.** Pro's demuxer (mediabunny
   `roundIfAlmostInteger`) snaps a time within float noise of a tick; `CMTime(seconds:)`
   truncates. The native segment builder now snaps the same way.
4. **Harness, not engine:** software GL in the Pro runner reduced chroma (blue 250 →
   235); the app exports with GPU compositing, so the harness does too
   (`PARITY_PRO_SOFTWARE=1` keeps the software path for investigation). Untagged SD
   fixtures decode as BT.709 in Chromium and BT.601 in AVFoundation (~10 levels), so
   fixtures are tagged, as camera footage is.

## Not covered

Audio is not compared. Strobe, stutter, speed-ramp presets, echo, shake, audio-reactive
motion, other transitions, clip colour/effects, titles, curves, LUTs and compositions
still block translation, so they are outside these cases. Fixtures are synthetic and
SDR; add real camera clips before relying on a single-number figure for footage.
