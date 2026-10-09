# Pocket browser and data-preservation qualification

**Task:** `PROGRAM18-POCKET-QUALIFY-001` · **Candidate source:** `4bd196d65c7fd56f5de038179978e3eae47ab6b7` · **Recommendation:** **BLOCKED** (scoped local evidence passes; required product/source/release gates remain unproved).

This was a read-only qualification batch for the Pocket beat sketchpad, not Pocket Studio. The company and Core Product Lab PAUSE-marker search was clear. The source worktree was clean before and after; no source, lockfile, build, queue, or product registry state was changed. No install/download, spend, external message, push, merge, or deployment occurred.

## Observed results

- Re-ran the committed browser harness unchanged in a fresh persistent local Chromium profile against the existing `dist` artifact. **5/5 checks PASS**, zero page errors, 390px viewport has no horizontal overflow: named save/close/reopen/edit, live synthesis plus parsed non-silent WAV export, refusal of the 41st unique pattern without byte loss, syntax-corrupt library/draft preservation, and semantic-corruption backup recovery. Full output: [browser report](chromium-baseline/report.json), [WAV](chromium-baseline/qualification.wav), [raw backup](chromium-baseline/pocket-storage-backup.json), [viewport screenshot](chromium-baseline/phone-errors.png).
- Exercised actual localStorage quota exhaustion in a separate fresh disposable Chromium profile: 5,210,112 filler characters plus a 28,928-character tail filled storage until real `QuotaExceededError`s occurred. An attempted new save showed the error visibly; the current `New under pressure` name edit remained on-screen; original named-library and draft strings stayed byte-identical (SHA-256s in the machine report), with zero page errors. See [quota report](quota-pressure.json) and [probe](quota-pressure.mjs). This demonstrates real browser quota pressure, not physical disk pressure or termination during a write.
- Existing main report from October 7 already records the earlier review/build/unit evidence; this batch did not repeat those broad suites.

## Identity and provenance

Exact source and harness hashes are recorded in [qualification.json](qualification.json). The existing Pocket bundle is `dist/assets/PocketPage-Ch1W27DA.js`, SHA-256 `7bde1dba7dd33746b079d88b0e09c17ffe55172c6d51dbf031fa4c6c993b5f78`. The rendered entry was `dist/studio/pocket.html` served only on `127.0.0.1:4188` by this report's route-mapping server.

**Important limitation:** the existing `dist` has no source map or recorded dist/source hash attestation proving byte-for-byte correspondence to the exact source tree. The chunk contains the reviewed repair UI text and controls, but the new browser claims are therefore scoped to this local artifact, **not a freshly built exact-source candidate**. Dependencies were absent from the worker checkout; build/install was not repeated because downloading/installing was outside this batch. Existing source→build provenance must be established via the normal no-download/build environment before treating this as exact-head qualification.

## Browser/platform matrix and remaining gates

Chromium for Testing 153.0.8010.12 (cached Playwright 1.63.0) was exercised. Chrome stable and Safari applications were present; Safari/WebKit automation was not available in the inspected Playwright cache. Firefox was not present in the inspected apps/cache. No additional browser was downloaded. Thus Firefox/Safari/WebKit, physical/mobile, assistive-technology accessibility, real abrupt interruption/recovery, broader performance/stress, hosted-stack/live provenance, exact-source build identity, required PR checks, physical audio and release/deployment gates remain **UNVERIFIED**. This task does not qualify production readiness.

Commands, UTC timestamps, exits, setup/probe failures and successful reruns are machine-recorded in [qualification.json](qualification.json) and [attempts.json](attempts.json). Failures were harness setup/assertion-selector mistakes; both corresponding product behavior checks passed after fixing only the report-local harness/server. The final quota assertion for retained edits passed at `2026-10-09T13:16:08Z`. The exact worker checkout remained unchanged. See [artifact SHA-256 manifest](artifact-sha256.json).

## Next action

Establish exact source-to-build identity using the normal locally available dependency/build environment; then run the supported-browser matrix (including storage interruption/reopen), accessibility and bounded performance checks on that identified artifact. Keep physical/mobile and hosted/live gates explicitly unresolved until actually available. Parent director should retain the queue lease and update canonical company/product state; this report itself does not mutate queue or registry.
