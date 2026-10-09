# Independent OpenAI source review — 2026-10-08 UTC

**Verdict: APPROVE scoped source fix; no blocking finding remains.** This is not a release/deployment approval or a waiver of repository/stack gates.

Reviewer: independent native Codex child `/root/archive_review`. Actual model: OpenAI GPT-6.1 Sol (inherited parent model; parent live session_status confirms openai/gpt-6.1-sol, Runtime OpenAI Codex); no fallback or Claude review. Reviewed worktree `stemdeck-archive-webkit`, baseline HEAD `c15bb06a87b150a966e8c563457de4f2786ba141` with dirty candidate files. Exact tracked diff hash and all seven modified/new file hashes are recorded in `independent-source-review-manifest.json`; new files are included in that manifest separately from the tracked diff.

## Source audit

- v6 imports stage independent file-backed assets using checked 1 MiB reads. Aggregate 32 MiB fallback is evaluated across the entire import; sink opt-out rejects both absent and refused OPFS. Generic export fallback behavior remains unchanged by default.
- Staged hashes are checked before atomic batch storage; durable reloaded assets are hashed before return to the session hook. Exact byte-length checks also prevent short-read hashing and false dedupe.
- Verification failure deletes only freshly generated imported IDs. Reused records are not in that ownership set. Existing IDB commit/abort handling is preserved.
- I identified cleanup double-delete/error-masking and stop-at-first-failure issues in the initial candidate. Revised candidate moves ownership registration after staging hash verification and attempts every owned cleanup without masking the primary result. Added regression tests exercise both failure preservation and cleanup-only failure after a successful verified import.
- Hook invokes this wrapper only for v6 and does not release/replace current session until import verification succeeds.

## Evidence independently inspected (not independently re-executed)

- `webkit-baseline.json`: baseline failure is retained. `webkit-candidate.json`: candidate passes, with 39 assets surviving full browser-process restart; full byte/hash probe records are retained.
- `candidate-ui-final/report.json` and `candidate-ui-final.log`: WebKit 26.5 actual synthetic four-deck capture/replay, edit/undo/redo, full process reopen, fresh-profile portable 39-asset hash/semantic roundtrip pass. Master/portable PCM comparisons: 48 kHz stereo, 668352 frames, maximum error 0. No physical inputs; inventory endpoint mocked.
- `faults.mjs` and final `faults.json`: six storage-layer cases pass: OPFS denial, quota, immediate transaction abort, late abort, post-storage wrong bytes, reused-record preservation. Prior failure logs/reports remain for harness and cleanup diagnosis. Final cases retain prior asset, localStorage sentinel, and no newly owned temporary files.
- `unit-full.log`: 2259 tests / 248 files pass. Scoped tests and lint/type/build logs inspected; Vite build succeeds. Independently ran `git diff --check`: exit 0.

## Limits and remaining gates

- Fault harness invokes importer directly and verifies a localStorage sentinel. It is evidence for storage-layer/pre-session-replacement fail-closed behavior, not actual UI/engine rollback when `applySession` itself fails. Existing hook releases prior session before `applySession`; that late-stage limitation remains outside this fix.
- Final reused-record fault evidence independently hashes the reused asset before and after the rejected restore; `reusedHashBefore` equals `reusedHashAfter` (audio-tree-v1, 2822444 bytes). All six final fault cases pass. Source audit confirms deletion excludes reused IDs.
- Cleanup failures other than NotFound are logged and do not turn verified import into false failure; disk refusal may leave recoverable temporary files. Successful tested cases show no owned leftovers, not a guarantee against future disk cleanup refusal.
- Candidate evidence is dirty-tree QA anchored to baseline SHA. Clean exact-source release gate, independent downstack review, required CI/PR/stack gates remain mandatory. Disk preflight must not be relaxed. No physical recording, deployment, merge, production mutation, or gate waiver was performed by this reviewer.
