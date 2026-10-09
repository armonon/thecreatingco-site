# PROGRAM18-CAPTIONS-LIFECYCLE-001 — worker checkpoint

- Worker/model: Luna executor capsule (actual runtime model identifier was not exposed by this shell/tool session; requested model tier was Luna).
- Scope: delayed-media-decode overwrite race and malformed replacement preserving prior valid authored state. No queue mutation, release, push, or merge.
- Source: ScenePilot repository, isolated worktree `/Users/agentsattari/code/company-worktrees/scenepilot-captions-lifecycle-20261009` on `codex/captions-lifecycle-20261009`.
- Starting committed candidate: `a47417bc4b3390bc30697cc2b7d3d573ad14e4d6` (`fix: avoid phantom audio clips when inserting silent video`). Primary checkout was dirty and untouched; sibling release18 worktree also had an unrelated untracked file and was untouched.
- Result commit: `f65577b43c470f76f71f17fda7b0daf6f164f46c` (`fix: keep captions document on failed media replacement`). Worktree clean after commit.

## Implementation

`tools/src/captions/main.tsx` now decodes a candidate before publishing it to app state. A monotonically increasing latest-request gate only allows the latest decode to commit; stale object URLs are revoked. Decode or duration failures revoke the candidate URL and report the error while retaining the prior clip, PCM, captions, style/settings, playhead, and media URL. Successful candidates replace state together after validation. `lib/latest-request.ts` contains the small gate; regression tests cover delayed A/B completion and malformed replacement preservation.

## Evidence (actual commands and exits)

- `git diff --check` — exit 0.
- `node --experimental-strip-types --test tests/latest-request.test.mjs` — exit 0; 2 passed, 0 failed. These are deterministic gate/state behavior regressions; no browser-level media decode was exercised.
- `npx tsc --noEmit` — exit 1 because this isolated worktree has no installed TypeScript compiler (`npx` returned its “This is not the tsc command you are looking for” message). No dependency installation was attempted under the capsule constraint.
- `git status --short` after commit — clean.

## Deliberate limits / remaining criteria

- No interactive browser repro or real malformed codec fixture was available/run, so native browser MediaDecoder behavior and event races remain unverified beyond deterministic regression coverage and source inspection.
- Portable authored-project save/reopen containing embedded media, repeated-word timings, caption edits, and style/settings was not implemented in this bounded cycle. Existing ScenePilot cut handoff remains the prior behavior and is not evidence of full portable round-trip.
- SRT/VTT, MediaRecorder WebM index/scrub behavior, and codec compatibility qualification were not changed or newly qualified.
- Parent Sol review remains required. No push, merge, or deploy was performed.

## Sol review repair checkpoint (2026-10-09)

- Follow-up commit: `02c6eced0e572eafe5c5c2f8e4fe1b0e8b011b40` on the same isolated branch; clean worktree after commit.
- Moved the actual async media-candidate transaction and transcription callback fence into production helpers in `lib/latest-request.ts`, called by the Captions UI. The helper accepts injected decode/URL/state operations, so deterministic tests exercise the same transaction used by `loadFile`, not a duplicated toy implementation.
- On media replacement, the active transcription controller is aborted and cleared synchronously. Progress/result/error/finally callbacks are identity-fenced; stale aborted work cannot publish errors/status or clear the newer decode busy state. Explicit user cancellation for the still-current transcription continues to report cancellation and clear its own busy state. Async subtitle text reads also use a generation fence.
- Regression command `node --experimental-strip-types --test tests/latest-request.test.mjs` — exit 0, 5 passed: newest A/B decode wins and stale URL cleanup; malformed decode preserves authored document and cleans candidate URL; aborted transcription rejection cannot overwrite replacement decode state; current user cancel still clears itself; static wiring assertion confirms Captions routes through tested helpers and subtitle fencing.
- `git diff --check` — exit 0 before commit. No TypeScript compiler/build/browser was run; no dependencies installed. Tests still do not prove browser codec/decode behavior. Portable authored media project save/reopen remains follow-up; overall task checkpoint is partial / NEEDS_REVIEW, not full completion.
