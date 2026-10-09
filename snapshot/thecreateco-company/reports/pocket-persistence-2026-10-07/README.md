# Pocket data-preservation repair — 2026-10-07 Pacific

## Result / identity

**Reviewed, committed and pushed — not merged/deployed; product NOT complete.** [PR30](https://github.com/armonon/sattari-custom-site/pull/30), exact head `4bd196d65c7fd56f5de038179978e3eae47ab6b7`, OPEN onto `core-lab/stemdeck-security-20261007` at1569ef3 (existing OPEN PR28). It is not an independently releasable replacement for the earlier stack. PR30 check rollup is currently empty; no remote checks reported, not attributed to billing without evidence. Normal required checks/stack qualification remain.

Worktree `/Users/agentsattari/code/company-worktrees/pocket-persistence-20261007`, branch `fix/pocket-persistence-20261007`; source tree clean and remote SHA verified. Own task PROGRAM18-POCKET-SAVE-001. Audit worker independently queued duplicate PROGRAM18-POCKET-PERSIST-001; parked WAITING with pointer to the owned repair, no second implementation. Pocket is the beat sketchpad at `/studio/pocket`, **not Pocket Studio**, which remains blocked by missing Community source. No Key & BPM or excluded module changed; six scoped source/test/harness/docs files only.

## Defects, repair and review

Initial independent audit reproduced actual helpers silently dropping the oldest saved beat on41st save, and treating malformed JSON as an empty library then overwriting original bytes. Source/repro: ../release18-inventory-gaps-20261007/pocket-memory-repro.mjs and pocket-memory-repro.json, originalwave4 sourcea9a77e6; identical offending helpers in reviewed securitybase1569ef3.

Repair refuses41stnewname without eviction; explicit same-name updates still work. All write/delete paths read stored data strictly; invalid JSON, wrong collection shape, unsupported version, duplicate/empty/overlong names or semantically malformed musical fields cause a visible failure without replacing bytes. Exact16drum/bassstepcounts/types, full mixer/mute data and bounded musicalparameters are validated. Legacy missingversion is supported only with completev1shape. Untouched and additional datafields are preserved, including same-name/draft updates. Existing overcapacity libraries are never silently truncated.

Draft autosave likewise leaves corrupt/newer data untouched and surfaces failure. UI mount/save/delete errors retain current edits. **Download stored-data recovery backup** saves exact original library/draft strings, no destructive reset; UI/docs explicitly say it is a raw recovery archive, not editable-pattern import. WAV/stems back up rendered audio only, not sequencer state.

Independent OpenAI parent review found an initial incomplete semantic guard (name/version alone allowed corruptdrums to normalize away); fixed before committing, with six new semantic-corruption cases, strict-shape/legacy tests and real-browser raw-backup verification. Second review found no remaining blocking code findings. No Claude review.

## Verification

Local macOS arm64, Node22.23.2. No physical inputs, private media, account changes, production-data deletion, spending or deployment. Full/focused logs in this directory.

- `npm ci`:exit0;538audited packages,0vulnerabilities reported by install. This is install audit output, not independent deployed exploitability qualification.
- `npx vitest run src/labs/pocket/PocketPage.test.jsx src/labs/pocket/pocketPattern.test.js src/labs/LabPages.test.jsx`:38pass across3files.
- `npm test`:246files/2255tests PASS,0failed. Tests logged warning/error output for existing deliberately exercised conditions; processexit0 and summary pass.
- `npm run type-check`:exit0.
- `npx eslint src/labs/pocket scripts/pocket-persistence-check.mjs --max-warnings 0`:exit0; scopedlint only, not a claim the entire pre-existing site lint is clean.
- `npm run build`:exit0;81canonical prerenders, actual studio serviceworker generated. Dist artifact not committed or deployed.
- `git diff --check`:exit0; final reviewed committed tree clean.
- Unit quota/read/write failures are **fault injection**, not physical quota exhaustion. Actual browser preservation checks below use real localStorage.

## Actual built-browser evidence

`npm run preview -- --host 127.0.0.1 --port4188 --strictPort` served built candidate. `scripts/pocket-persistence-check.mjs` used own fresh persistent Chromium153.0.8010.12 profile, real controls/storage/WebAudio/downloads and synthetic patterns. Exact-head receipt **browser-exact-head/report.json** pins4bd196d plus actual source/harnessSHA256. Five checks PASS with0pageerrors:

1. Edited/saved beat, actually closed page, opened newpage, loaded namedbeat; editable step and complete storedpattern preserved.
2. Actual WebAudio playback/playhead, user WAV download; independent RIFF parser verifies stereo24-bitPCM/44100Hz,115043frames,2.608684807s (onebar at92BPM), non-silent sampledata.
3. Fortyexisting namedpatterns seeded in owned localStorage;41strefused and all original storedbytes identical. Explicit same-name update works atcapacity.
4. Syntaxcorrupt library/draft bytes remain byteidentical after actual Save/autosave; currentedit staysavailable.
5. Semantically corrupted drum/bass data preserved; actual recovery-backup download contains exactraw originalstrings.

At390px no horizontal overflow; phone-errors.png visually inspected. This is not complete accessibility, keyboard/assistive-tech, physicalphone, Firefox/Safari or performance qualification. Floating site shell/Locker UI is existing behavior, not redesigned here.

Initial dev-server run passed workflow assertions but failed page-error assertion due a ViteHMR websocket port collision with unrelated work. Kept browser/report.json and browser.log as failed harness evidence. Fixed test environment by serving actual productionbuild, not by filtering pageerrors or changing unrelatedserver. Reviewed production and exact-head reruns pass. Source tests rerun after review-drivenchanges; no source edit after finalverification except commit identity. Exactheadbrowser confirms tested source/harness hashes.

## Remaining qualification / exact next action

PR30 remains OPEN, no checks reported at observation and no merge/deployment. Qualify prerequisitePR28/earlier stack and exact-head required gates through existing normal process; don't push main/bypass checks or replace live Sattari site wholesale. Supported-browser/mobile/physical platform, actual storagepressure/interruption/recovery, stress/performance and accessibility remain unverified. No undo/redo, chaining, cloudsync or editableportablepattern import claimed. Existing limitations are documented honestly in docs/qualification/pocket-persistence.md.

Follow-up PROGRAM18-POCKET-QUALIFY-001 will qualify remaining productgates after current founder firstwave. Rawbackup is not automaticrecovery. Keep existing Community-source blocker scoped to PocketStudio/Sessions. Canonical registry/matrix retain product INCOMPLETE; narrow P0 repair task completion is not entireproduct completion.
