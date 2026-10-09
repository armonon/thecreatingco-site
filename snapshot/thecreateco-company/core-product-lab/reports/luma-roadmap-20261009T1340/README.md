# Luma color/interchange qualification and gated roadmap — 2026-10-09

Task: CORE-LUMA-AUD-004. Owner: core-lab-20261009T1340-roadmap.
Source: 8c15f8537c1176b7d4c0076182b7501c92f714b5, isolated detached worktree
`/Users/agentsattari/code/company-worktrees/luma-roadmap-20261009T1340`.
No tracked source changes, no commit/push/merge/deployment.

## Measured qualification

`node_modules/.bin/tsx --test tests/high-depth-psd.test.ts tests/psd.test.ts tests/psd-project-preservation.test.ts tests/color-management.test.ts tests/embedded-color-profile.test.ts`

Exit 0: 51 passed, 0 failed, 0 skipped. Full output: tests.log; exact command,
source, macOS environment and Node v26.9.0: receipt.json. Dependencies reused
read-only from the existing same-SHA qualification worktree; not a clean install.
Synthetic engine fixtures exercised native layered 16/32-bit PSD and PSB export,
import/re-export, editable masks, alpha/opacity, merged pixels, source passthrough,
project save/reopen preservation, invalid sample refusal, compatibility warnings,
ICC resource retention and matrix/TRC conversion. This is engine dogfooding, NOT
UI/native/external-Photoshop or full golden-project qualification.
Build not rerun: unchanged exact source already has dated typecheck/Vinext build
receipts in reports/luma-adjustment-20261009T0940; these are historical, not new runs.
Existing six alpha failures in the 15-sample adjustment probe remain unresolved.

## Confirmed documentation drift

README.md:177–187 still describes only a single opaque 16-bit raster and blanket
32-bit compatibility conversion. Current high-depth-psd.ts and passing tests
support bounded layered 16/32-bit sRGB stacks with separate supported masks.
This is stale documentation, not evidence that general Photoshop parity is ready.
Native eligibility still requires an opaque unmasked full-canvas bottom layer,
precision raster surfaces, normal single-pass blending, bounded allocations and
supported integer translations; complex descriptors/effects/resampling and
non-sRGB stacks are rejected. Bounds: 128 layers, 8 million pixels, 384 MiB
estimated writer working memory. These are admission limits, not measured RAM.

## Explicit roadmap (no unvalidated feature implementation)

| Order | Work | Evidence/acceptance | Decision |
|---|---|---|---|
| 1 | Repair adjustment alpha inflation | Existing CORE-LUMA-ADJUSTMENT-VARIANTS-001; retain failed samples, exact archive/render equality and independent OpenAI review | Reliability first; existing task owns work |
| 2 | Synchronize high-depth disclosure | Document supported layered 16/32-bit path, every admission restriction and explicit fallback warning; rerun the 51-test batch | Narrow documentation follow-up |
| 3 | External high-depth interoperability | Existing CORE-LUMA-AUD-002; rights-cleared independent PSD/PSB consumers and fixtures; compare sample depth, alpha, masks and reopen/export fidelity | Full golden still blocked |
| 4 | Broader blending/wide-gamut high-depth writing | Obtain authorized workflow examples, required spaces/depths and quantified tolerated loss before design; regression fixtures must precede implementation | Demand unknown; do not build yet |
| 5 | CMYK/Lab document editing and ICC device-link/multiprocess | Validate actual users/workflows, profiles, reference transforms and proof/output tolerances; distinguish Lab PCS support from Lab document editing | Unsupported/incomplete; no demand or fidelity signoff |

No new app, paid tooling, license decision or broad color implementation is
justified by this audit. Performance/UX quality and customer demand remain unknown.
Keep preflight warnings and native sample-refusal assertions unchanged.

## Models/cost/review

Deterministic test executor; current Codex director only. Runtime model identifier
is not exposed in this transcript, so no exact executed Sol/Luna attribution is
claimed. No Luna/Astra/reviewer calls or fallbacks invoked; no independent review
claimed. Telemetry preflight returned advisory continue/normal, all budget limits
null; this was not treated as authority for new model spending. Billed cost unknown.
This qualification changes no product code and requires no code-release review.
