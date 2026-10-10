# Editing maturity pass — 2026-09-23

This is an engineering increment, not a Premiere/After Effects parity claim or a public release approval. Existing unrelated working-tree changes were preserved. No deployment, distribution signing, or commit was performed.

## Implemented

- Canonical `videoClips`, audio clips and sequence duration now share a reducer. Edits grow the document without a second undo step; deletion does not unexpectedly shorten it. Paste/duplicate, Source edits and composition placement no longer truncate at the old end. V1 drops no longer discard the inserted tail or ripple-shifted clips.
- Program transport uses the sequence clock, not the original media duration. Source audio stops when its file ends while the sequence can continue. Range, loop, reverse and playback failures have tests. An explicit marked Out still limits playback/export.
- Preview now submits GPU work explicitly and retains a bounded last-decoded picture during asynchronous seeks, rather than repeatedly restarting an in-flight seek or flashing black. Temporary held pictures are not admitted to the exact-frame cache; settled frames use the full-resolution decoder. Seek fallback copies have a 1280-pixel maximum dimension and follow the bounded decoder pool's lifetime.
- Interchange preparation moved out of the editor shell. EDL/FCPXML display omitted-lane/effect warnings; unsupported retiming fails before writing. OTIO preserves one-frame gaps/overlaps in standard structures, not just ScenePilot metadata. File references encode spaces and `#`. Unsupported nested items/effects and unsupported fractional project rates fail rather than silently change the edit.
- Video/WAV destination selection is abortable from the render queue. A late dialog result cannot resume a canceled export. The OS file dialog itself may still require dismissal.
- Package manifests include `render-launches.js`; a regression test catches missing relative runtime imports. Package certification compares all listed runtime modules and built HTML/JS/CSS, and tests bundled media tools independently of developer environment overrides.
- Initial packaged-tool discovery fell back to a system binary while a subsequent direct probe succeeded. The original failed certificate is retained as `outputs/maturity-desktop-final/first-probe-certificate.json`. Absolute-path helper probes now allow 15 seconds instead of 3 for bounded first-launch checks; final certification must still prove that the selected executables are inside the bundle.
- Additional shell boundaries: sequence state reducer/hook, document clock/transport, interchange preparation and abortable asynchronous waiting. The editor shell is still large; decomposition is not complete.

## Reproducible verification

- `npm run check`: TypeScript and lint passed.
- `npm run test:quick`: 800 tests passed.
- Production build and Electron renderer build passed. Entry budget: 491,932 / 500,000 bytes. Other large renderer chunks still produce build warnings; this is not a whole-application bundle budget.
- `npm run qa:release-stress`: repeated 30-second 4K renders, cancel/retry, existing-output preservation, concurrent proxies and interrupted-save recovery passed.
- `npm run qa:pcm-worker`: worker PCM path and cancellation passed.
- `npm run qa:main-source`: generated real-media pixel checks passed.
- `npm run qa:performance`: all reported algorithmic budgets passed. These do not measure human-perceived playback smoothness.
- `npm run qa:long-project`: NEW ten-minute native export, 60 generated clips, H.264/ProRes, 23.976/25/30 fps, landscape/portrait, 48 kHz audio. Output audio and video durations both 600.000 seconds; decoded picture samples at beginning, format changes, midpoint and tail passed. 68,867 ms on this machine at 320×180 output; NOT a ten-minute 4K playback qualification. Evidence: `outputs/long-project/report.json`. The test is wired into `qa:product -- --full`; the full product campaign was not rerun in this increment, only the individually listed suites.
- `SCENEPILOT_ISOLATION_QA_ROOT=/Users/lillypad/Downloads/scenepilot-studio-0.1.6 npm run native:test`: 106 native tests, zero failures, including Core ML alpha sidecar integration; no skipped test in this run.
- Local ad-hoc Mac candidate: `outputs/maturity-desktop-final/mac-arm64/ScenePilot.app`. The earlier candidate launched into the editor; this final candidate refreshes the renderer with the preview fixes. Final package certification passed all 40 checks, including 90 byte-identical built HTML/JS/CSS files, bundled engine discovery, models and signature integrity. Evidence is alongside it in `certificate.json`; neither candidate is Developer ID-signed/notarized. It is still Electron Pro, not the separate native AppKit migration app. A complete interactive install/export/reopen cycle of this final package on a clean Mac remains pending. Individual test/build logs are retained in its `evidence/` directory.
- Browser UI: six-second source edit duplicated to twelve seconds; Undo restored six; Redo restored twelve; transport reached twelve; saved project restored its two clips and twelve-second duration. Destination-wait cancellation returned the queue to zero active jobs and restored editing controls. Actual blue picture was visible after reopening and while playing the duplicate beyond the original source's six-second boundary. This short synthetic color fixture does not establish long real-footage playback quality. Zero captured browser console errors. Layout inspected at 1280×800, 1440×900 and 1920×1080; no horizontal document overflow.

## Remaining release gates

1. Real-camera, variable-frame-rate and longer project playback/sync qualification on more than this Apple Silicon development machine. Synthetic export is not a substitute.
2. Clean-machine installation, oldest-supported macOS testing, Developer ID signing/notarization and distribution-license review of bundled codecs/models.
3. Native-port compatibility is explicitly partial. The existing native Editorial Rebuild preserves limited linear editorial data and archives the source; it is not a lossless conversion of effects, motion, audio routing or nested compositions. See `native-editorial-isolation.md`.
4. Actual receiving-editor round trips in Premiere, Resolve and Final Cut with reference movies/stems. ScenePilot OTIO metadata is not Adobe project/plugin compatibility. EDL and FCPXML remain constrained picture handoffs.
5. Further shell decomposition (the page remains 7,178 lines) and complete accessibility/real-project usability qualification. No numerical 10/10 claim is made.

## Cross-machine acceptance record

For each machine record model, memory, architecture, macOS, exact candidate hash and media-bundle hash. Use the same licensed 30–60 minute camera/audio project. Record sustained playback dropped frames, A/V sync at start/middle/end, scrub latency, peak memory, export time, cancellation during preparation/render/finalization, missing-media relink, restart recovery and preview/export comparisons. Attach output files and logs. A blank entry is pending, never passed.

The app-shell skill guided the authoritative state boundary and shared transport work; it did not justify claiming the entire native migration or workspace refactor complete.
