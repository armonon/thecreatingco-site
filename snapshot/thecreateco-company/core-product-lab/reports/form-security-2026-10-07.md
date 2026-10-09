# Form bounded security cycle — 2026-10-07 Pacific

Task CORE-FORM-AUD-SEC-001; owner core-form-sec-20261008T0140. Started 01:40 UTC October 8, completed evidence at 2026-10-08T01:49:00.301225+00:00; under 35 minutes. PAUSE checks absent. Only this task claimed; company queue showed no other Form worker. Primary dirty room checkout untouched.

## Outcome: BLOCKED at normal merge/release gates

Three-file reviewed dependency repair committed and pushed to [PR #3](https://github.com/armonon/form-studio/pull/3), head `b433a12331af3dba200be596422442c103783831`, base main `b5abdd1de5f71fe0244ef9a651a6d983067541ff`. Isolated worktree `/Users/agentsattari/code/worktrees/form-security-20261007`. No downstack prerequisites: remote main matched baseline; PR targets main. No merge, deployment, public message, physical capture or financial/access changes.

Manifest pins Next 16.3.8 (rather than a minor upgrade); lock moves Next/env/SWC 16.3.4→16.3.8, nested sharp 0.35.4→0.35.5 with associated binaries/libvips, and source-map-js 1.2.1→1.2.2. Known Issues now scopes the clean audit to this candidate rather than claiming shipped/deployed safety.

## Actual results

Environment: macOS arm64, Node 22.23.2, npm version/platform in form-security-20261007/environment.json. Commands executed with Node22 prepended to PATH. Exit codes and timestamps in results.json / extra-results.json; full logs retained.

- Baseline `npm ci`: exit 0. `npm audit --omit=dev --json`: 1 critical + 2 high package groups (vulnerability report reproduced; baseline audit exit code was not separately retained); baseline-audit.json includes advisory ranges.
- Candidate clean `npm ci`: exit 0. `npm audit --omit=dev --json`: exit 0, zero groups. Full `npm audit --json`: exit 1, 15 high + 4 moderate groups remain; not called clean.
- `npm run typecheck`, `npm run build`, `npm run desktop:web:build`, `npm run build:netlify-marketing`, `npm run build:netlify-review`, `npm run release:validate`: all exit 0. Chunk/static-classification/node:module/ineffective-dynamic-import warnings retained, not treated as performance measurements or native signing evidence.
- `npm run test:unit`: exit 1; 1,518 passed / 8 failed / 1,526 total. Failure names exactly match prior durable baseline at the same source SHA (failure-comparison.json). Baseline full suite was not rerun this cycle. Seven ambiguous status queries and the legacy texture pixels assertion remain tracked by existing CORE-FORM-AUD-TEST-001. No assertions changed.
- Golden synthetic subset: `node --experimental-strip-types --test --test-name-pattern=acceptance projects build|SVG workbench shift-selection|canonical save state: real CAD Save As|Cast checks a selected mesh tests/workspace-smoke.test.mjs`: exit 0, 4/4. Existing UI tests exercise editable buckle/enclosure/garment, undo/redo, serialize/remount/compare, SVG extrusion persistence, mocked native Save As and STL export. Synthetic `.form` outputs, fixture SHA256 and logs saved. This is jsdom/mock-native engineering dogfood, not desktop close/reopen or complete Sketch→Model→Refine→Material→Export qualification.
- `npm run release:projects`: exit 0, 5/5 engineering projects. This corpus persists report summaries, not full customer-editable projects; its limitations remain explicit. Detailed report copied into evidence.
- `npm run lint`: exit 1. First post-build invocation scanned generated Netlify JS (8,167 findings); full log retained. Generated ignored Netlify outputs moved to evidence storage, then identical command/rules repeated: one react-hooks/immutability error in app/cad-workspace.tsx:2174. Source file and eslint-config-next unchanged by this patch; baseline lint was not independently rerun here. This is an unresolved gate, not asserted repaired.
- Exact-head GitHub web/native-macos jobs never started: annotations state failed recent account payments or spending limit. desktop-artifact skipped. Saved job/check/annotation JSON. No retry loop or financial changes.

## Independent review and exposure

Director actual model openai/gpt-6.1-sol verified via session_status. Separate isolated native OpenAI reviewer requested gpt-6.1-sol; runtime identified GPT-6/Codex; no fallback reported, no Claude review. Review ran and produced form-security-20261007/review.md: no patch-specific blocker; verified lock graph, published integrity metadata, version ranges, peers and runtime paths. It did not claim application tests. No Luna invoked: dependent patch/tests stayed with owner; model proportions were not quotas.

No app next/og/ImageResponse use found. Website uses Vinext/Cloudflare; worker explicitly exposes /_vinext/image through Cloudflare IMAGES. Desktop is separate Vite/Tauri bundle. These observations do not prove deployed exploitability absent or certify the separate Vinext image endpoint. Dev graph includes Miniflare sharp 0.35.2; emitted runtime reachability remains unverified.

## Resume condition

Repair existing eight workspace-smoke assertions without weakening contracts; repair source lint error with regression coverage; restore GitHub Actions availability through authorized account administration, then rerun required exact-head web/native/artifact gates and normal review. No personal Armon signoff is required for routine work, but gates cannot be bypassed. Keep full golden/native/signed-clean-machine and deployed-parity work unqualified. Existing Form tasks reused; deduplicated toolchain/runtime security and source-lint follow-ups queued with repro requirements and estimate scores.

Evidence directory: /Users/agentsattari/thecreateco-company/core-product-lab/reports/form-security-20261007. Candidate-source hashes, patch, environment, exact commands/results, fixture artifacts, baseline/fixed audits, review and CI failures retained.
