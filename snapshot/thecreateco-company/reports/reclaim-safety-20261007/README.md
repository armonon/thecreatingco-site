# Reclaim safety qualification — 2026-10-07

P05 running, owner reclaim-safety-20261007. Source baseline ac2ea52 (fresh origin/main; identical tree to prior54d2c34 wave4). Isolated checkout /Users/agentsattari/code/company-worktrees/reclaim-safety-release18; no release/deployment changed.

## Discovery

- Browser edition is read-only SHA256 file review, not native quarantine/deletion.
- Native duplicate finder uses size and sampled first/last64KiB while UI calls results copies and preselects all but one. Middle-content collision and overlapping-root/hardlink regressions being executed against baseline.
- Existing quarantine uses private durable manifest before moves, atomic no-overwrite macOS rename, cross-volume fallback, occupied-destination and traversal checks. Further interruption/restore/symlink/race qualification in progress, not passed.
- Baseline TypeScript tests76/76 PASS. Rust toolchain absent locally; installed isolated official minimal Rust1.99.0 under /Users/agentsattari/code/toolchains/reclaim-rust without changing shell/user configuration. Native compilation in progress.

Only generated disposable fixtures will be scanned/moved; no physical input, no real user-data changes. Native UI/clean-machine/Intel/macOS13 qualification remain unverified.

## Milestone — tested local safety candidate

- Baseline duplicate tests failed: differing middle incorrectly grouped and overlapping roots/hardlinks counted as reclaimable copies (`duplicate-before.log`). Full streamed SHA256 plus Mac extended-attribute/resource-fork verification, inode dedup, no-follow opens and identity/timestamp checks resolve them. UI keeps one per group, blocks stale-selection cleanup during scanning and reports actual partial outcomes.
- Cross-volume baseline lost real extended attributes (`resource-fork-before.log`). macOS descriptor-based data+metadata copy preserves resource forks/annotations. Parent review identified source mutation/replacement risk; deterministic real-file separate-thread regression now verifies fail-closed preservation before publication. Source identity/content metadata checked again before unlink; final hostile-writer check-to-unlink race remains explicitly unqualified.
- Native full suite58 PASS /3 ignored: existing live user-folder smoke intentionally not run; subprocess helper invoked only inside recovery test; owned-volume test separately invoked and PASSED. `native-final.log`.
- Actual SIGKILL interrupted a5000-file batch, separate process restored every byte; `process-recovery.log` and full-suite recovery output. Same-name files live in distinct folders; no mocked I/O or user files.
- Actual separate32MiB HFS+ image:8MiB cross-volume roundtrip including resource fork; actual ENOSPC during partial-copy attempt; source8MiB remained exact. `real-disk-pressure-final.log`. No host-volume fill.
- TypeScript77/77, typecheck and build PASS; `ts-final.log`, `types-final.log`, `build-final.log`.
- Actual browser read-only selection/fullSHA256/report download passes Chromium151.0.7922.34, Firefox153.0, WebKit26.5; reports/screenshots included. First attempt waited on unrelated external network assets and timed out; preserved `browser-first-network-timeout.json`. Final isolated local test blocked unrelated remote assets and compared real selected fixture data. Not native GUI or actual Safari/iOS certification.
- README updated from stale operator scaffold to current Reclaim reality; `docs/RECLAIM_SAFETY.md` describes limits and commands.

Independent parent OpenAI review in progress; not committed, pushed, merged, packaged or deployed yet. Native Tauri UI, source-to-signed-artifact reconciliation, clean machine/physicalIntel/macOS13, full performance/accessibility and hostile filesystem races remain UNVERIFIED.

## Reviewed publication checkpoint — 2026-10-08T02:59:05.816097+00:00

Candidate `c46f9811c7fd34a00625541178d1f1e0d2b2456b`, clean tree; all five exact-head commands passed with timestamp, host, versions and exit codes in `exact-head.json`. Native58 passed/3 ignored with separately invoked owned-volume testPASS; TS77 passed/typecheck/buildPASS. Actual disposable disk image was detached successfully after qualification.

Independent OpenAI review completed, receipt `independent-review.md`. Pushed normal branch PR2: https://github.com/armonon/universal-operator-batch-kit/pull/2 — OPEN, no reported PR checks, not merged/deployed/packaged. No absent mandatory check is treated as passing. Full P05 native UI/platform/hostile-race qualification remains blocked/unverified; resume exact candidate, not older public binary.
