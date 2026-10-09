# Reframe lifecycle checkpoint — 2026-10-09T09:27:40.748790+00:00

Task PROGRAM18-REFRAME-LIFECYCLE-001 (P1); claimed exact ID with company-director lease. Commissioning OS-SCHEDULER-PROOF-20261009 was already COMPLETE. No PAUSE; recovered leases: none; no competing running product owner. Cost preflight advisory continue/normal, limits unknown/unset: no spending approval inferred. No paid service or Astra request. Director actual runtime openai/gpt-6.1-sol; bounded isolated native worker requested openai/gpt-6-luna (initial capsule plus one same-task follow-up). Per-worker actual token/cost receipt unavailable, not reported as zero.

## Reviewable result

Candidate 08a64180df7ca80f64436437027d8fc10b5c65df, branch codex/reframe-lifecycle-20261009, baseline fb42d12. Local commits 2f22257 and 08a6418; final worktree clean. Exact pushed head verified by git ls-remote and PR headRefOid. Draft PR: https://github.com/armonon/scenepilot-studio-badass/pull/96 targeting unchanged wave4/scenepilot-suite, not main (main comparison includes an unqualified 2399-file parent stack). No merge, deployment or external report/send. Routine branch/PR authority applied; parent stack and required release gates preserved.

Luna implemented latest-only analysis/error/progress/finally commits, abort handling, actual player pending-load cancellation/listener/URL cleanup, conditional-canvas first-load initialization, pin/letterbox-preserving face reanalysis, stale-render invalidation, source dimensions, editable version1 session save/import, streaming SHA256 byte-identity relink permitting rename, strict input validation, and scoped docs. Sol independently inspected source/diff, identified preview/session identity/render gaps, and verified the repaired result via actual built-browser workflows and independent decoding.

## Exact candidate evidence

- 26 focused tests PASS, including actual coordinator deferred overlap/error/progress, actual player fake-DOM pending cancellation/disposal, schema roundtrip/negative checks, SHA256 comparison to Node crypto at padding and 4MiB boundaries, crop/path math. tests.log.
- TypeScript PASS; changed-file ESLint PASS; tools production build PASS; diff check PASS (tsc.log, eslint.log, build-tools.log, diff-check.log). Final independent build to report candidate-tools, source 08a64180df7ca80f64436437027d8fc10b5c65df, PASS (final-build.log). Built artifact served only on localhost5198; not published.
- Stable built Chromium PASS: actual decoded nonblank first preview, face-model failure/motion fallback, authored pin and letterbox survive face-toggle; Save editable session / close page / open new page / load renamed identical bytes / import restores exact settings, targets, pins and letterbox / export crop JSON and actual video. browser-final.log, browser-knownsubject.log, browser-result.json, editable-session.json, restored-session.json, browser-check.mjs, browser-knownsubject.mjs.
- Built Chromium error/race coverage PASS: two overlapping media selections newest wins; wrong SHA rejects without applying edits; aspect edit clears render spinner and fences stale result; subsequent export succeeds; zero pageerrors (browser-races.log, browser-races-result.json, browser-errors-races.mjs).
- Real exported known-subject H2641080x1080: independent ffprobe and full ffmpeg decode PASS. Four decoded output frames versus independent source crop/letterbox references PASS (MAE0.182–0.428/255, red-square centroid delta<1px), including manual pin and letterbox. knownsubject-export-probe.json, knownsubject-export-decode.log, knownsubject-comparison.json. Test-only locally generated moving80x80red square on640x360black,3s30fps; no customer/third-party assets. Exact fixture/output hashes recorded in comparison report.

## Failed evidence retained and recovered

Initial borrowed mismatched deps blocked type/lint/build; that symlink was removed. Competing npm restore first failed ENOTEMPTY/ENOENT; after it settled sole exact-lock npm ci --ignore-scripts --no-audit --no-fund passed,763packages17s. npm-ci.log and npm-ci-retry.log preserve outcomes. First session-browser run restored edits but later export action failed DOM-detach/HMR while worker edited; browser-roundtrip.log retained. Reran once against stable static built candidate and passed; no identical-failure loop.

The existing fixture reframe-smoke.mp4, despite historical moving-square description, decodes as constant black then gray; decoded-frame-comparison.json is flat-frame evidence ONLY, not subject proof. A new moving-red-subject fixture and complete workflow were generated and verified separately as above. No false subject-quality claim from the old fixture.

## Scope and next gate

Checkpoint NEEDS_REVIEW: exact-head draft PR integration and mandatory checks/parent-stack qualification remain. Current PR check rollup: []; not claimed passing. No hosted-CI retry or billing change. Local deterministic/synthetic Chromium evidence is not full real-footage tracking quality, actual phone hardware, other browsers/platforms, native packaging, hosted CI, or deployed source parity. No product completion, universal quality/health score, release or demand/revenue claim. Follow-up: independent PR/stack integration review and required exact-head gate qualification; reuse this evidence if source unchanged.
