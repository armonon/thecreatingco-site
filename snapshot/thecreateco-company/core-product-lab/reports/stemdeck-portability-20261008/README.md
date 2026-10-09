# StemDeck browser portability qualification — 2026-10-08

Task `CORE-STEM-AUD-008`; owner `core-lab-portability-20261008T1140`. Highest eligible P2 task selected severity-first by `lab.py next`; no other RUNNING StemDeck owner observed, no PAUSE present. Company recovery returned `[]`. One claimed 45-minute lease, renewed once. No duplicate tasks created.

## Outcome

**Useful desktop-engine qualification batch; task BLOCKED, not full mobile/browser qualification.** No product source edits, new product commit, push, merge, deployment or public/channel messaging. Existing reviewed/pushed b26c03b/PR35 state is historical, not a push by this run.

Isolated worktree `/Users/agentsattari/code/core-product-lab/stemdeck-portability-20261008`, branch `core-lab/stemdeck-portability-20261008`, source `b26c03be150e9ebb4dfcfa489bb57e62802011ec`. Final tracked/source status clean. Initial Chromium/Firefox receipts accurately show dirty status from an untracked dependency-directory symlink only; replaced with ignored directory of dependency links. `source-receipt.json` binds tracked file hashes, exact worktree/server command and unchanged matching lock SHA256. Dependency contents were reused, not reinstalled or represented as a clean install.

Synthetic 88,617,122-byte v6 archive contains 39 assets; SHA256 `a676f36efd9a9c79caed3016b8197521795b67f087ae92aa78ae177c771200ce`. Previously generated synthetic four-deck capture, not new capture in this run, physical input, rights-cleared music or human listening. Historical WebKit master oracle is 4,010,156 bytes, 668,352 frames, stereo 48kHz signed24bit PCM; SHA256 `92e5f3e0c73489567714b91e1829418bf46bd5df13e311ce8d0501463a6bfd8f`. Oracle provenance/source 6bad0ed is retained; it is a regression comparison, not an independent musical correctness claim.

## Measured results

| Check | Actual result |
| --- | --- |
| Four archive/storage test files, Node22.23.2 |40/40 tests PASS, exit0 |
| Vite production build |PASS, exit0; diagnostic wall time7.49s, not product performance |
| Prerender |PASS, exit0 |
| Service worker after prerender |PASS, exit0;132 files/6.3MB |
| Chromium151.0.7922.34,390px desktop viewport |39 asset SHA256 values, complete normalized arrangement/capture fields, UI rename/undo/redo, normal browser-process restart PASS; strict master WAV byte identity FAIL, exit1 |
| Firefox153.0,1440px desktop viewport |same39-asset/state/UI/restart subset and byte-identical master export PASS, exit0 |
| WebKit26.5,615px desktop viewport |same39-asset/state/UI/restart subset and byte-identical master export PASS, exit0 |
| Independent Python PCM comparison |Chromium5,005/1,336,704 samples differ by maximum1LSB =1.1920928955078125e-7; below existing2e-6 lifecycle tolerance. Firefox/WebKit0 difference. Strict Chromium byte failure remains separate, not waived |
| Separate OpenAI evidence audit |Harness scope reviewed; actual-results addendum independently reproduced PCM metrics; no full qualification claim |

App file picker, navigation, track rename, Undo/Redo and download controls were exercised against actual local Vite UI, with only `/api/inventory` mocked. No substituted audio implementation. Every archive asset's SHA256 was calculated independently from the input archive bytes, then compared with actual stored asset bytes after import and process restart. Arrangement and original capture-event state were normalized only by asset-content hashes; all unrelated arrangement fields remained identical. Rename changes metadata, not sound; this does not prove general DSP edit portability.

## Failures retained, not hidden

- First Chromium process ended exit137 after download, without final JSON or stderr. Cause unknown; saved WAV/screenshot, original harness and explicit initial receipt remain. A large Buffer deepEqual was replaced by boolean Buffer.equals solely to keep the same strict assertion bounded; no tolerance/threshold was relaxed. Rerun records the exact byte mismatch as exit1. Initial and final Chromium WAV SHA256 match.
- Initial service-worker invocation ran before prerender finished and failed exit1 at `Missing prerendered page studio.html`. This scheduling-confounded log is retained. Correct dependent order, after prerender exit0, passed exit0; this is not a reproduced source bug.
- Chromium output is not byte-identical to the WebKit oracle. Separate retained signed24bit PCM comparison measures the1LSB difference within the repository's unchanged existing audio tolerance; cause/browser DSP path remains unproven. No unsupported data-loss defect or duplicate follow-up was queued merely for this difference.

## Exact commands and evidence

Commands executed from isolated worktree unless noted. Runtime `/opt/homebrew/opt/node@22/bin/node`; macOS Darwin25.2.0 arm64. Exact command/exit receipts below; logs are sibling files.

- Startup from lab: `python3 ../engine/company.py recover`, `python3 lab.py next`:exit0. Requested policies/routing/AUTONOMY and parent company instructions read; PAUSE and active-product owner checks performed.
- `python3 ../engine/company.py claim --id CORE-STEM-AUD-008 --owner core-lab-portability-20261008T1140 --minutes 45`:exit0; exact lease token privately used for renewal/checkpoint, excluded from evidence prose.
- `git -C /Users/agentsattari/code/core-product-lab/stemdeck worktree add /Users/agentsattari/code/core-product-lab/stemdeck-portability-20261008 -b core-lab/stemdeck-portability-20261008 b26c03b`:exit0.
- `node node_modules/vite/bin/vite.js --config vite.qa.config.mjs --port 4308`:local source server; `server.log`, `source-receipt.json`. Owned server deliberately terminated with SIGTERM after checks; final server process exit143 is teardown, not a build failure.
- `node node_modules/vitest/vitest.mjs run src/utils/projectArchive.test.js src/utils/importArchiveAudioAssets.test.js src/utils/audioProjectStore.test.js src/utils/audioProjectStore.storage.test.js`:exit0; `unit.log`.
- `node node_modules/vite/bin/vite.js build`:exit0, `build.log`. `node scripts/prerender.mjs`:exit0, `prerender.log`. `node scripts/build-studio-sw.mjs`:initial exit1 `service-worker.log`; after prerequisite completed exit0 `service-worker-after-prerender.log`.
- `node <report>/qualify.mjs chromium`:initial exit137, `chromium-initial-receipt.json`/`chromium.log`; rerun exit1, `chromium.json`/`chromium-final.log`. `firefox`:exit0, `firefox.json`/`firefox.log`. `webkit`:exit0, `webkit.json`/`webkit.log`. Engine reports contain exact versions/timestamps/host/disk and scope.
- `python3 <report>/compare-pcm.py`:exit0, `pcm-comparison.json`/log. Initial supplemental Python result `chromium-pcm-oracle.json` retained. Reviewer independently reproduced signed24bit PCM result; `independent-review.md` contains limits and actual-results addendum.
- `git diff --check`:exit0; final git status clean. Test profiles created by this harness only were removed after their evidence had been retained. Initial abandoned profile cleanup and owned server teardown have separate receipts. No other worker profile/source was touched.

No mandatory release gate or full suite was redundantly rerun for unchanged source. Existing disk/hosted/stack gates remain unresolved; this batch neither satisfies nor bypasses them. Browser UI uses local source, not the built/packaged/deployed artifact. No product score or maturity promotion.

## Concrete resume condition

Reuse this task. Supply an authorized supported Safari/iOS/Android device/session with synthetic fixture transfer and sufficient disk headroom; record exact browser/OS/device, perform actual portable reopen, meaningful post-restart sound-changing edit and return archive re-export/re-import, compare full relevant session state and assets, and run separately scoped in-flight save/import/interruption recovery with last-good project preservation. Desktop work can extend full-state/return-transfer coverage in a future isolated batch, but cannot close the physical-platform gap. Continue exact-head hosted/stack/release gates separately; no personal signoff added and no deployment inferred.

Actual execution: parent `openai/gpt-6.1-sol` verified by live session status; separate native reviewer explicitly configured `gpt-6.1-sol`, with configured-model attribution documented because child status receipt unavailable. No model fallback, Claude or Luna invoked; this evidence-driven qualification used Sol directly, model proportions are not quotas. Two workers total. Unknowns remain unknown. No new queue items warranted; existing task and recovery/platform tasks cover the unresolved requirements.
