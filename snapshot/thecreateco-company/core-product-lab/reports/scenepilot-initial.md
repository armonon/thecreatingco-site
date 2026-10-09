# ScenePilot initial product audit

**Status: COMPLETE (source/repo audit); golden-workflow qualification: NOT COMPLETE.**
Audit date: 2026-10-07. No production changes, deploys, releases, commits, or edits to existing ScenePilot checkouts were made. A small accessibility repair is available on an isolated, unmerged branch as detailed below.

## Source and provenance

- Audited baseline: `fb42d12b98c895b47642eaab4a9be74de0c2c358` (`2026-10-06T15:02:28-07:00`), package version `0.1.16`, branch `wave4/scenepilot-suite`, remote `origin/wave4/scenepilot-suite` confirmed read-only with `git ls-remote`.
- Baseline worktree: `/tmp/scenepilot-audit-fb42d12`, clean, detached, created from that commit. Repository: `/Users/agentsattari/code/wave2/scenepilot-autocut`.
- The existing wave2 checkout was left untouched; it had 193 modified/untracked paths, including generated `site/` assets and source files. Its current uncommitted contents are not audit evidence.
- Remote `origin/main` was `a0a0791a2928780d3c77a160ed34d4e464a15745` (Oct 5, version 0.1.15). It diverges from the audited Wave 4 branch: 43 commits unique to Wave 4, two unique to main. The second local checkout `/Users/agentsattari/code/sattari/scenepilot-studio-badass` is clean but a separate history at `baaec95f232d8cae14d466439b1c0930082499e4` (Sep 20); treated only as historical context, not the canonical audited source.
- No repository `AGENTS.md` was found under the audited ScenePilot tree. Company instructions and the ScenePilot brief define the audit scope.

## Product and architecture examined

ScenePilot is a React/TypeScript web editor plus Electron desktop Pro and separate Lite tool/PWA surfaces. The current source includes a multi-track timeline, project/media management, composition documents and nested compositing, keyframes/motion, audio mixing, render/export paths, native media helpers, autosave/recovery and undo-command infrastructure. Core entry points examined include `app/page.tsx`, `app/source-program-monitor.tsx`, `app/project-document.ts`, `app/editor-command-registry.ts`, `electron/main.js`, `electron/atomic-file.js`, `electron/media-engine.js`, and `docs/` qualification material.

Tests cover project-store/persistence, release persistence, render-queue recovery, command/undo registration, sequence editing, import/interchange, composition, media decoding/rendering, and layout/accessibility. Code/test presence is evidence of implementation and automated coverage, not full creative-workflow correctness.

## Qualification results

| Area | Evidence and result | Unknown / unqualified |
| --- | --- | --- |
| Build and tests | Isolated baseline: `npm test` passed its Vinext production build and **1,091/1,091 tests**. `npm run check` (TypeScript + ESLint) passed. `npm run build:site` passed app, tools, and PWA builds; PWA precache was 150 URLs / 6.3 MB. | These checks do not certify packaged installation, visual quality, or an end-to-end project session. |
| UI | Electron/offscreen Axe flow opened New Project, Edit, and Delivery and checked WCAG 2.1 A/AA rules. Baseline failed with 2 critical `aria-required-children` findings (preview disclosure nested in tablist) and 3 distinct serious contrast failures, repeated across states. See `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/accessibility-baseline-fail.log`. | No human visual/perceptual review or screenshot-based design review was performed. |
| Accessibility regression repair | On separate branch `codex/scenepilot-a11y-audit-20261007` at `/tmp/scenepilot-fix-fb42d12`, moved preview disclosure outside the semantic tablist and raised three low-contrast text colors. `npm run check` passed and the same `npm run qa:accessibility` passed all 3 states with zero blocking findings; see `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/accessibility-fix-check.log` and `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/accessibility-fix-pass.log`. Diff remains uncommitted/unmerged and is not in the audited baseline. |
| Performance | `npm run qa:performance` passed: 20,000-clip context compilation 4.5597 ms (80 ms budget); eight-track 1 s PCM mix 50.5468 ms (19.78× realtime); 10,000-cut prepared p95 0.017 ms; 10,000-overlay prepared p95 0.0077 ms; prepared speedup 11.37×. Log: `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/performance-benchmark.log`. | Synthetic engine microbenchmarks, not playback FPS, startup, memory growth, sustained real 4K playback, low-memory behavior, or export-size envelope. Historical release report specifically leaves those unverified and notes shared render can materialize path-backed media in memory. |
| Save/reopen, undo/redo, recovery | Source and tests/docs examined: `tests/project-store.test.mjs`, `tests/release-persistence.test.mjs`, `tests/render-queue-recovery.test.mjs`, `tests/editor-command-registry.test.mjs`; historical 0.1.16 report records atomic/serialized saves and a limited packaged save/reopen/export journey. | The complete golden journey, dirty-close variants, abrupt process kill, disk pressure, large project, and recovery/relink UI were not executed in this audit. The historical report marks several of these NOT VERIFIED. |
| Import/export | Source, test areas, manual QA and qualification docs examined. Prior report has a fixture MP4 save/reopen/export sample and describes codec/real-footage coverage. | No full current-baseline import→edit→composite/animate→audio→save→reopen→export run; camera codec/VFR/HDR/large media and perceptual preview/export parity remain unqualified. |
| Release | Registry says ALPHA / public alpha reported. Repo has fail-closed release qualification docs; historical 0.1.16 assessment says not ready for unrestricted production, with notarization, clean-machine, perceptual, and real-media gates pending. | No live release/download/deployment was inspected in this bounded source audit; no exact current public artifact was qualified. Do not label production-ready from tests/build. |
| TODOs / open bugs / documentation | Searched app/lib/electron/tools/tests/docs for TODO/FIXME/BUG/HACK and explicit unsupported capabilities; reviewed README, manual QA, release qualification, workflow and audio/composition docs. The only verified current-source bug from the UI audit is the accessibility issue above. | No authoritative in-repo issue tracker or live support/feedback feed was available. Many old reports are dated and candidate-specific. |
| Dependency security | `npm audit --omit=dev` on lockfile dependencies found 3 production advisories: direct `next@16.3.3` critical (includes next/og ImageResponse RCE advisory; affected `<16.3.6`, plus advisories through `<16.3.8`), transitive `sharp` high (`<0.35.5`), and `source-map-js` high (`<=1.2.1`). | Advisory presence is established; reachable vulnerable routes and practical exposure were not independently assessed. This requires immediate security triage before relying on these server paths. |

## Candidate backlog

Scores below are **estimates** (0–10), not measured quality scores or KPIs. `evidence` records observed facts; `hypothesis` marks unverified risk. Full machine-readable records are in `core-product-lab/products/scenepilot.json`.

### Bugs / reliability

- **SP-A11Y-001 — Monitor tablist contains non-tab preview disclosure and fails contrast checks. P3.** Evidence: baseline Axe found critical tablist children violations and serious contrast ratios 3.23–3.93 against the 4.5:1 threshold. Regression-proved isolated repair passes the same audit, but remains unmerged; reviewable patch: `core-product-lab/reports/scenepilot-a11y-fix.patch`. Estimates: impact 6, severity 5, workflow 5, competitive 3, release 6, confidence 10, effort 2, risk 1.

No functional data-loss/crash defect was reproduced in this audit. This is not evidence that none exist.

- **SP-SEC-001 — Patch and triage vulnerable production dependency versions. P0 security.** Evidence: lockfile resolves direct `next@16.3.3` and npm audit flags one critical and two high production advisories; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/npm-audit-production.json`. Estimates: impact 10, severity 10, workflow 8, competitive 4, release 10, confidence 10 (version/advisory match), effort 3, risk 5. **Reachability/exploitability is unverified**; app does not directly import `next/og`, but does use Next headers/navigation in Vinext-backed runtime. Next action: determine whether affected Next server routes are deployed/reachable, update to patched versions in an isolated branch, then run full compatibility/security checks.

### Workflow gaps

- **SP-WORKFLOW-001 — Qualify the complete ScenePilot golden workflow on a reproducible real project. P2.** Evidence: task brief requires Import→Edit→Composite/Animate→Audio→Save→Reopen→Export; historical release assessment documents only partial fixture/package journeys and leaves multiple E2E paths pending. Hypothesis: workflow seams or fidelity issues may emerge when exercised together; no such failure is asserted yet. Estimates: impact 9, severity 7, workflow 10, competitive 8, release 10, confidence 10, effort 7, risk 3.
- **SP-RECOVERY-001 — Complete abrupt-exit, disk-pressure, and missing-media relink qualification. P1 qualification gate.** Evidence: historical 0.1.16 report explicitly marks abrupt termination, disk failure, and complete relink UI unverified. Hypothesis: recovery paths may fail outside deterministic unit coverage; unverified only, not a confirmed defect. Estimates: impact 9, severity 8, workflow 9, competitive 6, release 10, confidence 9, effort 6, risk 4.

### UX improvements

- **SP-UX-001 — Make Lite/Pro availability and media counts unambiguous. P3.** Evidence: historical assessment records some Lite controls exposing Pro-only workflows and the asset bin showing zero while main media is loaded; it explicitly says this is confusing, not proof of lost source. Hypothesis: current Wave 4 behavior may have changed; recheck on the active live candidate before implementation. Estimates: impact 6, severity 4, workflow 7, competitive 3, release 5, confidence 7, effort 3, risk 2.
- **SP-UX-002 — Merge the tested monitor accessibility repair. P3.** Evidence: observed baseline failures and passing isolated regression noted above. Estimates: impact 6, severity 5, workflow 5, competitive 3, release 6, confidence 10, effort 2, risk 1.

### Performance opportunities

- **SP-PERF-001 — Establish real-media playback/export size and memory envelope. P2.** Evidence: synthetic gates pass; historical report explicitly leaves sustained 4K, long-session memory, low-memory, and path-backed media export memory behavior unverified. Hypothesis: large projects may exceed safe memory/time bounds; no performance failure reproduced. Estimates: impact 9, severity 7, workflow 9, competitive 7, release 10, confidence 9, effort 8, risk 4.

### Professional feature gaps

- **SP-FEATURE-001 — Independent composition frame rates. P4.** Evidence: `docs/composition-workflow.md` explicitly says frame rate follows project and independent per-comp rates are not implemented. Hypothesis/validation needed: establish demand and interchange expectations before implementing. Estimates: impact 5, severity 3, workflow 5, competitive 5, release 3, confidence 8, effort 6, risk 3.
- **SP-FEATURE-002 — Reverse/variable audio retiming and pitch-preserving stretch. P4.** Evidence: `docs/audio-edit-reliability-2026-09-23.md` says these are not implemented. Estimates: impact 6, severity 3, workflow 6, competitive 6, release 4, confidence 8, effort 7, risk 4.

## Golden project status and next step

`core-product-lab/golden-projects/scenepilot.md` now defines a reproducible, generated-media fixture and qualification protocol. **It is a specification only: the fixture project/assets have not yet been created or qualified.** Next action: create the license-safe fixture in an isolated worktree, then run it through Lite and Desktop Pro with file hashes, save/reopen structural comparison, undo checks, export probes, and a written perceptual comparison. Use the result to promote only reproduced failures into engineering work.

## Environment and command log

All builds/checks were run in `/tmp/scenepilot-audit-fb42d12`, separate from existing checkouts.

- `npm ci --ignore-scripts`: succeeded; npm reported 33 dependency advisories (9 moderate, 23 high, 1 critical); raw output `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/npm-ci-ignore-scripts.log`. Full install lifecycle scripts then failed downloading OpenVINO runtime from `storage.openvinotoolkit.org` (ETIMEDOUT); captured error summary `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/lifecycle-install-timeout.txt` (original npm debug log was not retained).
- `npm run build:site`: exit 0; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/build-site.log`.
- `npm test`: exit 0; Vinext build plus 1,091 tests passed; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/npm-test-build-and-suite.log`. To make local ffmpeg-dependent tests runnable after scripts were disabled, isolated worktree's `node_modules/ffmpeg-static/ffmpeg` was symlinked to `/opt/homebrew/bin/ffmpeg`; no repository files were changed.
- `npm run check`: exit 0; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/check-typescript-lint.log`.
- `npm run qa:performance`: exit 0; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/performance-benchmark.log`.
- `npm run qa:accessibility`: baseline exit 1 with five blocking findings across three states; `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/accessibility-baseline-fail.log`. On isolated fix branch, same command exit 0 and `npm run check` exit 0; logs above.
- An early `npm run test:quick` was attempted before required build output/runtime setup and failed due missing `ffmpeg-static` binary and `dist/server/index.js`; this was superseded by the successful build-backed `npm test` after isolated setup. Log: `/Users/agentsattari/thecreateco-company/core-product-lab/reports/scenepilot-evidence/initial-quick-tests-setup-failure.log`.

## Limits

No clean-machine install, notarized artifact, current public download/deploy, human screenshot/perceptual review, real footage, hours-long session, full golden project, Safari/Firefox matrix, or complete recovery journey was qualified. These remain unknown, not passed and not scored. No product quality score is assigned.
