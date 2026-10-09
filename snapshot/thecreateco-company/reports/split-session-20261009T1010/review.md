# PROGRAM18-SPLIT-SESSION-001 independent OpenAI/Sol review

## Disposition

**Scoped source review: PASS WITH LIMITATIONS. Browser/inference/platform qualification: BLOCKED.** No release, upload, cloud sync, queue mutation, or source edits performed by reviewer. Review was bounded to the five requested changed Split source/test files plus applicable ancestor AGENTS.md. Baseline and current HEAD: `a9a77e6ad21245a99c83b592ed2fb8a660e71a37`; changes remain uncommitted. Branch: `codex/split-session-20261009`.

Final tracked binary-diff SHA-256 independently reproduced: `e31e370082058b002ece02b8531a531335fde6840c0eb8d1de157071a75656c5`. This diff hash excludes untracked new utility files; the complete reviewed source identity is therefore the following five independently captured hashes:

| File | SHA-256 |
| --- | --- |
| src/hooks/useStemSeparator.js | 6a5e5de54c560b1b44f9c28e5ffae132c994d051c4afcc5802dc97460aa276da |
| src/hooks/useStemSeparator.test.jsx | c5fae798753bb55e7dd82f4720b0779b44433cb92c36f44e9c6eb6eb268bdb1a |
| src/labs/split/SplitPage.jsx | c5441a98615eb40ee89dbea1e1194f554d74c722d1ae36790708b901b86d5b02 |
| src/utils/splitSessionStore.js | f00dd6238987dc8e38d800bd049e9110688b266de5d1cc1e30f92c4346358326 |
| src/utils/splitSessionStore.test.js | 2e5ccce3cd27e82a8a65dfcae4fca544ed67f6cbdc404f33075c3718dd49f5d0 |

## Findings and resolution

- **P2, fixed during review:** delayed hydration could restore old jobs after add-then-remove. Final interaction latch prevents that; regression test covers it.
- **P2, fixed during review:** replacing a song before restore resolved skipped old sessions without deleting their saved records. Final explicit `clearAll()` replacement latch deletes valid late-restored records and releases their URLs; regression test covers that path. Invalid/over-capacity records intentionally remain untouched and are disclosed by warnings.
- **P2, fixed during review:** malformed stored message/analysis metadata could reach React as object children and crash recovery UI. Independent Node reproduction showed an object message accepted by the intermediate source. Final source validates rendered scalar metadata, duration/progress, source/output names, statuses, stem IDs and bounded peaks before hydration.
- **P2 limitation, disclosed:** serialization is per JavaScript module/tab, not cross-tab. A second tab can re-save a job after another tab deletes it. Final UI explicitly requires one Split tab at a time. For multi-tab support, add a cross-tab ownership/version/tombstone protocol before promising deletion semantics across tabs.
- **P3 follow-up:** if `URL.createObjectURL` throws partway through hydration, earlier URLs created in the same map are not tracked for cleanup because hydration never returns a session. Add incremental URL cleanup around hydration construction, with an injected failure on the second output. Normal restore/remove/clear/unmount and discarded restore paths are covered by source inspection or tests; this exceptional allocation-failure path is not.

## Independent evidence

Reviewer ran `npx vitest run src/hooks/useStemSeparator.test.jsx src/utils/splitSessionStore.test.js` after ordering/metadata/replacement hardening: **2 files passed, 18 tests passed**, duration 591 ms. Earlier intermediate run caught a fixture invalidated by stronger output-name validation; worker corrected it. Final source includes a subsequently added hand-written in-memory IndexedDB-interface test for save/delete ordering and load hydration; reviewer inspected it, but it retains object references and does not exercise browser structured cloning, transaction rollback, quota, or native persistence.

Initial final exact-source rerun was attempted and **could not start** because temporary dependency linkage had been removed: `ERR_MODULE_NOT_FOUND` for vitest and unresolved @vitejs/plugin-react. This is an environment startup failure, not a failing assertion. Do not attribute worker final test/build results to independent execution. A single parent-authorized deterministic retry restored the same compatible dependency symlink, independently ran the exact final source, and removed the link afterward: **2 files passed, 18 tests passed**, duration 622 ms. Log: `reviewer-final-tests.log`. The initial startup failure is retained above. Exact final five-file hashes and tracked diff hash above were independently captured after source stabilization.

Source inspection supports: source/output Blobs are persisted without object URLs; write/delete mutations are serialized within one tab; terminal statuses save immediately; progress snapshots are debounced; failed storage writes warn without replacing live results; processing restores as cancelled/retryable; healthy recoverable sessions survive malformed neighbors; skipped/removed sessions release output URLs. No new network upload path was introduced in reviewed files.

## Outstanding qualification gates

Actual native-browser IndexedDB File/Blob structured-clone roundtrip across reload/remount, interrupted-job retry with real audio, private/blocked storage, quota/abort recovery, browser eviction, WebGPU/CPU inference and real platform performance remain **UNQUALIFIED/BLOCKED**. Add transaction failure and queue-recovery tests, mixed valid/invalid records, aggregate limits, save/delete failure warning assertions, stale restore URL assertions, and native-browser reload evidence before changing these gates. Scoped unit/source review is not a release approval.
