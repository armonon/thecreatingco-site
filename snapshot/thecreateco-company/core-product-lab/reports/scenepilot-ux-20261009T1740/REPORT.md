# CORE-SP-UX-001 bounded qualification — 2026-10-09

Status: BLOCKED; not a release qualification. Executor: inherited OpenAI Sol, not Luna. No reviewer/model fallback claimed; no additional premium model calls.

## Source and artifacts
- Baseline tested: 02c6eced0e572eafe5c5c2f8e4fe1b0e8b011b40, detached worktree `/Users/agentsattari/code/company-worktrees/scenepilot-ux-20261009T1740`.
- Lifecycle candidate differs from c26d518: c26d518 is not its ancestor; known Lite menu fix is absent. Reframe branch 08a6418 inspected but not combined.
- Timing-crossed local cherry-pick retained on `codex/scenepilot-ux-qualification-20261009T1740` at 8b6e91d. Worktree returned to baseline without reset. Integration UNTESTED/UNPUSHED; not qualified for push handoff. No merge/deploy.
- Read-only reused dependency directory: scenepilot-reframe-lifecycle-20261009/node_modules. Older golden dependency chain is broken. Electron performed its lazy binary download; exact staged FFmpeg binary missing. Environment/logs preserved.

## Measured results
- `node --experimental-strip-types --test tests/product-editions.test.mjs tests/media-browser-query.test.mjs tests/source-edit.test.mjs tests/project-store.test.mjs tests/sequence-readiness.test.mjs`: exit 0, 39/39 PASS; focused-tests.log.
- `npm run desktop:renderer`: exit 0; bundle warnings preserved in renderer-build.log.
- Adapted prior synthetic Lite harness `node .../lite-workflow.mjs`: FAIL, normal Add track > Video track click intercepted by inspector. No force clicks or relaxed assertions. Actual five-fixture import/source insertion/IndexedDB media-byte retention PASS before failure; lite/result.json and screenshot/hit-test diagnostics preserve evidence.
- `node scripts/certify-media-grid.mjs <five synthetic fixtures> <report>/desktop`: FAIL at late synthetic construction step because ffmpeg-static executable ENOENT. Four preceding checks PASS: five non-overlapping media cards+ordinary source insertion; native IPC 1s/30-frame H264 output+default Videos path; UI save disk JSON; fresh process/profile File-menu disk reopen and re-saved clip/settings/media identity. Native OS dialog selection harnessed, not manually verified. Final mixed-timeline UI export NOT reached.
- Lite disabled edition buttons Motion/Color/Audio/Deliver expose visible `Desktop Pro` badges and descriptive titles. Empty Render MP4/Apply/Reset colour/Drop disabled controls lack reason-specific titles; not material design-review qualified. Initial control inventory retained. No UX clarity score invented.
- Source-level media counts use assets.length/visibleAssets.length; main source is separate. Initial separate-source count harness incorrectly waited for a filename absent in Edit view; preserved failure. Corrected harness waits for actual loaded video frame, not filename. Corrected attempt also timed out (FAIL); actual Lite/Pro separate main-source count qualification remains UNKNOWN. No third attempt under retry cap; no product code changed to pass.

## Resume condition
Qualify correct reviewed candidate stack with existing c26d518 menu fix; run build, focused tests, exact unforced Lite golden and independent OpenAI stack review. Install/stage exact lockfile FFmpeg binary before rerunning desktop full mixed-timeline golden. Complete native dialog/manual packaging and full output review separately. Unknown remains unknown.

Reports only: no company queue/product/state mutations by this worker; parent owns task checkpoint. Synthetic fixture provenance comes from prior authorized golden-release18 manifest; fixture path hashes preserved in saved JSON and prior provenance copied below.
