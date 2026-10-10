# Media-driven Auto Cut qualification — 2026-09-28

## September 29 live follow-through (latest status)

This section supersedes the historical locked-Mac pending gates below. The Mac
was unlocked during this pass; no permissions or security settings were changed.

- Analysis cancellation displayed “Analysis canceled. Your current edit is
  unchanged.” No draft was created (0/8), and generation was enabled again.
- Silent-scene generation produced three cuts spanning exactly six seconds.
  Scrubbing to the exact endpoint displayed the red last frame, not black.
- Canceling the native Save dialog produced “Preparation canceled,” CANCELED,
  zero active jobs and an available Retry action. No encoding had started.
- Retrying, saving, then canceling active worker encoding produced “Render
  canceled,” CANCELED and zero active jobs. Retry remained available. Chrome
  left a zero-byte destination placeholder, not committed partial media.
- Retrying once more completed a real MP4 export through the UI:
  `/tmp/scenepilot-autocut-qa.7Z3o2G/scenepilot-silent-scenes-complete-20260929.mp4`.
  ffprobe reported H.264, 640×360, 180 frames, 6.000 seconds, no audio stream,
  205,591 bytes. Decoding every frame verified blue frames 0–59, green 60–119,
  red 120–179: exact source ordering and boundaries.
- Save/reload from the local Pro library restored three timeline clips, their
  six-second duration, source media, and the retained Auto Cut draft.
- That round trip exposed lost creative intent. Music/Cinematic (and the other
  creator goals) now persist through library saves, project documents, recovery
  snapshots and undo. Live retest retained Cinematic after reload; switching to
  Music and Undo restored Cinematic. Legacy projects have validated fallbacks.
- Cancellation exposed a leaked decoded VideoSample when the abort check or
  frame analysis threw before close(). Frame ownership now uses try/finally,
  with tests for success, abort, synchronous/asynchronous failure and null frames.
  Live cancellation was retested; forced-GC absence of warnings was not claimed.
- A generated 12-second video containing scene changes and the 120-BPM pulse
  soundtrack was imported successfully. Follow music found five source
  boundaries and generated a separate draft. It exposed a target-duration bug:
  two cuts ended at 3.02 seconds despite a six-second target. The constraint
  pass discarded the whole final shot when it crossed the requested out point.
  It now trims the final shot at that out point, retaining beat-aligned starts
  and preserving indivisible spoken phrases. Regression coverage passes for
  music and hybrid modes. The post-fix live mixed-media retest remains pending
  after native-picker/browser interaction became unreliable; do not count this
  as a dense music-cut or creative-quality pass.

Final checks after these fixes: **957/957 tests passed** (full suite, zero skips),
TypeScript passed, scoped lint passed, web production build passed, desktop
renderer build passed. Existing chunk-size/dynamic-import warnings remain.
No packaged/notarized desktop app was rebuilt, and nothing was deployed.

Outstanding qualification: post-fix embedded-music/dense-cut live retest,
representative long mixed-format footage, sustained playback and sync on other
machines, and packaged Electron/native-render testing. Synthetic fixtures are
useful correctness evidence, not release certification or proof of artistic quality.

## Scope and environment

Local Chrome on macOS, isolated Vite origin `http://127.0.0.1:4086/?edition=pro`.
The Pro query flag does **not** make this a packaged Electron/native-render test.
Existing user projects on port 4074 were not changed. No deployment, commit,
installer rebuild or signing changes were made in this pass.

Generated deterministic media with `scripts/make-test-media.sh` in
`/tmp/scenepilot-autocut-qa.7Z3o2G`: a 12-second 120-BPM pulse song, six-second
blue/green/red clips, and a silent six-second video changing color at 2s and 4s.
These are actual decoded media files, but not a representative real-world corpus.
The script now includes the silent scene fixture for repeatability.

## Observed live results

- Browser-extension upload lacked file-URL permission. The normal macOS picker
  successfully imported the song and two footage clips without changing permissions.
- Follow music + six-second target + Smooth generated a separate one-shot draft
  of 5.99s. The detected tempo was 119.932 BPM. This checks a restrained edit, not
  dense beat-cut quality or source variety.
- Draft playback advanced to its end. Scrubbing showed the actual blue footage.
  The main timeline stayed unchanged until Apply.
- Apply created the six-second montage. Undo restored the original 12-second
  sequence with zero footage uses; Redo restored the montage.
- Named MP4 export reached **Render complete / COMPLETED / 100%** through the
  actual queue and native Save dialog. Output:
  `/tmp/scenepilot-autocut-qa.7Z3o2G/scenepilot-autocut-music-qa.mp4`.
- ffprobe: H.264, 1280×720, 180 frames, 6.000s video; AAC audio 6.058667s;
  161,055 bytes. All 180 decoded frames were blue-dominant. Audio was non-silent
  (mean -33.7 dB, peak -14.5 dB).
- Silent scene detection read 30 frames and found both scene boundaries, but
  initially produced no draft. The generic constraints error concealed a quality
  filter rejecting all low-detail shots.
- After the scene-selection fix, regenerating produced **3 cuts / 6.00s**.
  Scrubbing to 5.93s showed the red final shot while the unchanged source viewer
  remained on its blue opening frame, confirming isolated draft transport.

## Fixes

1. Scene-following explicitly uses all detected scenes in source order, subject to
   existing timing/source constraints. Quality-ranked cinematic selects remain
   available and unchanged. The draft is named “Scene first cut.” Regression
   coverage proves low-detail scenes are retained without weakening quality selects.
2. The draft preview now clamps its rendered time to the final exported frame.
   Previously reaching the exact out point showed black. Playback time can still
   reach the duration for stop/replay behavior. Pure tests cover fractional
   durations, short clips, invalid input and default frame rates.

## Verification

- Final TypeScript + lint: passed.
- Final full unit/regression suite: **938/938 passed**.
- Web production build: passed.
- Desktop renderer build: passed (not a packaged desktop runtime test).
- Existing large-chunk / ineffective dynamic-import build warnings remain.
- Browser logs contained repeated “Could not establish connection. Receiving end
  does not exist.” errors; origin was not isolated. Do not claim zero console errors.
- App-shell skill guided isolated draft state, reversible application and explicit
  qualification gates. The canonical videoClips store was preserved.

## Incomplete gates / blocker

### Follow-up: AAC timing isolated and corrected

The follow-up used `webdev/audio-sync-qa.html` (dev server only), generating a
two-second, 48 kHz PCM source with three known noise bursts. It sends that source
through the production PCM mixer and browser render engine, then decodes each
result with AudioContext. Observed in Chrome on this Mac:

| Path | Burst onsets (ms) | Decoded duration |
| --- | --- | --- |
| Source WAV / mixed PCM | 200 / 750 / 1300 | 2.000 s |
| Original AAC MP4 | 244 / 794 / 1344 | 2.069333 s |
| Corrected buffered MP4 | 200 / 750 / 1300 | 2.000 s |
| Corrected seekable-stream MP4 | 200 / 750 / 1300 | 2.000 s |
| WebM Opus | 200 / 750 / 1300 | 2.0135 s |

The correction measures the active AAC encoder/decoder pair once per sample
rate/channel configuration. It uses a reserved MP4 edit list to skip measured
priming and limit playback to the intended duration. No PCM content is deleted,
no video is shifted, and 44 ms is not hardcoded. Streaming retains only metadata,
not the full movie. Inconclusive calibration fails with an actionable error
instead of silently claiming synchronized output. Native FFmpeg is unchanged.

The live diagnostic also observed AbortError before start, during PCM mixing,
during video frames and at finalization. These are production engine tests, not
proof of UI Save-dialog cancellation. Unit tests cover version 0/1 edit lists,
reserved fast-start padding, malformed metadata, stream/buffer equivalence,
abort vs. destination close and write failures. A native file-picker reload also
confirmed a fresh silent-scene draft produces 3 cuts / 6.00 s. Later browser
automation timed out during the exact-end scrub check; that gate remains open.

These deterministic fixtures establish timing correctness on this machine, not
cross-platform codec certification, creative quality or long-project reliability.

Final follow-up validation (September 29): TypeScript passed, scoped lint passed,
**949/949 tests passed**, and both web production and desktop renderer builds
passed. The 11 new focused tests cover audio delay and safe MP4 delivery. The
repository-wide lint run was stopped after more than ten minutes without
completion; scoped lint and all other listed checks subsequently completed after
system responsiveness improved. Existing dynamic-import/large-chunk warnings
remain. No new packaged or notarized artifact was produced.

Additional safety fix: failed encoder/metadata/payload writes abort the direct
destination and release its lock instead of committing partial output during
muxer cleanup. The main-thread delivery fallback also aborts its opened writable
on capability/preflight errors. Source audio samples close even when encoding
throws. These changes have unit coverage; native Save-dialog interaction remains
unverified.

The final UI retry explicitly reported that the Mac is locked and requires manual
unlock. Exact-end draft scrub, analysis cancellation and native Save-dialog tests
remain pending. No attempt was made to bypass the lock.

### Original pass: outstanding UI qualification

The Mac locked during the final fixture reload. Native file-picker automation
explicitly required a manual unlock. Do not work around the lock. QA server and
fixture outputs were retained to resume after unlock.

- Final-frame hold fix is unit-tested and built, but its final live retest is pending.
- Cancellation during analysis, Save dialog and active encoding remains pending.
- Silent-scene MP4 export, embedded-music video, dense music cuts, and persistence
  round-trip checks remain pending.
- **Audio-sync investigation:** comparing 5ms RMS envelopes of source and exported
  AAC, both decoded to mono 8kHz, gave the best ±150ms alignment at approximately
  **+50ms** (correlation 0.9034). Raw waveform correlation was weaker and periodic
  (+59.125ms, 0.6937). This is a measured warning, not an isolated root cause.
  Do not insert a hardcoded offset. Repeat with an impulse/WAV source, inspect
  decoded PCM before encoding, compare AAC/WebM and browser/native output, and
  inspect encoder priming/edit-list behavior before changing transport or timestamps.
- Draft review remains explicitly silent and omits global finishing; full sound
  and global look are reviewed after Apply. This pass did not expand that contract.
- Packaged Electron/native export and representative long real-footage projects
  still require separate qualification. This is not release certification.
