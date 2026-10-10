# Expanded verification — 21 September 2026

## Result: not a complete release sign-off

This was a verification-only pass: no application behavior was changed, committed, deployed, or repackaged. Existing working-tree edits were preserved. Builds and disposable QA media/projects were generated.

Candidate source SHA-256: `b473523cb93a34fd850383bbd04b80d5b6407d33fec363507a6242ddda6eff0a`.

The standard campaign passed all **13 automated gates**, including **780 deterministic tests**. Its release verdict remains **pending**, with ten perceptual acceptance gates open. Expanded checks found a reproducible Source transport problem, a failed bundle-size budget, and a native-inference timeout that passed on retry. Do not summarize this as “everything verified.”

Evidence root: `outputs/verify-all-20260921/`. Standard machine-readable result: `qualification-report.json`. Additional command logs are copied into `evidence/scenepilot-verify-*.log`.

## Automated results

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript + lint | Pass | Current source tree |
| Full deterministic suite | Pass: 780/780, no skips | Includes monitor routing, commands, serialization, effects, timeline, masks, audio and render contracts |
| Standard product campaign | Pass: 13/13 automated | Background stream, linked-media decoding, worker PCM, native pixel parity, MP4 edits/effects/nesting, inpaint security + real model, generated native render, roto memory, 4K/20,000-clip budget, Lite build |
| Production build | Pass | `npm run build`; framework static route-classification warning remains |
| Desktop renderer build | Pass with size warning | `npm run desktop:renderer`; not a new DMG |
| Entry-bundle budget | **Fail** | Production entry 521,130 bytes; limit 500,000; 21,130 bytes / 4.23% over. Required lazy chunks exist. Rechecked after fresh build with same result |
| Project intelligence | Pass | Generated fixtures, not a real-dialogue recognition quality score |
| Accessibility | Pass | New-project dialog, edit workspace, delivery workspace; no reported violations in these states, not exhaustive screen-reader coverage |
| 4K stress/recovery | Pass | Three generated 30-second 4K exports with audio; cancel preserves old master; missing media preserves prior export; concurrent proxies; interrupted atomic save; retry; unwritable destination |
| Disk pressure | Pass | Dedicated 32 MB disk image, real ENOSPC, old project preserved, save retries after freeing fixture space; not the system volume |
| Native Swift suite | Pass: 106 tests, 1 skipped | Native migration subset; one model-integration test requires an environment variable |
| Previously skipped native isolation test | **Pass when explicitly enabled** | Real Core ML alpha sidecar, alpha range, native composition export and project save/load; 0.1-second fixture, not long-video qualification |
| Electron native SAM2/ViTMatte certificate | **Timeout first run; pass on retry** | Initial service request hit its 120-second timeout. Retry: alpha range 0–255, 673 soft pixels, persistent service and learned feature memory used. Preserve the failed attempt as reliability evidence |
| Diff whitespace validation | Pass | `git diff --check` |

The computer was under substantial concurrent workload during testing. That is context for long runtimes and the inference timeout, not proof of the timeout's cause and not permission to erase it. Native 4K export timings were approximately 130, 63 and 74 seconds for 30-second fixtures.

## Direct UI checks on current source

Tested in an isolated localhost Pro-UI session at port 4051, not in the user's existing project or old packaged app. A localhost Pro override is not proof of Electron bridge functionality.

- Created a disposable project and imported the existing 12-second M4A fixture.
- Opened audio in Source by double-clicking the media row; Play became Pause and source time advanced to 1.86 seconds.
- Seeked Source to 1 second, marked In, then stepped right once: Source displayed 1.03 seconds at a 30 fps project rate; In remained 1.00 seconds. This closes the earlier inconclusive source playback/mark/frame-step smoke check for these operations.
- **Reproduced Source L failure:** pressing L reported “Forward shuttle · 1×” but did not start source playback or advance the source. K was used to stop the sequence shuttle. Code inspection confirms J/K/L uses `videoRef` and sequence playback state rather than `sourceVideoRef`. Treat the J/K/L family as not source-verified.
- Loaded real MP4 footage as the master source; the editor detected a video/cinematic source and showed a live preview.
- Right-clicked the main clip and invoked “Edit this clip”; the V1 inspector opened.
- Split at 2 seconds; two 2-second clips appeared. Undo restored one 4-second clip; Redo restored the split.
- Applied the Noir preset; the inspector showed Monochrome, Punch Contrast and Glow with their controls.
- Saved to the local Pro library; the editor reported successful save and cleared Unsaved.
- Created “Verification comp” with custom 1080×1080 dimensions; it appeared in the horizontal tabs with Main Sequence first and in the composition count.
- Added a text layer and a second video track; the layer appeared in the viewer and track list. Invoked the track-down action and saved; exact persisted order was not independently rechecked.
- Switched back to Main Sequence, reloaded, closed the new-project dialog, and selected the saved project. The app reported restoring two timeline items and effects; the 1080×1080 composition with one layer reappeared. Exact restored effect values were not independently inspected after reload.
- Queued a four-second MP4 export; preflight reported supported and the queue created a job. **End-to-end completion is pending:** the parity path waits for `showSaveFilePicker` before starting encoding. The browser-host Save dialog cannot be controlled through the permitted app surface; the user was asked to save or cancel it. The queue displays “RENDERING · 0%” during this wait, with no active-render cancel button yet. This is a misleading preparation state, not evidence that encoding failed.
- Browser console inspection before the Save-dialog blocker recorded no warnings/errors. This observation is bounded to the tested session, not every feature.

## Remaining failures, risks and unverified scope

1. **Source J/K/L targeting — confirmed failure.** Route source transport to its own media element and playhead; verify forward/reverse speeds, stop, switching monitors and keyboard/menu consistency.
2. **Bundle-size budget — confirmed failure.** Reduce the entry chunk below 500,000 bytes without relaxing the budget; rerun both browser and desktop builds.
3. **Native inference cold-start/load reliability — intermittent failure.** Investigate the 120-second timeout; distinguish model load, inference and memory pressure. The retry and short native sidecar test do not certify long shots or difficult hair/occlusion.
4. **Export UI waiting state — confirmed misleading status; completion unverified.** Represent destination selection as preparation, not active encoding. Finish the browser Save dialog, then check the output and preview/export agreement.
5. **Electron clipboard menus — still unverified.** Native roles for Cut/Copy/Paste/Select All differ from timeline keyboard implementations. No destructive clipboard action was attempted on the user's open packaged project. This needs an isolated current-build Electron session.
6. **Composition work-area marks and source audio Insert/Overwrite remain unsupported**, as documented in the previous audit; they are not newly completed features.
7. **Release acceptance remains open:** ten perceptual gates, complete UI command matrix, screen-size/keyboard coverage, long real-media projects, all codecs, and packaged signing/notarization were not established by these tests. The deployed site and previous DMG were not updated or certified against this source fingerprint.

Priority next work: Source transport, destination-selection/cancellation state, clipboard command unification, bundle reduction, and repeatable native-model cold-start verification. Then repeat the real-media UI/export campaign and record the outstanding perceptual gates against the resulting candidate.
