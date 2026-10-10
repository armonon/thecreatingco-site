# Feature wiring audit — 2026-09-21

## Verdict

The shared web/Electron editor has substantial connected functionality, but **not every feature is certified end-to-end**. This pass fixed concrete command-routing, source audio, transcription lifecycle, and test-harness defects. It did not certify the separate AppKit preview as equivalent to Electron Pro.

Final automated evidence: `outputs/wiring-audit-final-20260921/qualification-report.json` — **13 automated gates passed, zero failed; 10 required perceptual gates remain pending**. The full deterministic suite passed **780 tests**. `npm run build`, project-intelligence certification, and the accessibility audit also passed. Accessibility coverage was the new-project dialog, edit workspace, and delivery workspace, not every dialog.

These results apply to the local source tree, not the existing deployed site or the earlier composition-preview DMG. No production deployment or installer replacement was performed in this pass. Existing unrelated working-tree changes were preserved.

## Repairs made

- Source-monitor I/O shortcuts and Electron menu marks now use the source playhead/range instead of changing the hidden main sequence. Source buttons share that routing. Composition work-area marking explicitly reports unsupported rather than changing a different document.
- Left/right frame stepping now targets Source, Composition, or Program correctly, with frame snapping, duration bounds, and Shift one-second stepping. Modified arrow keys are not hijacked.
- Imported audio now has an actual media playback element in Source; play/pause and time updates are connected. Audio Insert/Overwrite remains deliberately disabled: audio is added through audio-track placement.
- Rate Stretch, Hand, and Zoom are present in the command palette; Hand/Zoom and New Composition are connected in the Electron menu. Pro tools are excluded from Lite's palette. Native tool actions use an explicit allowlist.
- Transcription closes its audio context after decode errors, respects cancellation before and after decoding, terminates its worker on dispatch failure, removes abort listeners when finished, and rejects missing 16 kHz resampling instead of sending incorrectly labelled PCM.
- Release-source hashing now records deleted tracked assets instead of crashing on old build hashes. The source fingerprint still changes for deletions.
- PCM certification reserves a free local port and waits for its own server readiness. Previously it could attach to an unrelated preview on fixed port 4188, reporting an opaque module-worker error. The unrelated preview was left running. PCM certification now includes useful load diagnostics.

## Coverage matrix

“Automated” below means the named contracts/fixtures passed; it does not mean every UI combination or codec was manually exercised.

| Feature family | Connected path / evidence | Remaining validation boundary |
| --- | --- | --- |
| Project media / relinking | UI import succeeded for real MP4 and M4A; session-isolated linked-media decoding and pixel reads passed; project-store/release-persistence tests passed | Every offline/relink/permission scenario is not covered by this UI pass |
| Source / editing commands | New monitor-routing and registry tests; 43 registry actions each invoke their binding exactly once; disabled command test; bounds and frame-step tests | Live source playback and menu interactions need a completed smoke pass; see browser issue below |
| Timeline / tracks | Unified video-timeline, clip edits, transitions, audio fades, grouping and composition-track regression suites | Subjective editing feel and a complete right-click/shortcut/menu action matrix remain pending |
| Compositions / masks / animation | Composition creation, tracks, coordinate, 3D and rendering regressions; real MP4 nesting/effects certificate passed | Every Bezier/keyframe/nested matte combination has not been manually inspected |
| Effects / grading / generators | Effect graph, plugins, preview/audition and clip-effect tests; native pixel parity and real-media render certificates passed | Full perceptual grade/effect-gallery parity review remains pending |
| Auto Edit / project intelligence | Deterministic project-intelligence tests and dedicated generated-fixture certification passed | Real dialogue/music variety, artistic quality and first-project usability are not certified |
| Transcription / captions | Cleanup/cancellation/resampling regressions added; transcript-edit tests passed | First-use model download and real speech recognition were not run in this pass; Whisper remains a network-loaded beta feature |
| Audio / stems / mix | Worker PCM certificate: 48,000 frames in 47 chunks, stereo pan/gain/fades/automation/processing, MP4 + WAV encoding, cancellation passed; stem and delivery tests passed | Listening review and long-form audiovisual sync remain pending |
| Roto / removal | Roto-memory, provider security and real neural inpaint inference passed | Difficult hair/occlusion and long-range removal perceptual gates remain pending; these tests do not establish perfect semantic isolation |
| Delivery / recovery | Background direct-to-disk stream, native/shared render contracts, queue-recovery and persistence regressions passed | Packaged-app recovery, signing/notarization and ten release review gates are not cleared by this audit |
| Performance / accessibility | 4K/20,000-clip benchmark gate; axe audit of three workspace states | Not an all-hardware performance guarantee or full keyboard/screen-reader audit |

## Known limitations and follow-up priorities

1. **Finish the UI action matrix.** In the isolated localhost session, project creation and importing real video/audio were verified. Opening the audio Source control then caused repeated browser-control timeouts. A fresh tab mounted without recorded console errors, but further clicks did not visibly complete project setup. This is inconclusive: do not mark source playback or the whole interface passed based on unit tests. The user's existing editor was not reset or modified.
2. **Unify remaining transport/clipboard surfaces.** J/K/L still invokes the sequence shuttle path rather than a dedicated source shuttle. Electron Edit-menu Cut/Copy/Paste/Select All uses native roles, while timeline clipboard/select commands live in the keyboard hook; menu equivalence is not established. Multi-selection/audio clipboard coverage needs explicit product contracts and integration tests.
3. **Composition work areas are not implemented.** The new routing makes this limitation explicit. Source audio playback does not add audio Insert/Overwrite semantics.
4. **Run the ten pending release reviews** using the generated qualification review instructions and assets; record results against the same source fingerprint. Render/pixel fixtures are not a substitute for these reviews.
5. **Rebuild and separately qualify a new Electron installer** after final fixes; the previously packaged composition-preview app does not contain this audit's changes. Keep AppKit-native capability claims separate from Electron's shared compositor. The intentional native-render fallback preserves preview/export parity; it is not an unwired control.

## New regression files

- `tests/monitor-commands.test.mjs`: source/program targeting, composition refusal, short-media bounds, active-monitor frame stepping.
- `tests/transcribe-client.test.mjs`: device cleanup, missing resampling, decode-time cancellation, worker dispatch cleanup.
- Updated `tests/editor-command-registry.test.mjs`: tool coverage and Lite filtering.
- Updated `tests/release-evidence.test.mjs`: deleted tracked assets, untracked additions, repeatable source fingerprint.

No blanket “all features wired” or “release-ready” claim is justified yet.
