# Core Product Health

Updated: 2026-10-10T17:40:27+00:00

Quality scores: unknown until measured. Local checks are not release qualification.

## SCENEPILOT

- Audit report: [report](reports/scenepilot-initial.md)
- Readiness: ALPHA / NOT QUALIFIED. Reviewed c26d518 pushed PR95 on PR94;1095tests/types/lint/build,6 rebuiltElectron checks,2 Lite menu viewports and4 Lite lifecycle checks PASS. Three baseline desktop synthetic12s exports/42 sampled output checks pass; fullUIauthored/package/nativechooser/perceptual/hosted-stack gates unresolved.
- Quality score: Unknown / not scored
- Golden workflow: SCOPED SYNTHETIC PASS: three desktop12s composite persistence/undo/reopen/export runs; one Lite720p silent lifecycle; FULL GOLDEN UNQUALIFIED
- CORE-SP-RECOVERY-001 — NEEDS_REVIEW: Qualify abrupt-exit, disk-pressure, and missing-media recovery journeys
- CORE-SP-WORKFLOW-001 — BLOCKED: Qualify complete generated-media golden workflow in Lite and Desktop Pro
- CORE-SP-PERF-001 — BLOCKED: Measure real-media playback/export memory envelope and long-session performance
- CORE-SP-SEC-RESIDUAL-001 — BLOCKED: Qualify remaining build-tool advisory reachability and update upstream-safe fixes
- CORE-SP-UX-001 — BLOCKED: Clarify Lite/Pro disabled controls and loaded-media counts

## LUMA

- Audit report: [report](reports/luma-initial.md)
- Readiness: ALPHA / unqualified. Exact PR9 8c15f85 Vinext build/types,7focused tests and24Chromium renderer cases pass. Extended synthetic oracle fails6/15: Multiply/multipass/no-op style inflate partial alpha; archive reopen preserves defect. Hosted/stack/native/fullUI/source-live gates unresolved.
- Quality score: Unknown / not scored
- Golden workflow: Not yet fully qualified
- CORE-LUMA-AUD-005 — BLOCKED: Resolve production dependency advisories and verify runtime exposure
- CORE-LUMA-AUD-002 — BLOCKED: Qualify current-source import-through-export golden workflow
- CORE-LUMA-ADJUSTMENT-VARIANTS-001 — BLOCKED: Qualify partial-opacity, masked and styled adjustment alpha semantics
- CORE-LUMA-AUD-003 — BLOCKED: Measure packaged interaction latency and process memory
- P01 — BLOCKED: Reconcile Luma production with a reproducible source baseline

## FORM

- Audit report: [report](reports/form-initial.md)
- Readiness: ALPHA / NOT QUALIFIED. Independently reviewed b5f8b08 pushed draft PR9 on PR7; emitted Worker PNG200 byte/header fallback and R2 CRUD, web/desktop frontend builds, typecheck/lint,4asset tests and scoped browser save/reopen/export PASS. Exact-head hosted CI billing-blocked; downstack/native/full golden/source-live gates unresolved. No merge/deploy.
- Quality score: Unknown / not scored
- Golden workflow: REAL_BROWSER_SCOPED_SAVE_REOPEN_EXPORT_AND_MENU_PASS; native/Fabric/Animation and full product qualification UNVERIFIED
- CORE-FORM-AUD-SEC-001 — BLOCKED: Triage current production dependency advisories
- CORE-FORM-AUD-WF-001 — BLOCKED: Qualify Sketch-to-independent-export golden workflow
- CORE-FORM-AUD-SEC-002 — BLOCKED: Triage remaining toolchain and Vinext runtime dependency advisories
- FORM-GARMENT-APP-001 — NEEDS_REVIEW: Build dedicated pattern-first garment designer with scan-to-editable-pattern and pattern-to-3D workflows
- CORE-FORM-AUD-PERF-001 — BLOCKED: Add current interactive and project lifecycle performance budgets

## STEMDECK

- Audit report: [report](reports/stemdeck-initial.md)
- Readiness: ALPHA / NOT QUALIFIED. Independently reviewed6bad0ed pushed PR34 (on PR33);2259 unit tests, standalone build/types/lint and actual WebKit39-asset UI/restart/zero-error PCM pass. Mandatory exact-head local gate BLOCKED at disk1.203GB<2.838GB; hosted/stack/native13-of14/physical/source-live gates unresolved.
- Quality score: Unknown / not scored
- Golden workflow: LOCAL SYNTHETIC WEBKIT SUBSET PASS: four-deck capture/replay/arrange/edit/undo/save/full process reopen/portable39-asset restore/export. Physical/full musical/platform/release qualification UNVERIFIED.
- CORE-STEM-ARCHIVE-WEBKIT-001 — BLOCKED: Repair and qualify WebKit portable archive asset byte identity
- CORE-STEM-REPLAY-DEADLINE-001 — NEEDS_REVIEW: Diagnose and repair actual captured four-deck replay scheduling stop
- CORE-STEM-AUD-002 — BLOCKED: Qualify real perform → capture → replay → arrange lifecycle
- CORE-STEM-WEBKIT-REFERENCE-001 — NEEDS_REVIEW: Qualify WebKit captured reference decode and real UI lossless fallback
- CORE-STEM-AUD-003 — BLOCKED: Measure long-session audio deadlines and memory

## Next eligible task

None: inspect active ownership/blockers before creating work.

Full unified queue: [PRIORITIES.json](PRIORITIES.json). Original truth: ../engine/company.sqlite3, managed through ../engine/company.py.
