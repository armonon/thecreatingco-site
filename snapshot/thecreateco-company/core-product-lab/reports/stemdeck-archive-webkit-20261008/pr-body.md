## Scoped reliability repair

Stacked on #33 (`af10e31`). Includes independently reviewed prerequisite `c15bb06` and portable-audio repair `6bad0ed`. No merge/deployment requested while mandatory checks remain unresolved.

- Detach v6 archive-backed slices into independent temporary files with checked 1 MiB reads before the existing atomic asset batch write.
- Bound aggregate memory fallback to 32 MiB; larger imports fail closed if temporary disk is unavailable.
- Verify staged and persisted hashes before replacing the session; rollback only newly created asset IDs on failed verification, preserving reused assets.
- Reject invalid hash/deduplication read lengths and clean all owned temporary files without masking the original result.

## Actual local evidence

- Node22: 2,259 tests / 248 files pass; lint, typecheck and complete Vite/prerender/service-worker build pass.
- Actual Playwright WebKit26.5 UI: synthetic four-deck capture/arrange/edit/undo/redo/replay, process reopen, 39-asset fresh-profile portable restore and master PCM parity pass (668,352 frames,48kHz stereo, maximum error0).
- Restored portable profile independently restarted after commit: all39 hashes/original semantic state match; downloaded WAV byte-identical.
- Chromium candidate: all39 asset hashes and full-process restart pass.
- Six WebKit importer failure injections: storage denied/quota, immediate/late transaction abort, post-storage wrong bytes and reused-asset preservation pass. These are pre-session-replacement storage tests, not late applySession rollback tests.
- Separate OpenAI GPT-6.1 Sol source and prerequisite audits approve scoped progression; no Claude review/fallback.

## Gates and remaining limits

Exact clean `6bad0ed` mandatory local gate exited1 at disk preflight:1,203,224,576 bytes available versus2,838,683,648 required. No software/audio/built-artifact checks ran in that gate; no assertions changed. Standalone successful checks above do not satisfy mandatory release qualification.

Prior native WebKit MediaRecorder reference decode failure (13/14 native suite) remains unwaived. Physical input/output, real Safari/iOS/Android, long-duration operation, packaged/source-live qualification and hosted/stack checks remain unresolved. Initial real UI trial timed out while source was changing; its logs are retained, final stable-source trial passed.

Dated immutable receipts/reports retained locally at `thecreateco-company/core-product-lab/reports/stemdeck-archive-webkit-20261008/`; seven reviewed file hashes bind the precommit UI/test snapshot to this exact commit. No release-complete claim.
