# Form shared-workspace handoff audit — 2026-10-08

Task: CORE-FORM-AUD-WF-002. Run owner: director-20261008T1210-form-handoff.
Outcome: **BLOCKED for full qualification; scoped browser/native-source audit retained.**
No product-completion, native-recovery, stable-release, merge or deployment claim.

## Selection / scope / routing

No PAUSE; recovery returned no expired leases. `core-product-lab/lab.py next` selected this eligible P2 flagship task. No other running company product lease was listed at selection. Golden-workflow work precedes unrelated app experiments; first-wave/excluded-app scope and other product holds unchanged.

Read company AGENTS/DIRECTIVE/engine README/state/AUTONOMY/model routing, Core Lab directive/health, named18 directive/manifest, CI outage and revenue amendments. Matrix is at company-root `RELEASE_MATRIX.md`, not `release-program/RELEASE_MATRIX.md`; corrected the initial nonexistent-path read. Queue description referenced older separate-schema semantics; inspected actual current source instead.

Actual director: openai/gpt-6.1-sol (session_status); separate native Luna source audit and separate GPT-6.1 Sol documentation review. No fallback used; no Claude review invoked. Routing and review findings: [independent-audits.md](independent-audits.md).

Isolated worktree: `/Users/agentsattari/code/worktrees/form-handoff-20261008T1210`.
Baseline: be1f7272c5689d6401194d643fa3eb09a2b0b73b, reviewed PR7 source.
Final: **779d61d324a6f5f8a6813b51735d4495dbfabc08**, clean branch `qa/form-handoff-20261008T1210`.
Only repository change: `app/PARKED.md`, correcting editor/desktop routing, shared container/save/history semantics, explicit snapshot handoff and distinct recovery channels. No functional code/schema changes. Other worktrees untouched; read-only dependency symlink reused exact-parent node_modules.

## Commands and results

Executed from company workspace unless checkout specified; lease-token values omitted from report.

- `python3 engine/company.py recover`, `refresh`; `python3 core-product-lab/lab.py next` — exit0; task selected then `claim --id CORE-FORM-AUD-WF-002 --owner director-20261008T1210-form-handoff --minutes 35`. Heartbeat used exact returned token.
- `df -h /Users/agentsattari` — initially557MiB free /100% capacity; isolated source checkout succeeded. No deletion/cleanup of others' artifacts.
- `git worktree add -b qa/form-handoff-20261008T1210 /Users/agentsattari/code/worktrees/form-handoff-20261008T1210 be1f7272c5689d6401194d643fa3eb09a2b0b73b` — exit0.
- In checkout, `ln -s /Users/agentsattari/code/worktrees/form-runtime-security-20261008T0340/node_modules node_modules` — exit0; no installation or lock changes.
- `/opt/homebrew/opt/node@22/bin/node --experimental-strip-types --test --test-concurrency=1 tests/project-format.test.mjs tests/project-history.test.mjs tests/project-save-session.test.mjs tests/animation-workflow.test.mjs tests/animation-studio.test.mjs tests/animation-ui.test.mjs` — **42/42 PASS**, baseline and final doc commit; [final-unit.log](final-unit.log).
- `env PATH=/opt/homebrew/opt/node@22/bin:$PATH node --experimental-strip-types --test --test-name-pattern='CAD and Fabric persist|CAD hydrates|Rig handoff|Fabric quota|Fabric hands' tests/workspace-smoke.test.mjs` — **4/4 PASS**, baseline/final; [final-integration.log](final-integration.log). jsdom stubs/native mocks are explicitly not browser/native qualification.
- `env PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run desktop:web:build` — exit0 at baseline and final commit; [final-desktop-build.log](final-desktop-build.log). Existing dynamic-import/chunk-size warnings retained. Node22.23.2; **28 built files** hashed with clean final source in [final-artifact-manifest.json](final-artifact-manifest.json).
- `python3 -m http.server 1449 --bind 127.0.0.1 --directory desktop-dist` in checkout — served built frontend on loopback; stopped after checks.
- `env PATH=/opt/homebrew/opt/node@22/bin:$PATH FORM_AUDIT_SHA=779d61d324a6f5f8a6813b51735d4495dbfabc08 node reports/form-handoff-20261008T1210/handoff-workflow.cjs` — exit0; **12/12 assertions, zero uncaught pageerrors**, [browser-workflow.log](browser-workflow.log), [browser-result.json](browser-result.json). Full browser process close/fresh relaunch, not just component or tab remount. Harness SHA256 e0c06f70a018cc9404a10c50420fa2be6bd12076dfb83e2237535f5e66d5cac1.
- In checkout, `env PATH=/opt/homebrew/opt/node@22/bin:$PATH node scripts/preflight-macos-distribution.mjs` — exit0 means receipt generated, **NOT qualification passed**; distributionPreflightPassed=false/publicDistributionReady=false. [native-preflight.json](native-preflight.json).
- `git diff --check`, `git status --short` — clean/no whitespace issues. Independent Sol review required correcting `app/page.tsx` to actual editor `app/studio/page.tsx`; final diff approved.
- `git add app/PARKED.md`; `git commit -m "docs: clarify shared Form workspace handoff and recovery boundaries"`; `git push -u origin qa/form-handoff-20261008T1210` — exit0. `git ls-remote origin refs/heads/qa/form-handoff-20261008T1210` matched final SHA.
- `gh pr create --repo armonon/form-studio --base qa/form-runtime-security-20261008T0340 --head qa/form-handoff-20261008T1210 --title "docs: clarify shared Form workspace handoff and recovery boundaries" --body-file reports/form-handoff-20261008T1210/pr-body.md` — [PR8 OPEN](https://github.com/armonon/form-studio/pull/8), on PR7 on PR5; prerequisites not merged.
- `gh pr view 8 --repo armonon/form-studio --json url,state,headRefOid,headRefName,baseRefName,statusCheckRollup`; `gh run view 37776195545 --repo armonon/form-studio` — mandatory web/native-macos FAILURE, desktop-artifact SKIPPED. Annotation: account payment failure or spending limit prevented job start. [pr8-observation.json](pr8-observation.json), [hosted-run.txt](hosted-run.txt). **No retry, billing/account change, gate bypass, merge or deployment.**

## Actual browser coverage

macOSarm64, bundled Chromium153.0.8010.12, SwiftShader software WebGL, actual built React UI and workers. Synthetic default CAD sample plus original SVG20mm rectangle extruded through UI; Fabric T-shirt template; Animation cube with authored transform key.

1. Nonempty SVG/extrude CAD source; Fabric edit and Back preserve CAD.
2. Direct Animation navigation opens same project without copying CAD into scene.
3. Actual Create Cube/Record position, Back to CAD preserve identity, all authored CAD/Fabric/scene fields and unsaved state.
4. Shared history traverses Animation key from CAD; CAD/Fabric authored data unchanged. **Two Undo steps** were observed before the last key was removed, then two Redos restored it. Retained [history-traversal.json](history-traversal.json); no silent claim of a one-click boundary.
5. CAD brass edit Undo/Redo keeps authored Animation/Fabric.
6. Actual Save download includes all three workspace payloads; full browser exit/fresh context/reopen preserves CAD fields, Fabric authored data and scene cube/keyframe. Old undo journal correctly resets on file Open.
7. Reopened file hydrates real Animation scene/keyframe and Fabric UI then returns without authored loss. Zero uncaught errors.

Fabric's top-level inner `updatedAt` changes during hydration/save; comparisons exclude **only that save-time field**, not pattern/body/seam/material data. Raw expected/reopened documents and saved [handoff.form](handoff.form) retained with SHA256 in browser-result. Wrapper timestamps/checksum/revision metadata are not asserted immutable.

## Attempt history / limitations

Installed Chrome154 could not reach loopback (timeouts despite curl HTTP200); bundled Chromium used, clearly a different tested browser. Early exploration used wrong accessible Model name (`2 Model`), missing animation-panel reopening after Create, and an incorrect one-body assumption (default sample retained). Early harness compared Fabric save-time timestamp literally, then assumed one Undo step. Logs/JSON retained as explore-*, browser-first/second/third-attempt.*, browser-parent-source.*; these resolved harness assumptions are not asserted as product data-loss bugs. Final 12 checks passed on exact final source/build.

Observed extra navigation history checkpoint is a real repeatable UX observation; Fabric timestamp participation in the shared fingerprint is a source-level hypothesis for its cause, not a confirmed root cause/fix. Follow-up should preserve authored-edit ordering and not indiscriminately strip meaningful fields.

**BLOCKER:** Exact supported native app/DMG unavailable in this isolated checkout; Developer ID certificate/release identity/notarization credentials absent per fresh preflight. Full native close/reopen, crash recovery between separately keyed cad/rig channels, dirty close/save/cancel, physical graphics/device and clean install/update unverified. Hosted required CI billing-blocked. No attempt to change credentials, account, signing or release authority.

Explicit linked/independent model transfers, Fabric character→Animation baked cloth/rig assets, large/corrupt/interrupted projects, other browsers/platforms, production/source identity and full golden workflow remain unqualified. Focused46 tests + twelve browser assertions do not replace full unit/native/release gates or prior dated source evidence. Quality scores/business metrics unchanged/unknown.

## Durable queue / portfolio updates

`python3 engine/company.py update-products --file reports/form-handoff-20261008T1210/product-patch.json` updated Form exact-candidate observations to779d61d, keeping all full-release gates UNVERIFIED/BLOCKED and preserving prior source/date observations. No quality/business metric changed.

`python3 engine/company.py enqueue --file reports/form-handoff-20261008T1210/history-followup.json` queued CORE-FORM-HANDOFF-HISTORY-001: bounded investigation of the reproduced extra navigation checkpoint, not a claimed fix or new app. Parent qualification stays BLOCKED pending native/recovery coverage; one audit/docs checkpoint is not product completion.

Final queue finish uses owner/token, status BLOCKED, this evidence path and explicit native/access/hosted reasons; company/lab/release/revenue views refreshed afterward.

## Next action

Keep reviewed docs PR8 open through normal exact-head/prerequisite gates. Independently investigate the extra navigation-only history checkpoint with an authored-vs-metadata fixture; retain current safe semantics. Resume actual supported-native CAD→Fabric→Animation→CAD save/reopen/recovery and explicit mesh/garment asset variants when exact app/signing/release access is available. Do not duplicate billing retries or call this task/product complete.
