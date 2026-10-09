## Summary

- Fix measured main-thread stalls during real four-deck performance replay. The upstream audio wrapper enumerated all paths through the acyclic, reconvergent master graph on every grain connect/disconnect.
- Add a linear root-reachability precheck. Preserve the original cycle enumerator and all cycle bookkeeping for reachable roots, including feedback/AudioParam paths and delay handling.
- Apply reproducibly to reviewed standardized-audio-context 25.3.77 ESM and bundled entry points during npm ci, with exact source hashes and idempotence. Unknown versions/source fail closed.
- Strengthen actual UI qualification: play four decks across source windows for 12 seconds and fail the performance subset on an unexplained early deck stop. Preserve independent archive results.

## Validation

Local exact candidate c15bb06a87b150a966e8c563457de4f2786ba141, Node 22.23.2:

- Fresh npm ci successfully applies both dependency entry-point patches.
- Complete mandatory release gate PASS: 2,250 tests, lint/types/build/SEO, native/browser audio suites, unchanged 120-second soak (124.1 seconds wall).
- Eight cycle regressions include 1,024 exhaustive graph/delay cases, exact feedback paths/order, AudioParams, graph mutation and both entry points. A 14-stage acyclic diamond takes 43 graph reads rather than more than 60,000.
- Actual generated-media UI load/analyze/continuous four-deck perform/capture/print/arrange/undo/redo/save/full browser restart/export/fresh portable restore PASS. All 39 asset hashes preserved; 644,800-frame 48 kHz stereo exports are sample-identical across reopen paths. No late controls reported.
- Original lossless capture versus actual replay print middle interval has zero-sample alignment and maximum sample error 9.32e-9. Not a claim of full musical/physical qualification.

## Release boundaries

No deadline threshold, audio graph, DSP, rendered samples, source media or mandatory gate was relaxed. This stacks on the capture-timing/exact-frame candidate (PR #33), which itself stacks on recovery/security work. Do not bypass unresolved mandatory hosted checks or source/live provenance. No hosted retry during the CI outage, no merge or deployment.

Exact production-bundle real UI replay also passed. Persistent platform suites: Chromium 14/14, Firefox 14/14, WebKit 13/14; WebKit MediaRecorder native reference decoding remains a failed check. Receipts are recorded in the company work log. Real Safari/iOS/Android devices, physical inputs, long hardware sessions and the full musical acceptance project remain unqualified. WebKit ephemeral-profile Blob storage has a separately reproduced browser limitation; do not silently describe private storage as verified.

Independent OpenAI review: PENDING. This body is release preparation only and must not be published as an approved repair until review is recorded.
