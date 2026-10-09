# Form/Cast qualification and ASCII STL repair

Checkpoint: 2026-10-08T03:22:40.099528+00:00. Task PROGRAM18-CAST-QUAL-001. This is a reviewed/pushed repair and partial qualification, **not complete Cast certification**.

## Source and release
- Candidate: `d24f5d76b4fd0e99c43e1cb8e5e2d9b63db6665e`, isolated `code/worktrees/form-cast-stl-20261007`.
- PR: https://github.com/armonon/form-studio/pull/6, stacked on Form PR5. OPEN, not merged/deployed.
- Independent OpenAI source review approved18-line classifier and16-line regression delta; see independent-review.md.
- Required Form hosted checks remain blocked by account billing/spending outage. No retries, payments or bypass; local success does not replace required remote checks.

## Initial rendering: audit probe false negative
Both canonical Form and review-host Cast returnHTTP200 and render real workspace/start-center controls. The fixed-position editor gives body a zero-height box; the old body's visibility wait was invalid. No404/blank-app finding is warranted.
Shared `release-program/audit-interfaces.mjs` now waits for visible app landmarks/controls and records actual witness, labeling RENDERED_NOT_WORKFLOW_QUALIFIED. Parent independently reviewed. `interfaces.json` and screenshots record actual controls/no pageerrors. Original failure remains in inventory history and original report. Company artifacts are durable local state, not committed/pushed into home Git. Probe SHA2569a8d4ade4ce6154823d4497a981b40724cc6a0a43f9990a308e1980f68e4e094.

## Confirmed public geometry corruption
Public ASCII STL imported through File.arrayBuffer was decoded as binary coordinates: a12-triangle closed20×10×4mm box exported around1.86156e35mm in each axis. `observed-public-ascii-failure.log` preserves the failed independent parser assertion.
Shared fromStl now recognizes ASCII browser bytes. Exact-length binary records win even if their arbitrary header begins solid. Existing truncated-binary semantics retained. Unit regression covers BOM, CRLF, Unicode names, cm dimensions/volume and binary solid header.

## Exact candidate verification
Node22.23.2/npm10.9.8/Darwin25.2arm64. Types/lint PASS; web and desktop frontend builds PASS; **1,528/1,528 unit tests**, **15/15 budgets**, production audit0. Logs recorded without native-test claims. Environment and149web/28desktop fileSHA256 manifests retained.
Real built Chrome154/SwiftShader,1440×1000: ASCII STL→cm scaling→STL download→independent exact triangle-coordinate/bounds comparison; basic repair→Undo; malformed STL preserves prior mesh; parent Form entity/feature/appearance/model state unchanged; actual downloaded STL→close/new browser page→reopen in mm→same geometry. Zero pageerrors. `local-built/cast-workflow.json` and screenshot are evidence. This is real editor/Three/file/download code, no mocks.
Public binary-input version independently passes the same workflow; `public-binary/cast-workflow.json`. Public ASCII defect remains until deployment.
Development frontend completed the geometry/recovery steps but failed strict pageerror assertion with OCCT non-WASM response; retained `local-dev.log`, not called fullPASS. Built frontend does not exhibit that error.

## Public provenance and unchanged deployment
Netlify review sitee2547267-2c70-458b-abe9-5fbfeb70f38e, deploy6ac5ba1aaeefd1fa9121aa8a, published2026-10-07T03:20:07.833Z, commit_refnull/no repo buildsettings. Source mapping remains unknown; `netlify-provenance.json`. Canonical Form serves a distinct cloud frontend; review is local desktop-style frontend, not interchangeable. No public files/config/functions/data changed.

## Remaining qualification and exact next actions
- Required CI: account owner resolves billing/spending availability; then normal exact-head checks/stacked PR merges. No retry loop or bypass.
- Independently qualify ring resizing, hollow reference geometry, thickness/orientation, OBJ, nonfinite/large/aborted/racing imports and full Cast settings/session persistence. Current evidence proves exported STL geometry reopening, not editable Cast analysis-state persistence.
- Verify actual intended browsers/platforms and mobile accessibility; no native or physical casting/printer/ring measurement certification.
- Resolve dev-only WASM asset response in isolated dev setup if that development entry is supported; do not conflate with built artifact.
- Reconcile published manifest/source before authorized Form/Cast deployment and verify full files/functions/config preservation.

`results.json` records structured source_sha/core_workflow/tests/platforms/documentation/critical_blockers/deployment. All untested criteria remainUNVERIFIED.

## Hosted CI receipt
PR6 automatically triggered run37722350586: web and native-macos FAILURE with0steps; desktop-artifact SKIPPED. Exact-head annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased." Evidence ci-run.json and ci-annotations.json. No rerun requested.
