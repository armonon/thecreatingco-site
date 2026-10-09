# Split recoverable-session capsule — 2026-10-09

**Checkpoint: BLOCKED for qualification; implementation is local and pending independent review.** This checkpoint does not finish or mutate the active company queue/lease. No commit, merge, deploy, release, hosted inference, or outbound message was made.

## Scope and source identity

- Task: `PROGRAM18-SPLIT-SESSION-001`, owner remains `company-director-20261009T1010`.
- Product checkout was left untouched at `/Users/agentsattari/code/wave2/sattari-all`; its only pre-existing dirty item was unrelated untracked `verify-packs.mjs`.
- Isolated worktree: `/Users/agentsattari/code/wave2/worktrees/split-session-20261009`, branch `codex/split-session-20261009`.
- Base source SHA: `a9a77e6ad21245a99c83b592ed2fb8a660e71a37` (the Split source SHA cited by the required inventory evidence).
- Candidate remains uncommitted. Tracked diff SHA-256: `e31e370082058b002ece02b8531a531335fde6840c0eb8d1de157071a75656c5` (new untracked files are covered separately below).
- Changed product files: `src/hooks/useStemSeparator.js`, `src/hooks/useStemSeparator.test.jsx`, `src/labs/split/SplitPage.jsx`, `src/utils/splitSessionStore.js`, and `src/utils/splitSessionStore.test.js`.
- Exact candidate file SHA-256 values are in [source-hashes.sha256](source-hashes.sha256); git state/diff check are in [git-state.log](git-state.log).

## Change made

The source previously held input `File`s and output blobs only in hook memory. The unload prompt warned users but could not recover those bytes. The candidate adds same-origin IndexedDB records for the source file, output WAV blobs, filenames, waveform peaks, analysis and retry state. Route return restores saved jobs and regenerates object URLs; a job interrupted in `processing` becomes `cancelled` with a retry message. Queue replacement deletes known valid saved jobs, including when replacement happens before async restoration completes. Persisted records are serialized per module so an earlier queued write cannot follow a later same-tab delete. Corrupt/over-limit records are not deleted; valid records can still load and the UI warns that records were skipped. Storage open/write/delete failures are surfaced while the in-memory session remains available.

Storage is local to this browser origin; this change adds no upload or hosted inference. The UI documents that browser quota/eviction may prevent recovery, users should download important WAVs, clearing site data removes stored sessions, and only one Split tab should be used at a time. Concurrent-tab update/delete conflicts are **not** coordinated or qualified. Current behavior has no per-session manager; replacing a song clears known valid sessions.

Existing decode timeout, worker-start timeout, cancellation and late-result protections were not duplicated or modified.

## Verification and collection

Final captured checks (all exit `0`; exact timestamps and logs are beside this report):

- Focused mocked hook/store suite: 18 tests passed across 2 files. It covers hook restore/retry state, restore-vs-user interaction, replacement before restore, persistence calls, record validation, and an in-memory fake IndexedDB API round-trip plus same-tab save-before-delete ordering. The fake does **not** prove native browser IndexedDB structured-clone, transaction-abort, quota, close/reopen, or cross-tab behavior.
- `npm run type-check`: passed.
- Targeted ESLint on all five changed files: passed.
- `git diff --check`: passed.
- `npm run build`: passed; Vite transformed 3,369 modules, prerender emitted 89 canonical URLs, and Studio SW reported 132 files / 6.3 MB precached. The existing prerender script made a read-only GET to `https://sattarimusic.com/api/inventory`; no catalog write occurred.
- The worktree temporarily reused an existing compatible `node_modules` tree via symlink for checks; the symlink was removed afterward. No package install or repository dependency change was made.

Logs: [tests.log](tests.log), [typecheck.log](typecheck.log), [lint.log](lint.log), [diff-check.log](diff-check.log), [build.log](build.log), with corresponding `*.started`, `*.finished`, and `*.exit` records where applicable.

## Coverage boundary / blockers

- No browser was available in the worktree for a native IndexedDB UI reload test. Native browser storage serialization, quota denial/transaction abort, and route close/reopen remain unverified.
- No real model inference was started. The pinned remote model is approximately 172 MB (with runtime delivery beyond that); no browser/device inference environment was available for this capsule. This avoided an unneeded model transfer and did not create hosting cost.
- Therefore there is no real-input decode/separation/listening evidence, no independently parsed finite/nonblank four-WAV result, no StemDeck handoff verification, no retry/quota real-browser run, and no rights-cleared multi-mixture benchmark. The synthetic mocked WAV blobs in hook tests are not real audio evidence.
- Phone/tablet, mobile memory, quality/bleed, cold/warm transfer, real timing/RTF and hardware coverage remain unverified. No source/deploy equivalence was asserted; this is a local source candidate only.
- Existing evidence reports the live deployment/source drift; this capsule did not inspect or modify deployment.

## Next action

Independent Sol review of this exact worktree diff, then a browser-native IndexedDB lifecycle qualification (save→route away/back or reload→listen/download, deletion/replacement, malformed record, denied/quota/abort, and multi-tab conflict) followed by rights-cleared real audio inference and four exported WAV structural checks. Keep release/deploy gates separate. **Recommended queue checkpoint: BLOCKED** until those concrete gates are covered; code remains local pending review.

## Director final checkpoint — 2026-10-09T10:20:21.796569+00:00

Sol director / Luna executor / independent Sol reviewer (OpenAI only). Exact-final-source independent rerun **18 tests PASS**; scoped review PASS WITH LIMITATIONS. See review.md and reviewer-final-tests.log. Parent verified five source hashes and clean worktree; identical candidate saved as local commit `e3f01236571f0cf7a3bc013537aefcc08cba24bd` on `codex/split-session-20261009`. Earlier uncommitted/pending-review statements describe worker handoff, superseded here. No push, merge, deploy or release at this checkpoint. Queue finished **BLOCKED** with owner/token; native browser storage/reload/quota and real inference/WAV/handoff/listening/device benchmarks remain unqualified. Cross-tab conflicts and exceptional URL allocation cleanup remain documented. Initial director evidence-summary assertion required literal 18/18 but review said 18 tests passed; corrected text check and completed this checkpoint without changing source or test results.

## Later push reconciliation — 2026-10-09T22:25:46Z

After Armon's cross-thread push instruction, the unchanged clean candidate
`e3f01236571f0cf7a3bc013537aefcc08cba24bd` was pushed to
`origin/codex/split-session-20261009` with the shared handoff helper. The remote
SHA was read back and a receipt saved in `git-handoff/receipts.jsonl`. The
original no-push checkpoint above remains historically accurate. No new native
browser/inference qualification, PR, merge, deploy or release is claimed.
