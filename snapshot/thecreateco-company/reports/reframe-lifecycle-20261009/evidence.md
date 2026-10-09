# Reframe lifecycle task evidence

- Task: `PROGRAM18-REFRAME-LIFECYCLE-001`
- Worktree: `/Users/agentsattari/code/company-worktrees/scenepilot-reframe-lifecycle-20261009`
- Branch/baseline: `codex/reframe-lifecycle-20261009` at `fb42d12b98c895b47642eaab4a9be74de0c2c358`
- Local commit: `2f22257152e34eb52636db1ecf75659b2c4b6e19` (`Fix reframe analysis lifecycle races`); worktree clean after commit.
- Follow-up local commit: `08a64180df7ca80f64436437027d8fc10b5c65df` (`Complete reframe session lifecycle safeguards`); worktree clean after follow-up.
- Scope: local worktree only. The original dirty `code/wave2/scenepilot-autocut` tree and company queue were not modified. No push, PR, deploy, merge, or release action.
- Initial capsule checks used no download; a temporary symlink to `/Users/agentsattari/code/sattari-public-alpha-cleanup/node_modules` was removed after that incomplete dependency tree blocked build/type/lint. Follow-up restored project dependencies with `npm ci` (details below).

## Follow-up capsule (2026-10-09, same bounded task)

- Local dependency restore: first `npm ci --ignore-scripts` was accidentally started just before the parent began its restore; interrupted session ultimately exited 1 with ENOENT while npm was unpacking `node_modules/webpack/node_modules/estraverse`. The parent's subsequent sole `npm ci --ignore-scripts --no-audit --no-fund` exited 0 and added 763 packages in 17s. Logs: `npm-ci.log`, `npm-ci-retry.log`.
- The player has explicit cancellation for pending `loadedmetadata`/`error` waits: superseding loads pause the player, immediately detach the old listeners, reject the old promise, revoke the old URL; disposal does likewise. Fake-DOM tests exercise the actual `ReframePlayer`.
- The UI now creates/loads the player after the conditional preview canvases mount. The browser check confirmed a nonblank source preview on first file load, manual pin/letterbox persistence through face toggle and model-unavailable fallback, crop-path JSON dimensions, and a real 1:1 MP4 export. Browser evidence: `browser-check.mjs`, `browser-check.log`, `browser-result.json`, `crop-path.json`, `export-probe.json`, `export-decode.log`.
- Added editable format `scenepilot.reframe-session` v1 for source media, analysis targets/cuts, settings, pins, and letterbox segments. Parser rejects unsupported/extra fields and invalid ranges, and never accepts/stores arbitrary paths. Relinking checks a streaming SHA-256 content fingerprint, size, dimensions, and duration (within 0.25s), allowing renamed identical media. Roundtrip and SHA-256 tests pass. Browser save/close/new-page/relink/restoration assertions passed (`editable-session.json`, `restored-session.json`) before an export click was interrupted by DOM detachment/HMR; parent will rerun that final browser sequence on the committed stable source. `browser-roundtrip.log` retains that interrupted run.
- Render output/progress now invalidates on file/analysis/edit actions, revokes an old result URL, and clears the spinner immediately; export is disabled during analysis. Import rejects while analysis is active and guards the async parse/hash/apply against media/analysis/render changes.

### Follow-up checks (exact exit status)

- PASS: `node --experimental-strip-types --test tests/reframe-lifecycle.test.mjs tests/reframe-player-lifecycle.test.mjs tests/reframe-session.test.mjs tests/sha256-file.test.mjs tests/reframe-crop.test.mjs tests/reframe-path.test.mjs` — exit 0, 26 passed.
- PASS: `npx tsc --noEmit --pretty false` — exit 0.
- PASS: targeted `npx eslint` over changed Reframe modules and tests — exit 0.
- PASS: `npm run build:tools` — Vite 8.0.16 built 1,915 modules successfully (exit 0). Generated `site/tools` artifacts were restored/removed; no generated site output is included in the patch.
- PASS: `git diff --check` — exit 0.
- Exact follow-up check logs are saved as `tests.log`, `tsc.log`, `eslint.log`, `build-tools.log`, and `diff-check.log` in this report directory.
- Browser export after save/relink was interrupted by HMR and DOM detach; do not count that second run as passed. Earlier actual 1:1 export was independently probed as H.264 1080x1080, 5 seconds video, AAC audio 5.077333 seconds; full ffmpeg decode returned exit 0. This establishes output dimensions/decodability, not broad subject-tracking quality.

## Achieved

- Added monotonic request fencing so stale asynchronous analysis results, errors, progress callbacks, and `finally` state cannot overwrite a newer request.
- New media selection aborts in-flight decoding. Face-mode changes reanalyze the current file without reloading the preview or clearing manual override pins / letterbox segments.
- Preview media loads now track generations, revoke owned object URLs, and clean up event listeners.
- Crop-path JSON now records source dimensions reported by the completed analysis instead of hard-coded zeros.
- Added deterministic deferred-overlap tests. Existing manual override path, output-size, crop geometry, and camera path tests were run alongside them.

## Initial capsule checks — superseded by final follow-up

- PASS: `node --experimental-strip-types --test tests/reframe-lifecycle.test.mjs tests/reframe-crop.test.mjs tests/reframe-path.test.mjs` — 19 passed, 0 failed.
- PASS: `git diff --check`.
- BLOCKED by incomplete borrowed dependency tree: `npx tsc --noEmit --pretty false` — missing `@cloudflare/workers-types`.
- BLOCKED by incomplete borrowed dependency tree: `npm run build:tools` — missing `@tailwindcss/postcss`.
- BLOCKED by incomplete borrowed dependency tree: targeted ESLint — missing `eslint-config-next` (borrowed ESLint was 10.11.0 rather than repo-declared 9.39.4).
- Not run: browser E2E or real output/export. No supported browser binary/dependency set was available in this worktree; therefore actual preview/export dimensions and subject tracking output are unverified.

## Initial capsule limitations — resolved in final follow-up where noted

- Versioned editable session save/import/relink was not implemented within the bounded run. There is no session roundtrip or media relink claim.
- No browser interaction was run to verify manual pins survive an actual UI face toggle or a real face-model failure; source control flow preserves pins, and deterministic fence plus existing path tests pass.

No product-release authorization was implied or exercised.

## Final authoritative checkpoint

See [README.md](README.md) for stable exact-candidate results, completed session roundtrip, meaningful moving-subject fixture, draft PR, remaining gates, and preserved failures. Earlier capsule limitations above are historical, not current.
