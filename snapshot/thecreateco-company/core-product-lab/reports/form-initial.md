# Form Studio initial audit

Audit date: 2026-10-07 (America/Los_Angeles). Task `CORE-FORM-001`.

## Executive result

**Health: UNKNOWN.** No combined health score is justified: interactive golden-workflow qualification, clean supported-machine release evidence, live deployment parity and quantitative UX/performance measurements were not established in this audit. Source declares Form Studio 0.40 an active beta (`README.md:5`); the separate generated product registry says ALPHA, while `KNOWN_ISSUES.md` calls itself 0.40.0 RC1 and readiness percentages in `PRODUCTION_READINESS.md` are dated to an older audit. These labels are not interchangeable and need a dated authoritative release record.

The repository has a broad automated test catalogue and detailed acceptance documentation. This supports a substantial engineering foundation, not professional-readiness by itself. The largest release risks evidenced now are: (1) fresh production dependency audit findings that conflict with the checked-in security summary; (2) no current user-visible end-to-end evidence for the cross-workspace Sketch → Model → Refine → Material → Save → Reopen → Export workflow; (3) separately-owned CAD and Rig project/recovery histories; and (4) stale/inconsistent release evidence.

No product code fix was made. A meaningful candidate security issue needs dependency/applicability triage and a safe, tested update; the audit is not a proof of exploitability. The full Node 22 unit run and production web build are complete below. The checked-in workspace-smoke suite includes stale test expectations (current base64 texture archive, implicit output status roles); no product data-loss defect was established by those assertion failures.

## Scope, source and provenance

- Product: Form Studio (web companion + Tauri macOS desktop; creative mesh, precision CAD, Fabric, Rig/Animation and Document workflows).
- Repo: `/Users/agentsattari/code/wave2/form-D`.
- Primary checkout at audit start: branch `wave5/form-room`, dirty (modified `app/cad-workspace.tsx`, `app/form-ui-v2.css`, `app/layout.tsx`; untracked `app/room-{3d,brief,export,geometry,layout}.ts`, `app/room-studio.css`, `app/room-studio.tsx`, `tests/room-detection.test.mjs`). It was preserved unchanged. No other checkout was edited.
- A detached worktree was created at `/tmp/form-audit-CORE-FORM-001`, commit `b5abdd1de5f71fe0244ef9a651a6d983067541ff` (`main` merge commit, clean at creation) for baseline dependency install, tests and build. This is source commit provenance, not assertion that it is the latest intended code: it does not contain the dirty `wave5/form-room` changes.
- No applicable repo `AGENTS.md` was found by `rg --files -g AGENTS.md` at the detached source root.
- GitHub open issue query: `gh issue list --repo armonon/form-studio --limit 30 --state open --json number,title,labels,updatedAt,url` → `[]` (no open issues returned to this authenticated/read-only query; this does not establish that all private/support issues are empty).
- TODO/FIXME/XXX/BUG keyword search in `app src-tauri tests docs` (excluding the large dated cloth matrices) returned no direct source TODO markers. This search is not a bug-finding proof.

## Architecture / areas examined

- Product README and package scripts; architecture entry points and high-level inventory. `README.md:5,9-18` describes an active beta, web editor and compiled native geometry/simulation/render services; shipping paths are `app/studio/page.tsx → app/cad-workspace.tsx` and `desktop/main.tsx → app/cad-workspace.tsx` (see `PRODUCTION_READINESS.md:5-9`).
- `app/cad-workspace.tsx` owns the CAD/Sketch and visible workspace switching; it contains desktop-native autosave routing for `workspace: "cad"`, explicit save/open/recovery UI, Fabric entry and handoff (`:1975-1985, 5643, 5708-5739, 6000, 6124, 6251, 6304`). Rig uses `app/studio-v2.tsx` and a different project schema/native recovery channel (`app/PARKED.md:14-19`; Rig autosave at `studio-v2.tsx:450, 2273-2288`). This division is intentional and documented, but limits cross-workspace unified persistence/history.
- The repo contains native Rust/Tauri services in `src-tauri`, extensive browser/domain modules in `app`, versioned project container/migrations and recovery, CAD exact geometry, cloth, rendering, animation, BIM, interchange and integration suites.
- Test catalogue observed: 100+ `.mjs` suites across CAD, Sketch, project format/save/recovery, document/export, Fabric/cloth, Animation/Rig, mesh/render/import and workflow smoke; package reports `test:unit`, serialized performance budgets, React smoke, native Rust and external-tool validation targets. The prior readiness ledger's 1,007 test count is dated historical evidence, not reused as current run evidence.

## Audit-area coverage

| Area | Examined | Result / limitation |
| --- | --- | --- |
| Architecture | Yes, source/docs | Broad multi-workspace implementation, separate CAD and Rig schemas/recovery, conditional/explicit handoffs. No full architecture trace. |
| Existing tests | Yes | Extensive suites exist; current run outcome is below. Unit coverage does not substitute for manual full-app qualification. |
| Build | Started/next | Exact outcome will be recorded below. Web build is not a native signed package qualification. |
| UI | Source + local browser screenshot | Chromium headless with SwiftShader rendered `/studio`; [form-model-ui.png](form-evidence/form-model-ui.png) shows Model workspace, selected exact body, workspace tabs, inspector and Appearance Studio. This is a local dev view at the detached source commit, not desktop/live qualification; detailed interaction/accessibility remain unknown. Standard headless GPU mode first produced a WebGL context runtime error, so SwiftShader was used.
| Main workflow | Static source/tests/docs | Focused on Model/Sketch/Fabric/Document and Model→Animation handoffs. Golden end-to-end project not interactively executed. |
| Open bugs | GitHub open issue query | No issues returned; private/support queues unknown. `KNOWN_ISSUES.md` and release acceptance contain explicit limitations/blockers. |
| TODOs | Keyword search | No direct TODO/FIXME/XXX/BUG markers found in scoped search; does not rule out technical debt. |
| Release status | Yes, docs only | Source README says active beta; Known Issues title says 0.40 RC1; registry says ALPHA; docs/percentages are stale and no current signed/notarized clean-machine evidence was generated. |
| Performance | Budgets/reports inspected | Native CAD/cloth gates exist, but measurements are historical broad debug thresholds; viewport FPS/input latency, startup/load/save/cancel/RSS clean-machine budgets remain release gaps (`docs/PERFORMANCE_BUDGETS.md:12-31`; `KNOWN_ISSUES.md:28-32`). No fresh product benchmark executed. |
| Save/reopen | Source/tests/docs inspected | Atomic native saves/backups/recovery and schema migration suites are documented. Full desktop cross-workspace close/reopen/recovery remains unqualified (`PRODUCTION_READINESS.md` save/open and release acceptance rows; `docs/RELEASE_ACCEPTANCE.md:40-50`). |
| Undo/redo | Source/tests/docs inspected | CAD and Fabric have evidence; Rig uses separate history. No comprehensive destructive-operation + save/reload E2E across all workspaces was run. |
| Import/export | Source/docs/tests inspected | STEP/DXF/mesh/IFC/document/garment paths and independent FreeCAD/Blender validation are described; AutoCAD/Cinema4D/CLO require licensed installs and customer corpus (`KNOWN_ISSUES.md:22-26`). No external recipient app run in this audit. |
| Failure recovery | Source/docs/tests inspected | Explicit recovery prompts/checkpoints; RC acceptance includes corrupt/future-version files, force quit and soak, but those manual scenarios were not run (`docs/RC_TEST_PLAN.md:49-57`). |
| Documentation | Yes | Detailed and candid constraints, but conflicting labels, age of authoritative readiness data, and stale parked-modules date need reconciliation. |

## Fresh validation

All commands ran in the detached baseline worktree unless stated otherwise. Node 22.23.2 satisfies `package.json`'s `>=22.13.0` engine. No deployment, GitHub write, release or production mutation was attempted.

- `npm ci` → PASS; resolved `next@16.3.4`; npm reported 21 total tree vulnerabilities (4 moderate, 16 high, 1 critical; includes development packages).
- `npm run typecheck` → PASS (machine-default Node 26.9.0).
- `npm run test:unit` with machine-default Node 26.9.0 initially failed in the workspace jsdom harness because Node 26 exposes a built-in global `localStorage` that is unavailable without `--localstorage-file`; the harness cannot shadow it, and the app fallback then tries `removeItem` on the unavailable global. Node 22.23.2 is within the declared engine and was used for the supported CI-style full repeat. This is a test-runtime compatibility finding, not a supported-browser failure.
- `npm audit --omit=dev --json` → 3 production dependency advisories (full JSON: [npm-audit-production.json](form-evidence/npm-audit-production.json)): 1 critical, 2 high (`next`, `sharp`, `source-map-js`). No direct source use of `next/og`/`ImageResponse` found; route/runtime reachability remains unverified.
- `/opt/homebrew/opt/node@22/bin/node --experimental-strip-types --test --test-concurrency=2 tests/*.test.mjs` → FAIL, 1,518 passed / 8 failed / 1,526 total on the durable repeat run (full durable log: [unit-node22.log](form-evidence/unit-node22.log)). Eight failures are in `workspace-smoke.test.mjs`: seven stale `getByRole("status")` queries ambiguous because `<output>` has implicit status role, plus baked texture assertion reads legacy `paintTexture.pixels` after archive switched to `pixelsBase64`. Isolated texture test with only its expectation changed to `pixelsBase64` passed through its existing project save/reopen assertions; temporary test edit was reverted. All eight failure names are in the durable repeat log; the first run’s additional order/load-sensitive failure did not survive the repeat. This does not certify the rest of the suite's edge behavior or excuse the red test gate.
- `env PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build` → PASS (captured output: [build-node22.log](form-evidence/build-node22.log)); web production build completed. Warnings: chunks >500 kB after minification, `node:module` externalized for browser compatibility, some routes unclassified by Vinext static analysis. Not a desktop/native signed package build.
- `npm run start` under Node 22 → BLOCKED in Vinext runtime (`ERR_UNSUPPORTED_ESM_URL_SCHEME`, `cloudflare:`); `npm run dev` worked at `http://localhost:3000` and was stopped after screenshot capture. This is a bounded local server limitation, not a release environment test.
- Chrome headless default GPU screenshot → rendered a Three.js WebGL context runtime error. Repeating with SwiftShader WebGL successfully rendered the app; screenshot hash/metadata are in `form-evidence/`.

Exact workspace-smoke summary: 92/100 pass, 8 fail (7 ambiguous status-role selectors and one legacy texture codec assertion). The first full-suite run reported 1,517/1,526 passing (9 failures); the durable repeat reported 1,518/1,526 (8 failures), all eight in workspace-smoke. The repeat delta indicates one additional order/load-sensitive failure in the first pass; its truncated output was not durably captured. The texture assertion failure is not evidence that save/reopen lost the texture: the updated current archive assertion passed and the existing reopen comparison succeeded.

## Evidence-backed candidates

Priority is P0 (stop-ship emergency), P1 (critical release blocker), P2 (high-value blocker), P3 (significant), P4 (moderate), P5 (minor), P6 (backlog). Ratings below are decision estimates on a 0–10 scale: impact, severity, workflow importance, competitive importance, release importance, confidence, effort and risk. They are estimates from the evidence, not measured customer metrics. Candidate counts are intentionally below ten where this audit lacks proof.

### Bugs / reliability / security

| Candidate | Priority | Impact | Severity | Workflow | Competitive | Release | Confidence | Effort | Risk | Evidence / next proof |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Triage and resolve three fresh production dependency advisories (critical Next.js `next/og` RCE range and two high findings) against the web runtime, dependency graph and actual route exposure. Do not claim exploitability until route/usage analysis. | P0 | 8 | 9 | 4 | 3 | 9 | 9 | 3 | 4 | Clean `npm ci` in isolated worktree resolved `next@16.3.4`; `npm audit --omit=dev` reported critical Next, high sharp and high source-map-js. `rg` found no direct `next/og`/`ImageResponse` source use. Fix/version and runtime image route review, production build/audit regression required. Conflicts with `KNOWN_ISSUES.md:32` claiming no known high-severity production advisory. |

No product data-loss defect was regression-proved in this audit; the baked-texture persistence check passed when the test asserted the current base64 archive field. Keep the security advisory as P0 triage due to a critical production dependency advisory; actual route exploitability is still a hypothesis.

### Workflow gaps

| Candidate | Priority | Impact | Severity | Workflow | Competitive | Release | Confidence | Effort | Risk | Evidence / next proof |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Qualify one representative cross-workspace golden project from Sketch through independent export recipient, including complete desktop close/reopen, undo/redo and crash recovery. | P1 | 9 | 8 | 10 | 8 | 10 | 9 | 6 | 3 | `docs/RELEASE_ACCEPTANCE.md:40-50` and `docs/RC_TEST_PLAN.md` prescribe but do not supply current per-build interactive evidence. Spec added at `core-product-lab/golden-projects/form.md`; not run. |
| Make CAD↔Rig/Animation persistence/history boundaries explicit in supported golden workflows; either prove exact handoffs and recovery across them or document separate-save expectations in current UI/help. | P2 | 8 | 7 | 8 | 7 | 8 | 8 | 6 | 4 | `app/PARKED.md:14-19` intentionally keeps separate schemas/recovery and explicit handoff; tests/docs exist but no full user-run save-reopen across this boundary was verified. |
| Complete clean-machine signed install/update/migration and supported-platform release acceptance. | P1 | 8 | 9 | 7 | 7 | 10 | 9 | 7 | 3 | `KNOWN_ISSUES.md:5-10,20`; README says not a signed commercial release. Requires credentials/hardware, no evidence produced here. |

### UX / product clarity

| Candidate | Priority | Impact | Severity | Workflow | Competitive | Release | Confidence | Effort | Risk | Evidence / next proof |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Reconcile release maturity and audit dates across README, known issues, readiness ledger, product registry and current branch/deployment; publish one evidence-linked status per build. | P2 | 7 | 6 | 7 | 5 | 9 | 10 | 2 | 2 | README `:5` beta; Known Issues title RC1; production readiness `:5` last audited 2026-08-26; product registry had ALPHA status on 2026-10-07. These sources conflict. |
| Perform an actual interaction/accessibility review of Sketch→Model→Material and recovery/error states, then prioritize only observed friction. | P4 | 5 | 4 | 7 | 6 | 5 | 3 | 3 | 2 | UI was not interactively examined here, so no specific UX defect is asserted; this is a bounded evidence gap, not a padded list of redesign proposals. |

### Performance opportunities

| Candidate | Priority | Impact | Severity | Workflow | Competitive | Release | Confidence | Effort | Risk | Evidence / next proof |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Add current clean-Apple-Silicon budgets/history for viewport frame/input latency, cold startup/project open-save, peak memory and cancellation; keep current native geometry/cloth gates. | P2 | 8 | 7 | 8 | 7 | 8 | 9 | 5 | 3 | `docs/PERFORMANCE_BUDGETS.md:12-31` explicitly identifies these missing budgets and says existing native 15s ceilings are wide beta gates; historical baseline is 2026-08-09. |
| Re-profile known large CAD history and dense cloth rebuild stalls on representative current projects before proposing optimization. | P3 | 6 | 5 | 6 | 6 | 5 | 7 | 4 | 3 | `KNOWN_ISSUES.md:28-32` reports multi-second rebuilds and non-interruptible active Open CASCADE operations. No fresh benchmark was run. |

### Professional feature gaps

| Candidate | Priority | Impact | Severity | Workflow | Competitive | Release | Confidence | Effort | Risk | Evidence / next proof |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Continue native CAD operation parity and support-matrix qualification for exact workflows, with clear recovery/unsupported-operation behavior. | P3 | 7 | 5 | 7 | 8 | 6 | 8 | 8 | 4 | `KNOWN_ISSUES.md:18`; README `:10` cautions exact B-Rep capability varies by history; readiness ledger calls Revolve/topology parity a remaining milestone, but current source contains improvements beyond that stale ledger. Reconcile actual operation matrix before scheduling implementation. |
| Expand independent interchange corpus and inspect native recipients for supported STEP/DXF/mesh claims. | P3 | 7 | 6 | 7 | 8 | 7 | 8 | 6 | 3 | `KNOWN_ISSUES.md:22-26` documents FreeCAD/Blender automation and unavailable licensed AutoCAD/Cinema4D/CLO validations. No recipients run here. |

## Release and next action

Do not call this build production-ready based on the local source/test suite alone. Highest-value next sequence: (1) investigate/fix current production dependency audit advisories and re-run audit/build; (2) reconcile release evidence and the dirty feature branch against the intended source/deployed target; (3) create and execute the golden-project fixture on a supported desktop build, attach exact checksums, logs and independent export checks; (4) complete signed clean-machine/update and recovery qualification. No product health score or product-specific quality dimension is assigned until a measured/tested rubric exists.
