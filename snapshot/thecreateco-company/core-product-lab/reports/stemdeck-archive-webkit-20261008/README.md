# StemDeck WebKit archive cycle — 2026-10-08 UTC / October 7 Pacific

Task CORE-STEM-ARCHIVE-WEBKIT-001. Owner core-lab-webkit-20261008T0540. One bounded cycle, unique45-minute company lease, no competing StemDeck RUNNING task observed at selection. Neither PAUSE existed. Selected highest eligible severity P0; no duplicate task created.

## Outcome

**Scoped repair independently reviewed, committed and pushed; PR34 OPEN, not merged/deployed. Task BLOCKED at mandatory exact-source qualification disk preflight.**

Source `6bad0edaf198d80d44c9aa02c3e65970fe7d9148`, branch `core-lab/stemdeck-archive-webkit-20261008`, isolated worktree `/Users/agentsattari/code/core-product-lab/stemdeck-archive-webkit`. PR https://github.com/armonon/sattari-custom-site/pull/34 is stacked on PR33/af10e31 and includes prerequisite c15bb06. Separate independent Sol audits approve both the scoped change and c15 prerequisite; normal downstack/mandatory checks remain gates. GitHub receipt shows exact remote head, OPEN, mergedAt null, no status checks yet observed. No retry of billing-blocked workflows, merge, deployment, public/channel send, physical recording, customer data or release bypass occurred.

## Diagnosis and repair

Same original synthetic88,146,200-byte39-asset portable archive reproduced an atomic WebKit26.5 IndexedDB abort, `UnknownError: Error preparing Blob/File data to be stored in object store`, with3,587,084,288 bytes OS free at its baseline. Chromium baseline passes all39 assets/restart. Byte-materialized WebKit diagnostic and1MiB disk-detached diagnostic each pass every asset hash and full-process restart; materialization is diagnostic only, not the implementation. Existing4KiB/2.8MiB/two-asset passing counterexamples remain historical and unwaived. These results localize a failing persistence boundary but do not prove every Safari device/version or a universal slice threshold.

The v6 UI importer now copies verified archive-backed slices into independent temporary files with1MiB exact-length reads, preserves one atomic IndexedDB batch write and verifies every stored tree hash before session replacement. Aggregate memory fallback is32MiB across the import; larger imports fail closed when temporary disk is absent/refused. Invalid hash/dedupe read lengths fail rather than hiding backing corruption. Post-storage failure deletes only fresh generated IDs, never reused assets. Cleanup attempts every owned file sequentially, logs non-NotFound failures and never masks the import result. Unremoved temporary files can remain discoverable; success does not guarantee cleanup if the OS refuses deletion. No whole-song/whole-archive allocation is used by the disk-backed candidate.

## Measured checks

| Check | Actual outcome |
| --- | --- |
| Node22.23.2 full unit suite |2259 tests/248 files PASS, exit0,52.63s diagnostic wall time |
| Focused first batch |49 tests/5 files PASS, exit0; full suite includes later cleanup regressions |
| ESLint/typecheck |each exit0 |
| Vite production build/prerender/service worker |each exit0; service-worker132 files,6.3MB precached |
| Stable-source WebKit26.5 actual UI |PASS: four generated decks/analyzer,12s capture/events, arrange, real edit Undo/Redo, live replay print0 late controls, normal process close/reopen, actual master/stems downloads |
| Actual UI fresh-profile portable restore |39 referenced asset hashes + normalized arrangement/original events PASS;668352 frames48kHz stereo master PCM maximum error0 |
| Exact6bad postcommit restored-profile process restart |all39 hashes/original semantic state PASS;4,010,156-byte downloaded WAV byte-identical to original master |
| Exact6bad Chromium151 candidate |all39 full SHA256/tree hashes and browser process restart PASS |
| WebKit importer fault injections |6/6 PASS: denied storage, quota, immediate and late transaction abort, wrong stored bytes, reused-asset preservation including independent before/after tree hashes |
| Separate OpenAI source review |APPROVE scoped fix; all7 reviewed file hashes match committed source |
| Separate OpenAI prerequisite review |APPROVE c15bb06; independently reran8 cycle-precheck tests |
| Mandatory exact clean6bad gate |exit1, disk preflight FAIL;1,203,224,576 bytes available,2,838,683,648 required; results[]; no software/audio/built-artifact gates ran |

Importer-failure cases exercise real WebKit storage with synthetic fault injection and a preserved prior-session sentinel. They prove pre-session-replacement failure containment, not rollback after a later applySession/engine failure. Full UI is local Vite, not the deployed/packaged product. Only `/api/inventory` mocked; no substituted audio engine or physical inputs. Reports identify precommit c15 plus dirty candidate; `source-artifact-receipt.json` and independent7-file review manifest bind that tested candidate to exact committed6bad. Postcommit restart/Chromium reports and mandatory preflight identify6bad directly. Native WebKit MediaRecorder decode failure/13-of14 reference tests is retained historical evidence from c15, not rerun or waived here. Real Safari/iOS/Android, human listening, long-duration/hardware, clean installation, source/live and whole-product readiness remain unqualified. Quality scores remain unknown.

## Exact commands and receipts

From isolated worktree unless stated. Node22 executable: `/opt/homebrew/opt/node@22/bin/node`. All artifacts under this report directory unless absolute paths shown.

- Startup `python3 company.py recover` from engine:exit0/recovered[]; `python3 lab.py next` from lab:exit0/selected exactP0. Read all requested policy/state/routing files, AUTONOMY and CI_OUTAGE_POLICY; absent PAUSE confirmed.
- `python3 engine/company.py claim --id CORE-STEM-ARCHIVE-WEBKIT-001 --owner core-lab-webkit-20261008T0540 --minutes 45` from company:exit0. CLI heartbeat:exit0. Lease token used privately, omitted from report.
- `git worktree add -b core-lab/stemdeck-archive-webkit-20261008 /Users/agentsattari/code/core-product-lab/stemdeck-archive-webkit c15bb06`:exit0.
- `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4298 --strictPort`:localhost source server. Fault-only source server4299; its HMR socket5173 reported occupied, HTTP4299 remained usable, no source changed during final runs.
- `node probe.mjs webkit baseline|disk|materialized`:baseline exit1, disk/materialized exit0. `node probe.mjs chromium baseline`:exit0. First candidate with parallel cleanup exit1/NotFoundError; retained original log. Sequential candidate:exit0/all39. Exact6bad `node probe.mjs chromium candidate`:exit0.
- Node22 `node_modules/vitest/vitest.mjs run [five scoped test paths]`:exit0, unit-scoped.log. Node22 `node_modules/vitest/vitest.mjs run`:exit0, unit-full.log. Node22 ESLint `.`, TypeScript `--noEmit`, Vite `build`, `scripts/prerender.mjs`, `scripts/build-studio-sw.mjs`:all exit0; respective logs retained.
- `node /Users/agentsattari/thecreateco-company/reports/stemdeck-webkit-reference-20261007/webkit-ui-qa.mjs http://127.0.0.1:4298 <report>/candidate-ui`:exit1/capture-ready timeout while source was changing. Confounded trial retained, not waived or asserted caused by HMR. Equivalent stable-source `candidate-ui-final`:exit0/PASS. `node portable-restart.mjs`:exit0/exact6bad.
- `node faults.mjs`:initial exit1 because the harness queried temporarily denied getDirectory; next exit1 because shared4298 origin existing UI export files were misclassified as owned leftovers. Both reports preserved. Separate4299 origin/baseline-and-after owned-file checks:exit0/six casesPASS. Final independent reused-byte-hash version:exit0/six casesPASS. Assertions remain strict; existing files were not deleted to manufacture pass.
- `git diff --check`:exit0. `git commit -m "fix(stemdeck): detach and verify portable archive audio before restore"`:exit0/6bad. Exact review/file-hash receipt asserts clean tree and all7 files match.
- `STUDIO_GATE_OUTPUT=<report>/exact-gate <node22> scripts/studio-release-gate.mjs`:exit1 at real unchanged disk reservation. No reserve/threshold/guard reduction and no redundant retry.
- `git push -u origin core-lab/stemdeck-archive-webkit-20261008`:exit0. `gh pr create --repo armonon/sattari-custom-site --base core-lab/stemdeck-lifecycle-20261007 --head core-lab/stemdeck-archive-webkit-20261008 --title "fix(stemdeck): preserve WebKit portable archive audio bytes" --body-file <report>/pr-body.md`:exit0/PR34. `gh pr view 34 ... --json ...`:exit0/exactheadOPEN/no checks observed.
- Scoped teardown removed only completed disposable browser profiles named in this cycle's JSON receipts; source, archives, WAVs, original event/session snapshots and logs remain. Initial and final cleanup receipts retained. Dependencies linked inside ignored node_modules directory, no package contents changed.

## Concrete resume condition

Reuse this task, not a duplicate. Free or provide an authorized volume with at least2,838,683,648 bytes available, then rerun unchanged exact6bad mandatory gate (including audio/browser/120-second soak) and verify exact-head hosted/stack gates. Reconcile source identity if head changes; rerun relevant evidence and independent review for substantive changes. Keep PR34 open/unmerged until required checks/reviews pass. Native reference decoder and full platform/physical qualification remain separate recorded gaps. No personal Armon signoff is added as a routine gate.

Actual execution: OpenAI GPT-6.1 Sol parent and two independent native reviewers, confirmed by live session status; no fallbacks, no Claude, no Luna invocation for this consequential persistence repair. Model mix is guidance, not a fabricated quota. GitHub skill used for PR creation/read-only verification. No business/health metrics invented.
