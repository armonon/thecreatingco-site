# Independent product fix review

Decision: **APPROVE narrow fix**, subject to the parent cycle's remaining checks and final real UI rerun. No blocking correctness findings. This is not merge/deploy approval or completion of CORE-SP-RECOVERY-001.

Reviewer: separate OpenAI Codex context; runtime instructions identify GPT-6/Codex but do not expose an exact serving model ID. No Claude review.

Reviewed diff against `a47417bc4b3390bc30697cc2b7d3d573ad14e4d6` in the owned `scenepilot-recovery-20261008` checkout: `app/project-document.ts`, `app/page.tsx`, and new `tests/offline-media-document.test.mjs`. Also traced `buildMediaRelinkMap`, `retainOfflineMediaLinks`, import, linked-media hydration, and serialized project document output.

## Correctness

- Baseline metadata log independently confirms the moved-source/offline-save loses the video's `sourcePath` after two successful crash-recovery checks. This is a product metadata loss, not the earlier selector setup failure.
- `buildMediaRelinkMap` pushes the original unresolved source object without reconstructing it; therefore sourcePath/folderId/favorite/beatMap survive at runtime despite its narrower descriptor type. The new placeholder implementation correctly retains those fields while keeping `url` empty, offline true, failed proxy state, and original size/time identity. It does not falsely mark absent media as playable.
- Default folder behavior remains unchanged when legacy descriptors lack a folder. Nullish fallback preserves explicitly false favorite and supplied beat-map objects. Deduplication by existing IDs is unchanged.
- Relink revivals correctly preserve authored offline beatMap while adopting incoming actual file, URL, path and probe metadata; the retained offline ID keeps timeline/composition references stable. Existing color/folder/favorite handling is unchanged. The nullish beatMap fallback is appropriate when no previous analysis exists.
- The roundtrip regression exercises actual relink-map unresolved descriptors → offline placeholders → projectDocument → parseCutFile and verifies full media descriptor equality plus clip reference and successful later matching. It would fail against baseline. Legacy defaults/dedup test covers compatibility.

## Verification and scope

Independently ran `node --experimental-strip-types --test tests/offline-media-document.test.mjs` using local Node v26.9.0: **2 passed, 0 failed**. Parent is checking intended Node 22/full suite, type/lint checks and desktop renderer build; these are not claimed complete here.

No review-requested code changes. The relink beatMap line is sound by inspection, but the two unit tests directly cover offline serialization rather than the React relink path. Prefer including a nonempty beatMap in the real missing-media/relink audit fixture to substantiate that specific behavior; this is a nonblocking evidence improvement.

The fix targets ordinary asset metadata. Missing mainAsset persistence has separate preexisting placeholder semantics and is not newly solved or certified by this patch. Do not broaden the release claim to every missing-main-media scenario without evidence. No product files or other worker checkouts were edited by this reviewer.

## Final evidence addendum — exact candidate c7d2b4f

Final reviewed candidate: `c7d2b4fc973861eba785f26e5f607671ac22deb4`. HEAD matches; current tracked status and the recorded UI-run `trackedDirty` are empty. Requested reviewer route is **gpt-6.1-sol**, as supplied by the parent orchestration; exact serving identifier is not independently exposed to this child. This clarifies the earlier generic runtime identity statement without asserting unavailable serving telemetry.

Re-read final harness, `result.json`, source/build receipt and retained check/build/full-test logs. Verified all **6 source hashes and 126 renderer hashes** in the receipt against current files, with zero mismatches. Actual launched URL is the expected owned `file://…/electron/renderer/desktop/index.html`. No tests repeated for this addendum.

Final UI evidence: **6 PASS checks, no recorded renderer page errors**, completed 2026-10-08T06:19:08.353Z. The corrected save helper waits for a new serialized disk `savedAt`; full document comparisons normalize only savedAt and asset order, plus the explicitly expected moved path/File timestamp truncation. Journal is compared against the fixture with only the known added-track delta before crash, eliminating the circular recovery comparison. The moved asset itself has `favorite=true` and a nonempty valid beatMap in the pre-crash artifact, so the live offline-save/relink comparison now directly covers both retained metadata fields.

`full-test-build.log` ends **1095 tests passed, 0 failed**. Receipt retains the earlier quick-test missing-build failure separately rather than presenting it as a clean first attempt. Type/lint log contains the requested checks and no reported failure; desktop renderer log ends successful build with chunk/dynamic-import warnings retained. Exact atomic-helper ENOSPC evidence remains separately scoped.

Approval remains for this narrow tested candidate. No misleading broad qualification claim is needed: **NEEDS_REVIEW resumable checkpoint** is appropriate, not COMPLETE. Keep signed/packaged build, actual OS chooser, full golden/platform qualification, missing mainAsset scenarios, UI/autosave ENOSPC and power-loss durability explicitly outside this evidence. The permission-denial UI check proves failure messaging plus byte-identical prior document and successful retry; the harness labels it EACCES but does not assert the specific error code, so prefer “permission-denied save” in any headline summary. No merge/deploy authorization or completion is implied.
