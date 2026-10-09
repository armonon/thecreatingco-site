# ScenePilot Golden Project — qualification specification

**Status: IN PROGRESS, not qualified.** Five synthetic media fixtures and their SHA/probe manifest are generated under `reports/scenepilot-golden-release18/fixtures/`. Narrow real desktop import/grid/Save/native-IPC output checks passed; the complete recipe below remains unverified. See `reports/scenepilot-golden-release18/FINDINGS.md` and exact-head receipts.

## Purpose

Repeatably qualify the core workflow in both Browser Lite and Desktop Pro:

**Import → Edit → Composite/Animate → Audio → Save → Reopen → Export**

Use a fresh project per product edition and record exact application build, source commit, OS/browser/device, media hashes, commands, timings, observations, and output hashes. Do not overwrite earlier evidence.

## Fixture to generate

Generate the following using local FFmpeg/SVG tooling (no stock/licensed footage):

- `sp-golden-main-30fps.mp4`: 12 s, 1920×1080, H.264, 30 fps, deterministic color bars/grid plus moving labeled shapes and frame/timecode burn-in.
- `sp-golden-broll-24fps.mp4`: 8 s, 1280×720, H.264, 24 fps, deterministic moving shapes and burn-in to exercise mixed source rates and dimensions.
- `sp-golden-overlay.png`: 640×360 transparent title card with visible safe-area guides.
- `sp-golden-music-48k.wav`: 20 s, stereo 48 kHz, deterministic tone/chord pattern with transient clicks on known beats; include expected duration/peak/RMS metadata.
- `sp-golden-sfx-44k.wav`: 3 s, mono 44.1 kHz, deterministic short tone to exercise resampling and clip gain.

Record SHA-256, stream metadata (`ffprobe -show_streams -show_format -of json`), generator version/command, and expected sample/frame landmarks in a fixture manifest. Keep media local and small enough for repeatable laptop qualification; separately generate larger stress variants only for the performance campaign.

## Edit recipe

1. Create a named 1920×1080, 30 fps, 12 s project. Import all generated assets; confirm duration, frame rate, dimensions, audio channels/sample rates, and stable media identities.
2. Place the main clip on V1 from 0–12 s. Place two non-overlapping B-roll ranges on V1 after trimming and splitting; add one overlay image/title on V2. Include a small gap, then close it with the product's normal edit operation.
3. Add one transform keyframe pair to the title (position and opacity), a supported transition or effect on a cut, and a color adjustment whose preview result can be verified against a simple expected-color patch.
4. Place music on A1 and SFX on A2. Trim, move, set clip gain, add a short fade-in/fade-out, and verify both meters and final audio are present. Avoid relying on subjective music-quality judgments for deterministic checks.
5. Exercise undo/redo around a destructive trim, title move, and parameter change; verify one logical action per undo step and exact restoration.
6. Save to a new `.scenepilot`/supported project document, record byte size/hash and parsed asset/sequence/effect/keyframe/automation inventory. Close the document and application cleanly.
7. Reopen that exact path. Compare project schema and all persisted IDs, timing, media references, transforms, effects, keyframes, audio parameters, and output settings. Confirm no silent asset substitution or missing-media state.
8. Export a 12 s H.264 MP4 at 1920×1080/30 fps with audio. Record logs and hash; use ffprobe to verify codec, dimensions, rates, duration, streams; decode frames/audio around prescribed landmarks. Compare preview and export for title motion, transition/effect, color patch, clip cut points, and audio onset/fade.
9. Copy the project and fixture to a second path, temporarily remove one media file, reopen to verify an explicit offline/relink workflow, then restore/relink and verify stable references. This is an additional recovery case, not a reason to alter the pristine golden artifact.

## Qualification matrix

Run the recipe independently on:

- Browser Lite: current supported browser and OS; record browser version and export save-dialog completion.
- Desktop Pro: packaged candidate on macOS Apple Silicon; record architecture, signature/notarization state, native helper/model availability, and whether export uses native or shared renderer.

Do not generalize a pass across browsers, operating systems, codecs, or editions. Repeat core import/edit/save/reopen/export at least three times from clean project copies before claiming repeatability. Run an additional long-media/memory stress qualification separately; the small fixture is not a performance envelope.

## Evidence and pass criteria

Attach generated fixture manifest and hashes, exact app build/source fingerprint, raw command output, application logs, project inventory before/after reopen, export probe/decode results, and a reviewer-signed perceptual comparison.

Pass only when all of the following hold: no loss or mutation of imported assets/settings; undo/redo round-trips exactly; reopened project reproduces the edit and linked media; exported metadata/timing/audio are correct; deterministic frame samples match expected output; reviewer confirms preview/export parity for the selected effect/transition/motion/color; errors and relinking are explicit and recoverable. Any failure creates a reproducible bug with fixture copy, expected/actual, logs and regression test. Missing evidence is **NOT VERIFIED**, never PASS.

## Bounded checkpoint — 2026-10-08T08:05Z

Three schema-authored development-Electron12s composite projects passed persistence/UndoRedo/coldreopen/export;42 independent sampled output checks passed. BrowserLite one supported12s cutimport/silent720p lifecycle passed; actual menu obstruction fixed/reviewed/pushed PR95. Full UI-authored/packaged/perceptual qualification remains incomplete. Dated evidence: `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-golden-20261008T0740/README.md`. Historical release18 fixtures/evidence actually live in parent company `reports/scenepilot-golden-release18/`, not lab reports.
