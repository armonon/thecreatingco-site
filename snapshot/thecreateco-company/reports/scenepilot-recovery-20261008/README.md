# ScenePilot recovery checkpoint — 2026-10-07 Pacific / 2026-10-08 UTC

Observed: 2026-10-08T06:21:05.981721+00:00. Task CORE-SP-RECOVERY-001, owner director-20261008T0610-recovery. One bounded company-director task, selected by severity-first lab next. No PAUSE. Recover returned no expired leases; state refreshed before selection. Named18 firstwave protected; current flagship P1 recovery gap took precedence per CI-outage directive. No other worker checkout changed.

## Result and source

Confirmed metadata-loss defect: after source media was moved, actual UI Open → Save preserved the edit but removed the offline asset sourcePath. A stronger baseline roundtrip also proved custom folder/favorite/beatMap loss. Narrow repair retains these descriptors while keeping the missing asset offline; live relink retains its authored beat map.

Baseline a47417bc4b3390bc30697cc2b7d3d573ad14e4d6; isolated branch codex/scenepilot-recovery-20261008. Tested/reviewed/pushed candidate c7d2b4fc973861eba785f26e5f607671ac22deb4; [PR94](https://github.com/armonon/scenepilot-studio-badass/pull/94) OPEN on PR93 workflow branch. Remote head separately verified. No merge, deployment, source rollback or required-check bypass. PR94 had no reported status contexts at observation; this is not CI success. Downstack remains gated.

## Actual commands and observations

Run root /Users/agentsattari/thecreateco-company. CLI: python3 engine/company.py recover; refresh; python3 core-product-lab/lab.py next; claim --owner director-20261008T0610-recovery --id CORE-SP-RECOVERY-001 --minutes35; heartbeat with preserved owner/token; product update and finish through CLI. Token deliberately omitted from report.

Product commands run in /Users/agentsattari/code/company-worktrees/scenepilot-recovery-20261008:

- git worktree add -b codex/scenepilot-recovery-20261008 ... a47417b. Dependencies shared read-only through node_modules symlink. Initial baseline renderer linked read-only to previous exact-build candidate; fixed renderer link removed and rebuilt in owned tree.
- Node26 focused21tests initially PASS; repeated under intended /opt/homebrew/opt/node@22/bin/node:21/21PASS (baseline-node22.log).
- node scripts/certify-disk-pressure.mjs: actual ENOSPC dedicated32MBHFS+ image, previous bytes preserved, retry after removing isolated filler PASS (disk-pressure.log). Never filled the host volume; host had approximately1GiB free at initial observation.
- Node22 baseline-regression.mjs against original exact source: EXPECTEDFAIL1/2; fixed new regression2/2PASS. Valid beatMap fixture retained. Logs regression-exact-baseline.log/regression-after.log.
- PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run check: types/lint PASS (check.log).
- npm run test:quick initially1094PASS1FAIL because new worktree lacked generated dist/server/index.js. Not a product regression. Correct canonical npm test performs productionbuild first:1095/1095PASS (full-test-build.log).
- npm run desktop:renderer PASS, existing chunk/dynamicimport warnings retained (build.log). source-build-receipt.json binds final committed source and generated renderer hashes; tested content unchanged by commit.
- node reports/scenepilot-recovery-20261008/recovery-session.mjs from company root: final exact-head6/6PASS, zero pageerrors, tracked tree clean; actual file renderer URL captured (result.json/exact-head-session.log). UI added-track edit, real12sautosave, SIGKILL, same-profile new-process recovery, full serialized identity comparison; movedmedia offline save and import/relink; favorite/nonemptybeatMap preserved; actual chmod permission-denied reports failure/preserves old file/retry succeeds. All files/profiles owned synthetic copies; no original media moved.
- git diff --check PASS; git add only3scopedfiles; git commit; git push -u origin featurebranch; gh pr create --base codex/scenepilot-workflow-release18 --body-file pr-body.md; gh pr view and git ls-remote confirm exact candidate/OPEN. No workflow billing retries.

Initial locator setup attempts and an order-sensitive asset assertion were retained separately. Asset comparisons now key-sort by id and compare all serialized fields except savedAt with only explicit addedtrack/movedpath/copiedfile timestamp deltas. Baseline metadata failure is retained in baseline-metadata-result.json; it is distinct from harness selector failures. Independent review corrections fixed stale save-status synchronization, circular journal comparison and ignored pageerrors.

## Independent review / models

Director actual OpenClaw session_status: openai/gpt-6.1-sol via OpenAI Codex; no fallback used. Separate bounded reviewer requested gpt-6.1-sol, executed OpenAI Codex, approved narrow3filefix (fix-review.md); exact serving model ID not independently exposed to that child, so route selection is recorded rather than fabricated serving proof. No Claude/Sonnet/Opus review or fallback. No Luna volume work needed for this narrow dependent engineering task. GitHub skill used for PR operations.

## Limitations and next action

This proves development Electron recovery after a completed autosave, not kill-during-write/machinepowerloss. OS chooser selections harnessed, not interactively qualified. ENOSPC is actual atomichelper coverage, not UI/journal full-disk coverage. Signed packaged artifact/cleaninstall, missing-mainAsset semantics, full golden/export/perceptual/browser/nativeplatform/hardware and mandatory hosted/downstack gates remain UNVERIFIED. No health/revenue/users/quality score invented. Earlier export evidence kept dated and candidate-specific.

Finish NEEDS_REVIEW as a resumable qualification checkpoint, NOT task/product/release COMPLETE and NOT a request for Armon personal signoff. Next cycle reviews this checkpoint then requeues remaining bounded packaged/nativechooser/missing-main-source/UI-ENOSPC/kill-during-write work when its prerequisites are available. Mandatory checks and reviewed stack required before any landing/release. Product evidence and release matrix refreshed through established CLI.

Final independent addendum verified candidate/clean tracked tree, all132source/renderer hashes,6UIchecks and1095test log. Permission denial was real via owned directory chmod; numeric errno was not separately asserted. Narrow review approval stands.
