# Luma high-depth disclosure repair — 2026-10-09

Task: CORE-LUMA-HIGH-DEPTH-DOC-001; owner core-lab-20261009T1540-doc.
Isolated worktree: /Users/agentsattari/code/company-worktrees/luma-high-depth-20261009T1540.
Baseline 8c15f8537c1176b7d4c0076182b7501c92f714b5; candidate 30bea20f862c4302887b79b89f364f2d7bdf5710.

## Completed scope
README-only update reconciled with app/engine/high-depth-psd.ts admission/writer and app/engine/psd.ts preflight. Discloses bounded layered16/32-bit sRGB PSD/PSB, editable full-document raster masks (8-bit source precision), opaque unmasked bottom layer, integer translations, all appearance/source/descriptors exclusions, 128-layer/8Mpixel/384MiB estimated admission limits, invalid sample refusal and explicit compatibility conversion warnings. No runtime changes or relaxed assertions.

## Measured evidence
Five-file qualification command and environment in receipt.json, full output tests.log: exit0, 51 passed, 0 failed/skipped. Synthetic engine dogfood covers layered import/export/reexport, masks/alpha/merged samples, project save/reopen, ICC retention, warning and refusal paths. Dependencies reused from same-SHA worktree, not clean install.
`git diff --check`: exit0. `git diff BASE HEAD --name-only`: README.md only. `git status --short`: empty. `git commit` and `git push -u origin docs/luma-high-depth-20261009T1540`: exit0. `git ls-remote` matches candidate SHA.
Draft https://github.com/armonon/luma-studio/pull/10 created exit0, stacked on PR9; pr-state.json preserves remote state.

## Release blocker / limitations
All three hosted CI jobs failed before execution. ci-jobs.json and ci-annotations.json preserve exact evidence: account payments failed or spending limit needs increase. No retries, billing changes, merge, deployment or gate bypass. Resume release qualification after billing/access repaired and exact-head checks pass, plus independent/downstack reviews and all repository release gates.
No new build: README-only candidate has identical runtime/tree inputs to baseline with historical dated Vinext/typecheck receipts at reports/luma-adjustment-20261009T0940; not a new build claim. Full UI/native/external Photoshop/golden workflow unqualified; existing6/15 alpha failures remain. No UX redesign or consequential runtime audit required, no independent review claimed.

## Models/cost
Current Codex director executed deterministic tools. Exact runtime model identifier unavailable; do not infer it from desired routing. No additional Luna/Astra/reviewer model requests or fallbacks. Preflight advisory normal/continue with null budget limits; not spending approval. Billed cost unknown. Narrow documentation does not justify an invention call or extra review spending.
