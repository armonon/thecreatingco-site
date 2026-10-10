# Editorial audio qualification — 2026-09-23

This increment addresses the concrete Source-edit and linked-audio defects found
in `clip-first-qualification-2026-09-23.md`. It is not a 10/10 rating, Adobe feature
parity claim, complete native-port claim, or public-release approval.

## Implemented

- Source Insert splits crossing V1 picture and audio, then shifts the tail and
  following unlocked audio. Source Overwrite preserves intersecting audio heads
  and tails instead of deleting whole clips. Unrelated audio lanes are retained.
- A pure `planSourceEdit` transaction checks affected protected picture, linked
  audio locks and destination locks before the UI checkpoints or mutates state.
  Surviving pieces keep source offsets, interpolated gain automation and video
  links; generated tail IDs remain unique over repeated splits.
- Source fit-to-fill and selected-clip fit share the transaction. Unsupported
  fits outside 0.1–8× are rejected instead of silently clamped. Linked reversed
  or time-remapped clips cannot be fit as if they were constant-rate audio.
- Constant positive varispeed now travels through AudioClip, live media playback,
  worker PCM, native FFmpeg, ordinary WAV stems, export range offsets and OTIO
  LinearTimeWarp. Pitch follows speed; this is **not pitch-preserving stretch**.
- Inspector timing edits retime linked audio, preserve J/L source offsets, and
  honor linked audio-track locks. Audio source-handle controls account for speed.
- J/L edits no longer accumulate source-offset errors when reapplied. Crossfades
  convert source handles into timeline seconds before borrowing them.
- Preview and PCM share one fade-shape/envelope function. Overlapping fade-in/out
  envelopes multiply. Native linear, quarter-sine and quadratic fades are checked
  against this function using actual decoded samples.
- Native stereo panning no longer attenuates a centered stereo clip by 3 dB and
  now includes stereo crossfeed. Mono source channels are probed before building
  the native mix, avoiding an extra stereo-upmix attenuation. Native default
  compression is now bypassed, matching the default channel-strip setting.
- OTIO retains exponential fades and constant-rate audio timing. Standard audio
  timewarp timing is tested with all ScenePilot metadata removed; this is not a
  receiving-Adobe-application round-trip certificate.

The app-shell skill guided the extraction of pure editorial planning and shared
timing/envelope logic. The canonical `videoClips` store remains authoritative.

## Verification

- TypeScript and lint: pass.
- Full tests: **814 passed, 0 failed, 0 skipped** in the final rerun recorded in
  `outputs/editorial-tests.log` after the production build finished. One overlapping
  build/test invocation invalidated its own server-render fixture while rebuilding
  `dist`; that invocation was not accepted as a qualification run.
- Production and Electron renderer builds: pass. Final entry bundle is
  **495,904 / 500,000 bytes**. Other large chunks still warn; this is only the entry
  budget, not proof of whole-application startup/memory performance.
- Worker PCM: 0.5×/2× 440 Hz test media produces 220/880 Hz, expected sample counts
  and silence after end-of-source. Existing bounded mixing, cancellation and WAV
  checks pass (`outputs/editorial-varispeed-worker.log`).
- Real FFmpeg regressions check varispeed source-window length, both stereo and
  mono panning across five pan positions, and all three overlapping fade shapes.
- Native generated-media certification: pass (`outputs/editorial-media.log`).
- Ten-minute mixed-format export: 60 generated H.264/ProRes clips at mixed source
  rates/aspects, 48 kHz audio, output endpoints within one frame, decoded picture
  samples at the head/format boundaries/middle/tail. **41,611 ms**, 320×180 output
  on this machine (`outputs/editorial-long-project.log`). Not 4K playback evidence.
- Generated 30-second 4K render/cancel/retry, prior-output preservation, concurrent
  proxies and interrupted-save recovery: pass (`outputs/editorial-release-stress.log`).
- Algorithmic performance budgets: pass (`outputs/editorial-performance.log`).
- Final main-source render certificate: 9 actual MP4 pixel checks passed
  (`outputs/editorial-main-source.log`). Accessibility audit: all 3 audited states
  passed with no reported violations (`outputs/editorial-accessibility.log`);
  this is not every possible application state.
- Browser QA on an isolated development origin: import two six-second MP4s with
  embedded audio; Source Overwrite into empty V1; insert inside the blue clip at
  2.01s; verify blue head/red insert/blue tail and corresponding three audio pieces;
  Undo restores one picture/audio pair; Redo restores all three. Red picture visible
  in Program. Save succeeded. A reload call returned the expected state but is not
  counted as independent cold-start restoration evidence here.
- Live inspector speed change to 298% sets the corresponding HTML audio player's
  playbackRate to 2.98; Undo returns every player to 1. No captured console errors.
  Temporary QA tab closed. The saved synthetic test project remains in the local
  QA-origin library; no user project was replaced.

## Desktop candidate

Initial `outputs/editorial-desktop` candidate intentionally failed its source
freshness certificate after a later media-engine edit. It is not a deliverable.
The final rebuilt candidate and its certificate are tracked separately under
`outputs/editorial-desktop-final` and `outputs/editorial-package-final-certificate.json`.
Its **40 archive/resource checks passed**, including source freshness. It is
ad-hoc signed, is not Gatekeeper accepted, and reports `publicReleaseReady: false`.
Neither a package build nor an archive certificate proves clean-machine installation.

A valid Developer ID Application identity is installed. The current packaging
configuration still selects ad-hoc signing; the local packaging hook reported no
configured Apple notarization credentials. No public distribution/deployment occurred.

## Still open — do not hide behind a numerical score

Follow-up: `composition-audio-qualification-2026-09-23.md` addresses nested audio
timing and routes native masters through canonical worker PCM. The limitations
below describe this earlier checkpoint; the follow-up records its narrower
remaining live-preview and delivery limits without implying full audio parity.

1. Nested composition audio schedules do not yet carry the product of placement
   and layer playback rates through every preview/export route. Constant-rate
   ordinary timeline audio is the qualified scope above, not all composition audio.
2. Reverse/variable time-remap audio and pitch-preserving stretch are not implemented
   by this varispeed change. Source-independent audio offsets need broader J/L testing.
3. Native EQ/compressor/limiter algorithms are not sample-identical to the PCM/live
   channel strip. The native panning/fade tests do **not** certify every DSP control.
4. Splitting within a fade retains outer fade controls, not an exact sliced copy of
   every possible overlapping fade envelope. Sync-lock-disabled insert semantics
   also need a separately specified and tested policy.
5. Real-camera/VFR long playback, audio sync and recovery need qualification on
   additional machines. Generated exports do not replace those measurements.
6. Receiving-editor interchange tests require those applications and licensed test
   projects. Native AppKit conversion remains partial; OTIO is not .prproj/.aep support.
7. The editor shell is still 7,187 lines. Further decomposition and full keyboard,
   accessibility and real-project workflow qualification remain engineering work.
8. Distribution requires Developer ID configuration, notarization, clean-machine
   install/export/reopen testing and codec/model licensing review. These release
   gates remain distinct from the engineering tasks above.

No unrelated marketing changes were staged, committed or deployed in this increment.
