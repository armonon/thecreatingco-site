# AutoCut editable-session roundtrip — 2026-10-09

Task `PROGRAM18-AUTOCUT-ROUNDTRIP-001`. Local implementation and qualification evidence only; this report does not mark a release or production deployment.

## Exact source

- Isolated worktree: `/Users/agentsattari/worktrees/autocut-roundtrip-20261009`
- Branch: `codex/autocut-roundtrip-20261009`
- Base: `fb42d12b98c895b47642eaab4a9be74de0c2c358`
- Candidate commit: `8d740071cb9631cfa18d4d6c7faa4a806b8fa42a`
- Commit contains only `tools/src/autocut/main.tsx`, `lib/autocut-session.ts`, `lib/sha256-file.ts`, and `tests/autocut-session.test.mjs`.
- The shared source checkout at `/Users/agentsattari/code/wave2/scenepilot-autocut` had extensive pre-existing dirty changes and was not modified. The isolated worktree was clean at the base before work. Build-generated `site/tools` files are deliberately not committed.

## Implementation

- Adds a version-1 `.json` editable session containing music analysis, timeline settings, selected song identity, clip profiles/metadata, inclusion/role/manual offset/alignment, and locked shot data (including manual assign/slip state).
- Reopen is exposed from the always-visible AutoCut heading, including a fresh tab with no media loaded. Import is staged: parse and validate the session, choose source media, require full-file SHA-256 and byte-size matches for every saved media item, decode the saved song, then replace project state. Missing/changed media, malformed sessions, or song decode failure leave the current project and locks untouched.
- Hashing uses a bounded 4 MiB-read full-file SHA-256 helper. This is independent of the older `fingerprintFile` helper, whose sampled edge digest is not used for session relinking.
- Restored analysis avoids a second song-analysis reset; all edit/export settings and locks are restored together. Relinking clears obsolete render output/URLs, rebuilds thumbnails, fences active export progress/results, and blocks ordinary media ingest during replacement.
- The existing unsupported-WebCodecs behavior is unchanged and honest; this work does not add a video fallback.

## Verification

Local checks all exited 0; command output and exit records are in [verification.log](verification.log):

- `npm run build:tools`
- `npx tsc --noEmit`
- `npx eslint tools/src/autocut/main.tsx lib/autocut-session.ts lib/sha256-file.ts tests/autocut-session.test.mjs`
- `node --experimental-strip-types --test tests/autocut-session.test.mjs tests/autocut-cut.test.mjs tests/autocut-export.test.mjs tests/autocut-clips-align.test.mjs tests/autocut-music.test.mjs` — 51/51 pass, including strict schema rejection, wrong/missing media atomic rejection, preserved locks/manual offset, and full-file SHA middle-byte and chunk-boundary cases.
- `git diff --check`

Parent-run Chromium evidence is in [`parent-check/browser-result.json`](parent-check/browser-result.json) and [`parent-check/browser.mjs`](parent-check/browser.mjs): the locally owned synthetic A/V roundtrip restored settings, music, and a lock; changed media was rejected without mutating the existing project; identical bytes with a renamed filename relinked; CSV, ScenePilot cut JSON, and video export downloaded; zero page errors. The initial harness attempt logged a selector-order timeout because “Find faces” appears after media load; the corrected run passed. The synthetic fixture provenance and source-file SHA-256 values are in [`parent-check/fixture-provenance.json`](parent-check/fixture-provenance.json).

Independent SHA oracle output (10 byte lengths spanning SHA-256 padding and 4 MiB boundaries) is [`parent-check/hash-oracle.log`](parent-check/hash-oracle.log). The downloaded synthetic export was independently parsed with `ffprobe`; see [media-parse.log](media-parse.log): valid MP4, H.264 1920×1080 video (8.0 s), AAC mono/48 kHz audio (8.064 s), 6,350,256 bytes.

## Limits / not qualified

- This proves a synthetic local Chromium workflow, not real phone footage, real-world quality, or a public/production deployment. The live additive production overlay and source tree remain unqualified/mismatched; no overlay was changed.
- Unsupported WebCodecs/audio encoder, cancellation under stress, very large multi-file sessions, malformed-media UX in other browsers, browser/OS compatibility, and long-duration performance were not end-to-end qualified here. Hash unit cases do not substitute for large-media performance qualification.
- No merge, release, deployment, paid service, or user media was used. Scoped tested source was pushed by parent; draft PR97 preserves normal exact-head and stack gates.

## Independent Sol checkpoint — output acceptance BLOCKED

Actual scheduled director model: `openai/gpt-6.1-sol`; bounded native worker model: `gpt-6-luna` (OpenAI). No Astra invoked. Purpose: one P1 company queue task, exact leased ID. Commissioning task already COMPLETE and not rerun. No PAUSE or running product owner at selection; lease recovery returned none. Cost preflight decision continue, normal advisory mode; budget limits/billed/per-call worker usage unknown, not treated as spending approval. Existing authorized local execution/branch/PR scope only.

Independent source review of four-file exact candidate: PASS WITH LIMITATIONS for session implementation. Final `browser.mjs` against built 8d74007 exited0: one lock and 2x tempo survived restart, wrong-middle-byte song rejected with current settings/locks unchanged, renamed identical media relinked, CSV/project/video downloaded, zero pageerrors. Ten Node crypto hash oracle lengths pass. Full ffmpeg exported H264/AAC decode exit0. Four output-frame samples versus independently sought source intervals have MAE13.12–15.54/255 after320x180 scaling, within predefined coarse16/255 threshold; not a perceptual/full-platform certification.

**Audio alignment FAIL:** independent exported PCM has an observed2112sample/44ms lead-in relative to original48kHz song; unshifted normalized RMS error0.2523096 vs0.03 threshold. After2112sample alignment, RMS0.0003277, confirming source identity but NOT correct timing. Exported audio duration8.064s vs video8.0s. See `parent-check/audio-initial-failed.json` and `parent-check/independent-output.json`. Suspected encoder priming/container handling is a hypothesis; baseline reproduction/root cause remains unverified. Retain failed evidence; no assertion weakened or product declared complete. Missing unsupported-encoder/cancel/large/real/platform tests and mandatory hosted/stack/live parity remain unqualified.

Pushed candidate8d740071cb9631cfa18d4d6c7faa4a806b8fa42a; draft https://github.com/armonon/scenepilot-studio-badass/pull/97 targets unchanged wave4/scenepilot-suite baselinefb42d12, not main. Remote head verified by `git ls-remote` and PR headRefOid; checks captured in `remote-receipt.json`, never presumed passing. Shared dirty checkout untouched; isolated final source worktree clean; generated site artifacts excluded. No hosted retry, merge/deploy or external report/send.

Queue result BLOCKED, not COMPLETE: next isolate AAC2112sample alignment at this exact source and original fixture, determine container priming/timestamp behavior, add regression and repair in bounded follow-up; then independently qualify remaining cancel/large/encoder/platform and exact-head integration gates. Reuse unchanged session proof. Source fixes remain reviewable via draft PR97.
