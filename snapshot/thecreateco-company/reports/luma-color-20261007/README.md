# Luma export color + browser-save repair — source checkpoint complete

- Source: `d4e722330e65a260badc475f53a7a176ccfe7e57`, isolated worktree `/Users/agentsattari/code/company-worktrees/luma-color-20261007`.
- PR: https://github.com/armonon/luma-studio/pull/7 — OPEN, stacked on PR6. Not merged or deployed.
- Task: CORE-LUMA-EXPORT-COLOR-001. Independent OpenAI parent review approved final source after conversion and keyboard findings were fixed.

## Defects, baseline and repair

1. `baseline-browser-connected/report.json`: imported bitmap equals independent browser sRGB decode exactly; CPU PNG changes RGB by up to7 (alpha0). Full/tiled unit regressions also fail at7 (`baseline-unit.log`). Full-resolution rgba8 editing bitmaps now remain the render source rather than their quantized linear-light derivative. High-depth, tile-only and preview-proxy surfaces remain authoritative. GPU direct-upload selection agrees, but actual GPU execution is not qualified.
2. Parent review caught explicit 32→8 conversion leaving a stale bitmap. Regression failed (`conversion-baseline.log`), then conversion refresh fixed full-size bitmap, absent clear tiles and Undo/Redo. Archive/tile encodings are unchanged.
3. Actual save downloads `.luma`, but the busy overlay intercepted required confirmation clicks (`candidate-browser-roundtrip/report.json`, `failure.png`). The overlay now yields to confirmation while editing/reentry remains blocked.
4. Parent review caught global capture blocking confirmation keyboard. Actual Tab baseline failed (`keyboard-baseline/report.json`). Exception is limited to targets inside the confirmation dialog, with startup/native-opening still blocked; existing dialog stops propagation and traps focus.

The previous merged eyedropper expected quantized #38b86a for input #39b86a. Exact-input expectation is now #39b86a; no tolerance was loosened.

## Exact-source validation

`exact-web-gates.json`: clean source before/after, unchanged d4e7223, Node22.23.2. All7 checks PASS: types; strict app/tests lint; full lint; npm test (Vinext build, rendered HTML4, engine1393 pass/10skip/0fail); Netlify build; desktop bundle; production audit0 findings.

`exact-browser/report.json`: clean source, Chrome154.0.8037.98, macOS local desktop shell. All15 checks PASS:
- Independent decode versus imported bitmap; actual first/repeated PNG exports.
- Three real generated PNGs: retained2048×1536 gradient/partial alpha, opaque matrix/TRC ICC sRGB, transparent/partial-alpha image.
- Actual `.luma` download, pointer confirmation, close/reopen, PNG download. Every reference comparison is RGB0/alpha0 (fixed gate RGB≤2, alpha0).
- Actual Tab/Shift+Tab/Enter decline+retry and Escape decline preserve dirty state; subsequent confirmation succeeds without forced clicks/callback invocation.

Fixture and archive hashes, source/diff/harness hashes and browser version are in the report. Source-controlled reproduction: `docs/release/raster-color-qualification.md`, `build/qualify-raster-color.mjs`, `tests/raster-export-fidelity.test.ts`.

## Remaining gates — product NOT complete

- New PR-triggered Actions run https://github.com/armonon/luma-studio/actions/runs/37722986444 did not execute any steps in all3 jobs. Exact annotations: failed recent account payments or spending limit; `ci-jobs.json` and `ci-annotations.json`. No retry requested. Account owner must restore billing/runner access, then required checks must actually pass before release.
- Native Rust/Tauri/OS file dialogs, GPU execution, Firefox/WebKit/mobile/physical platforms, signing/clean install/update are unverified by this checkpoint.
- This narrow raster golden does not qualify complete layered/masked/adjusted golden editing, actual crash/quota recovery, performance, independent external-format corpus or all accessibility.
- PR stack/source-to-live provenance remains unresolved; no production publication.

## Diagnostic history

Intermediate logs intentionally retained, not represented as final exact-source qualification. Initial browser connection failure was IPv6 localhost binding. Earlier save harness selector omitted the keyboard-shortcut accessible-name suffix; corrected selector then revealed real modal/keyboard bugs. Intermediate `npm-test.log` had old drifted eyedropper golden failure; exact run passes. No fabricated metrics, forced interactions, secret files or native pass claims.
