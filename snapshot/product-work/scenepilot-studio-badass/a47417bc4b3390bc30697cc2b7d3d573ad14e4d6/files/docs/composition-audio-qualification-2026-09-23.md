# Composition audio and native delivery qualification — 2026-09-23

This is a tested engineering increment, not a 10/10 rating, Adobe parity claim,
fully native application claim, or public-release approval. Existing unrelated
changes were preserved. No commit, production deployment, Developer ID signing,
or notarization was performed.

## Implemented

- Shared deterministic composition audio scheduling follows nested constant-rate
  clocks, source offsets, repeated composition loops, layer and group gain/pan,
  fades, muted/hidden tracks and solo. Parent/child rates multiply; cropped fades
  keep their original clocks rather than restarting at an export In point.
- A shared program schedule now feeds video masters, WAV stems and full-program
  loudness preparation. Range cropping preserves gain automation boundaries.
  Intrinsic `__main__` references use the main-file resolver, not a missing bin item.
  Missing/offline audio fails explicitly. Unused stem media is not materialized.
- Cycles, invalid durations, excessive nesting, excessive loop expansion, reverse
  and variable time remapping, and unsupported combined rates produce actionable
  errors. Scheduling is bounded to 64 nested levels and 10,000 windows/segments.
- Composition viewer and master preview share the schedule and audio playback
  component. Constant-rate playback uses matching varispeed; pitch follows speed.
  Nested preview mounts only nearby audio segments. Gain processing updates every
  animation frame; meter publication remains throttled. New gain nodes start silent.
- Native video export can retain FFmpeg encoding while a background worker streams
  the canonical PCM mix to a temporary WAV. This avoids substituting FFmpeg's
  different EQ/compressor/limiter algorithms. The handoff supports both RIFF and
  RF64, validates finalized sizes, serializes bounded 1 MiB writes with backpressure,
  and uses owner-scoped random tokens rather than renderer-selected temporary paths.
  Cancellation, failure and renderer destruction release owned temporary files.
  Older bridges without this facility use the shared renderer for audio masters.
- An explicit silent Pro mix no longer falls back to the original project song.
  Standalone alpha composition export uses its own nested audio and neutral tracks,
  independent of the master sequence's track visibility, blend mode and grading.
  Unrelated/offline project songs no longer block that composition export.
- Audio-only projects can use the Media command on a composition audio lane.
  Commands respect locked destination tracks and fit initial clip duration to the
  available media. Audio-layer inspection hides inapplicable visual controls;
  composition-group inspection exposes audio gain, pan, mute and fades.

The app-shell skill guided the shared scheduling and delivery boundaries rather
than adding another editor-local interpretation. `videoClips` stays authoritative.
The editor shell remains large (7,172 lines); decomposition is not complete.

## Evidence

- Focused tests cover nested rate multiplication, loops, cropped overlapping
  envelopes, tracks/solo, invalid timing, cycles, expansion bounds, bus filtering,
  owner isolation, partial streams, RF64, canceled allocation and cleanup.
- Rendered inspector tests check audio-only Media availability, contextual controls,
  and group audio controls. Delivery-boundary tests check neutral composition tracks,
  no unrelated soundtrack, source materialization, queue failures and launch-lock cleanup.
- Real Electron worker certificate: streamed native PCM and reference WAV decode
  to byte-identical float samples; the test uses three looped segments from a
  trimmed, retimed composition. Native cancellation and temporary-directory cleanup
  pass. Actual FFmpeg MP4 encoding has audio RMSE **0.0018632** against the PCM source
  (threshold 0.03). This lossy AAC result is not byte-identical audio.
- Worker certificate also decodes a deliberately silent MP4 with an available
  main song and verifies there is no audio track. Existing DSP, frame counts,
  varispeed, bounded chunking and cancellation tests remain in the certificate.
  Evidence: `outputs/composition-audio-worker.log`.
- Browser UI on an isolated development origin: created `Composition audio QA`,
  imported a generated six-second WAV, created `Audio nest QA`, selected its audio
  lane, used Media, set 2× speed/three-second duration/0.4 and 0.6 second fades,
  and played it. The real HTML audio element was playing at 2×. Added the comp to
  the main sequence and verified its nested player remained at 2×. Save succeeded.
  Audio inspector showed its fade controls and no Position X control. No captured
  browser console errors. The temporary tab was closed; the synthetic saved QA
  project remains in the local test-origin library. No user project was replaced.
- Transferable worker stream and algorithmic performance checks passed; evidence
  is in `outputs/composition-audio-stream.log` and `outputs/composition-audio-performance.log`.
- Final TypeScript/lint, production build and Electron renderer build: pass.
  Full suite: **828 passed, zero failures/skips**. Entry bundle: **493,905 / 500,000
  bytes**. Other large chunks still warn; this is not a whole-app startup budget.
  Logs: `outputs/composition-audio-{check,build,tests,desktop,bundle}.log`.
- Fresh local desktop candidate: `outputs/composition-audio-desktop/mac-arm64/ScenePilot.app`.
  Its 41-check archive/resource certificate passed, including current runtime modules and
  byte-identical renderer files. Evidence: `outputs/composition-audio-package-certificate.json`.
  It is ad-hoc signed, is not Gatekeeper accepted, and reports
  `publicReleaseReady: false`. The actual packaged application was launched through
  the macOS UI and reached the New Project/editor workspace from its `app.asar`
  renderer. No clean-machine installation or packaged export/reopen cycle is claimed.

## Explicit limits and next engineering work

1. This is **hybrid native FFmpeg video + worker PCM audio**, not a complete native
   AppKit UI or C++ audio engine. Shared blur/transition rendering remains necessary
   where FFmpeg does not match the picture renderer.
2. Live preview is media-element/WebAudio based, not sample-scheduled PCM playback.
   Sample-identical exported PCM does not certify gapless live composition-loop
   boundaries, every WebAudio effect, or long-project real-time sync.
3. Reverse, variable audio time remapping and pitch-preserving stretch remain
   unsupported. Combined constant audio rates must be 0.1–8×. Native PCM staging is
   capped at 4 GB (about 3h51m at 48 kHz stereo/24-bit); larger masters need shorter
   delivery ranges. Disk space can still run out, with explicit failure/cleanup.
4. Normal cancellation/crash-of-renderer cleanup is covered. OS/process termination
   can leave temporary PCM files; startup stale-session reclamation remains open.
5. Editorial splitting inside a fade still needs exact inherited-envelope slicing
   across every editing operation. Sync-lock-disabled insert policy, additional J/L
   cases, and further shell decomposition remain engineering work.
6. Real-camera/VFR long playback, 4K throughput, recovery and sync qualification on
   other machines remain pending. Generated tone/color exports are not that proof.
7. Receiving-editor interchange tests require those applications and licensed test
   projects. OTIO/EDL/FCPXML are not `.prproj`/`.aep` compatibility. The native-port
   migration remains partial, and full professional rotoscoping qualification is
   separate from this audio increment.
8. A Developer ID identity was found in the prior pass, but packaging still selects
   ad-hoc signing. Notarization credentials, clean-machine install/export/reopen,
   oldest-supported macOS and codec/model licensing review remain release gates.

No numerical 10/10 or whole-product completion is inferred from passing this suite.
