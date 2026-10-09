## Summary
- Name the workspace's status region so smoke tests retain exact behavioral assertions without confusing implicit `<output>` status roles.
- Validate current bounded-base64 paint archives, decoded RGBA pixels and UV ownership through save/reopen.
- Keep mutable Three texture uploads behind an explicit imperative resource boundary, preserving identity, paint/Undo/cancel behavior and upload invalidation; add subarray/nonmutation regression coverage.
- Build before artifact-dependent unit tests in CI; no required check is removed.
- Distinguish current qualification evidence from the old readiness ledger.

Stacked on security PR #3 (`b433a12`); merge that prerequisite through normal checks first. No deployment or protection bypass.

## Validation
- Node 22 macOS arm64 clean install, lint, typecheck, web build, desktop frontend build, release version validation pass.
- JavaScript budget suite: 15/15. Targeted GPU-resource/archive tests: 4/4. Production npm audit: zero groups.
- Full unit suite: **1,527/1,527 passed** after build completed; original baseline smoke was92/100, repaired candidate smoke is100/100. Earlier overlapping build/test run had one missing-generated-artifact failure; retained and fixed execution order.
- Independent OpenAI source review: no blocking findings; CI ordering independently reviewed.
- Real Chrome/SwiftShader, actual OCCT worker, synthetic editable SVG: resize40mm → extrude12mm → brass → Undo/Redo → FORM download → close/new tab → file reopen/state compare → STEP and GLB downloads. Independent binary decoding confirms40×40×12mm GLB and brass parameters.

## Remaining qualification
A new pre-existing responsive defect is confirmed: the project menu overflows offscreen at1440px, so the export leg requires1920px. Tracked as CORE-FORM-UI-EXPORT-001; no full responsive/core completion claimed. Fabric/Animation full golden workflows, native Rust/IFC toolchain checks, signed/notarized clean install/update and exact deployed artifact remain unverified. GitHub Actions was previously unable to start due account payments/spending limit; this PR does not bypass that external gate.

Detailed evidence retained in company Core Product Lab report `form-completion-2026-10-07.md` and `form-completion-20261007/` (synthetic artifacts only).
