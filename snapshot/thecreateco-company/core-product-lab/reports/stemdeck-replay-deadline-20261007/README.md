# Actual captured replay deadline investigation — 2026-10-07

Task CORE-STEM-REPLAY-DEADLINE-001 owned by stemdeck-replay-20261007. Isolated follow-up branch core-lab/stemdeck-replay-deadline-20261007 starts at reviewed/pushed PR33 candidate af10e31. Runtime source unchanged at first measurements; no guard or admission limit changed.

Use only the owned generated four-deck capture profile stemdeck-fourdeck-GAaFjR. This contains original synthetic media and preserved source/master/events, not private files or physical input. Diagnostic prototype wrappers return the original result and never alter scheduling, rendering, decoded audio or source data. Long-task observer and CPU sampling are measurements, not a performance pass.

initial-actual/ reproduces real grain deadline misses54–96ms and later source underruns near source offset9.945s with only0/4s pages retained. Observed main-thread long tasks up to1013ms and expensive grain-pump calls. This is correlation, not yet a root-cause conclusion. PerformancePlayer stage wrappers did not bind the active Vite HMR-query module, so those stage observations were unavailable; do not call the empty stage list evidence of no work.

actual-modules/ uses the real requested module URLs (including Vite query), plus CPU sampling, to locate queue/preparation cost before any code change. Original take remains available. Follow-up will correct prior optional-harness wording: already-stopped decks are not automatically proven to have reached a natural end.

PR33 hosted checks are not started: stacked base is outside workflow's main/develop trigger. No manual hosted dispatch/retry during billing outage; required remote status remains unresolved, no merge/deploy. Local exact gate evidence is not a replacement for required GitHub context.

## 21:05 PDT measured repair candidate (uncommitted, not reviewed)

CPU profile actual-modules attributed 16.54 s self CPU to standardized-audio-context detectCycles. Package is latest 25.3.77. The graph enumerates all possible acyclic paths on each grain connect/disconnect. A version/source-hash-fenced postinstall patch adds a linear reachability precheck; only provably unreachable roots skip enumeration. All reachable-root cases retain the original enumerator and bookkeeping. Both ESM and bundled entry points patched; no graph, audio rendering, scheduler threshold, source data or persistent graph cache change.

Actual same-profile UI replay after candidate: no observed grain failures, no grainPump call over 10 ms, no measured main-thread task over 50 ms, and actual UI printed the edited performance. This is a representative probe, not complete parity/release qualification. Seven targeted tests pass including 1,024 exhaustive three-node directed graphs with/without delay; a 14-stage diamond reduced graph reads from >60,000 to 43, with upstream cycle paths/order preserved.

Parent communication currently fails with 'agent thread limit reached'. Independent review is REQUIRED before pushing this follow-up candidate. Pending full lifecycle/parity, mandatory local gates, production-bundle check and parent review. Earlier PR33 exact-head evidence remains valid for its narrower changes and does not imply replay passed.

## 21:09 PDT long actual lifecycle milestone

long-ui-probe/report.json PASS on the uncommitted candidate. All four decks remained playing through a 12-second continuous interval before explicit pauses, crossing multiple decoded windows. Actual print reports 0 late controls. Browser-close/reopen and fresh-profile portable restore preserve all39 audio assets and exact exported master PCM646336frames at48kHz stereo. The original safety audio and capture history remain unchanged. This verifies archive/export identity, not sample-identical original AAC reference versus live-engine print. Mandatory full local gate running on the frozen source snapshot. Parent independent review requested successfully after earlier tool failures cleared.

## 21:12 PDT local checkpoint — independent review pending

Committed local-only c15bb06 for the unchanged clean-head gate. Not pushed, merged, deployed or independently approved. Parent currently interrupted; review request queued. Scope6files: package.json/lock, installer, optional UI lifecycle harness,8regressions, scoped documentation. Targeted8tests/lint/diffcheck passed. Mandatory gate's initial dirty preflight correctly ran0checks; not represented as pass. A fresh Node22 npm ci is verifying reproducible postinstall before exact-head gates.

Actual original lossless master versus live-engine print (same13.365s capture): middle interval0.75s..duration−0.4s zero-lag correlation0.9999999999999709, maximumerror1.1176e-8, relativeRMSerror2.5269e-7. No synthetic replacement, alignment offset0samples; intro/outro and fullmusicalqualification remainoutside scope.

## WebKit storage-mode finding

An isolated browser-only fixture reproduces the earlier setup error with no app code: WebKit26.5 ephemeral context accepts a string and ArrayBuffer but rejects a3-byte Blob with UnknownError: Error preparing Blob/File data to be stored in object store. The same fixture in an owned persistent profile passes all3writes. See webkit-storage-probe.json and webkit-persistent-storage-probe.json. This identifies the ephemeral Blob path, not a global Safari regression or a reason to claim all platforms passed. Persistent native arrangement qualification is next after current exact-head audio checks finish.

## Final local checkpoint — 21:27 PDT

**Source:** c15bb06a87b150a966e8c563457de4f2786ba141 on core-lab/stemdeck-replay-deadline-20261007. Clean, local only. Base af10e31 / PR33. Not pushed, merged or deployed. Independent parent OpenAI review remains pending; parent thread was interrupted. Review-ready exact diff, source hash, evidence index and prepared PR body are retained.

**PASS — mandatory exact-head software gate:** Fresh Node 22.23.2 npm ci reproducibly applied the reviewed-version/source-fenced patch. All 2,250 tests across 247 files, lint, types, build, metadata/service worker/SEO, native/browser audio checks, and unchanged 120-second soak passed. Soak wall time 124.109 seconds. Source remained unchanged and clean; exact-gate/report.json binds the artifact and source. This is not a GitHub check or release approval.

**PASS — actual exact-head UI subset:** 12-second continuous four-deck perform, capture, actual live-engine replay print, source arrangement reconstruction, undo/redo, save, complete browser close/reopen, export, and fresh-profile portable restoration. All four decks remained playing until explicitly paused; no late controls reported. All 39 referenced assets preserved. Master PCM across both reopen paths identical: 644,800 frames at 48 kHz stereo. Original capture events preserved. exact-ui/report.json has sourceDirty=false.

**Measured PCM:** Exact-head original lossless master capture versus actual live-engine print, same event history, interval 0.75 s through duration minus 0.4 s: zero-sample lag; correlation 0.9999999999999596; maximum sample error 9.3132e-9. See exact-capture-print-comparison.json. No fake audio or substituted render output. Intro/outro and full musical cases remain unqualified.

**PASS — production bundle subset:** Served the immutable gate-built artifact locally and printed the same owned capture through the real production UI. A new durable reference lane was added, original capture history unchanged, zero reported late controls, and requested application scripts were built assets rather than /src modules. exact-production-replay/report.json embeds the artifact receipt. This is not a production deployment.

**Platforms — retained failure:** Persistent Chromium 151.0.7922.34: 14/14; Firefox 153.0: 14/14; WebKit 26.5: 13/14. WebKit now passes integer frame/WAV/ZIP, arrangement, and source-WAV recording; its final MediaRecorder reference fails native decodeAudioData with 'Decoding failed'. Do not waive or label all platforms passed. The separate ephemeral-context Blob failure remains documented. Actual user-facing reference/fallback behavior needs triage; queued CORE-STEM-WEBKIT-REFERENCE-001 has exact reproduction and next action. Real Safari/iOS/Android, physical input, native install, long hardware and complete musical qualification remain unverified.

**Handoff:** Review git diff af10e31..c15bb06 (6 files), record independent approval/fixes, then normal branch push and PR against core-lab/stemdeck-lifecycle-20261007. Prepared pr-body.md explicitly says review pending and must be updated only after an actual review. Do not bypass mandatory hosted checks or manually retry during the billing outage. All owned QA servers stopped. Canonical product registry and core-lab state updated; whole-product completion remains unverified.
