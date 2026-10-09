# StemDeck real UI lifecycle qualification — 2026-10-07

Task CORE-STEM-AUD-002 leased to stemdeck-lifecycle-20261007. Baseline reviewed f6f061c; isolated branch core-lab/stemdeck-lifecycle-20261007 in stemdeck-recovery worktree. Only new QA fixture/harness so far; application source unchanged. Pushed recovery PR29 and security PR28 gates remain separate.

Fixture: original generated16-second WAVs, four decks/four stems plus fullmix each,20 assets; hashes saved per run. No real-user media, microphone, physical inputs or external uploads. Actual UI file pickers, deck analyzer, transport, capture, source reconstruction, undo/redo, archive download and browser-process restart are being exercised. No full workflow PASS yet.

Initial harness failures preserved in initial/, actual-capture/, actual-ui/, frozen-run/. They concern hidden compact labels, querying legacy localStorage instead of current IndexedDB, wrong display label and asynchronous predicate handling—not confirmed product defects. Minimal real Playwright1.62.1 repro `page.waitForFunction(async()=>false,null,{timeout:500})` resolves rather than timing out; readiness now uses bounded Node-side awaited page.evaluate reads plus explicit postcondition assertions. No false measured-analysis claim retained.

Current run awaited-ui/ uses frozen harness during run to avoid HMR changes. Full musical/physical/platform/long-session qualification remains unverified; reports must distinguish actual generated software capture from hardware performance.

## Confirmed core-workflow defect and repair (03:15 UTC)

`awaited-ui/` actually captured ~15s from four real software decks, 38 events and complete source chunks. The master M4A's positive metadata duration was 0.3115417s although Mediabunny packet timing and independent ffprobe both report 14.9446042s. `withCapturedTake` then overwrote the event/source clock with that short reference duration. UI “Build editable source replay” failed with “No playable source intervals were captured.” Original source assets/events remained intact, but core replay was blocked.

Repair in progress: precise encoded packet timing (bounded encoded cache, no whole-file PCM decode) and preserve capture clock independently of reference timing. `regression-before.log` records four failures; `regression-after.log` records the targeted passing tests. Actual full UI lifecycle rerun pending; no full-product PASS.

## Downstream decoder and memory admission (03:25 UTC)

`timing-fixed-file/` confirms actual capture → source reconstruction → Undo/Redo now works, but export rejected “Clip exceeds its source”: compressedAudioWindow separately trusted the same stale first-fragment metadata. This is the same root cause, not a new invented feature. Shared precise packet-end lookup now covers description, streamed decoding and known-codec fallback memory admission. Only validated numbers are weakly cached per immutable Blob, avoiding repeated whole-MP3 scans; failed probes are not cached. Decoder regressions for late-window audio, unsafe fallback admission and one-scan reuse fail before and pass after (`decoder-before.log`, `decoder-after.log`).

`long-compressed/report.json` measures actual Chromium151 probing of generated 1-hour MP3 (28.8MB, exactly3600s with encoder trim1728frames,111ms) and 30-minute fragmented M4A (15.1MB,1800.0213s,5.3ms). Full Blob arrayBuffer was forbidden, largest encoded read2MiB. MP3 reads28.8MB sequential encoded bytes, not an O(1) claim. These are bounded representative measurements, not universal latency/cancellation guarantees. Description probing has no exposed cancellation signal; pathological/enormous files and physical audio remain unverified.

Harness-only followups preserved: timing-fixed/ expected manual Pause after16s file naturally ended; timing-fixed32/ exceeded Playwright's50MB buffer-upload limit. Owned32s fixture now writes a local .sattari file and uses actual file picker. `decoder-fixed/` is frozen source run including actual replay print, export, browser restart and fresh-profile portable restore. No PASS asserted until all postconditions finish.

## Exact-frame export defect and preserved replay failure (03:34 UTC)

After timing repair, actual master export and complete browser restart compare with zero PCM difference. `quiet-lifecycle/` also validates aligned stem WAV output. Real live-engine print fails closed on scheduling deadlines, including a quiet retry with lightweight UI-state observation instead of repeated full-session serialization; no thresholds changed. It is a separate follow-up defect, not passed.

`semantic-roundtrip/` exposed another real export defect on a different measured take length: master WAV payload one frame shorter than the header, stem ZIP failed “Incomplete ZIP entry.” Converting integer frames → seconds → frames inside Tone's constructor rounds down (e.g. 27 becomes26.999999999999996; 779448 becomes779447.9999999999). Exact native OfflineAudioContext frame count now feeds the existing Tone graph wrapper. Actual browser baseline13 pass/1fail (`frame-export-before.log`), repaired14/14pass (`frame-export-after.log`); both awkward frame lengths test real rendering, master header/payload equality and successful stem archive completion. No fake padding and no weakened archive validation.

Portable import intentionally remaps database asset IDs; test now compares every referenced asset SHA-256 and semantic arrangement state. Prior raw-ID comparison was a harness error, not evidence of lost bytes. Final portable result pending.

## Reviewed immutable candidate

Local commit `af10e31c9df8f1363d3945e3b1d39518cd858009`, clean tree. Parent independent OpenAI review approved all runtime fixes, failed-probe/late-window/memory/frame regressions and scoped docs; receipt in `independent-review.md` pins committed diff SHA-256. Not pushed/merged/deployed at this milestone.

Exact Node22.23.2 `scripts/studio-release-gate.mjs`, output `exact-gate/`:2242/2242 tests across246files, lint, types, meter, tempo, build, prerender, service-worker and SEO checks PASS. Native/browser suites in progress; mandatory120-second soak not yet complete. This automated gate is separate from the actual UI replay-print failure, which remains an explicit functional blocker. Follow-up task `CORE-STEM-REPLAY-DEADLINE-001` queued; do not lower deadlines or claim physical/full replay parity.

## Pushed checkpoint and exact results

PR33: https://github.com/armonon/sattari-custom-site/pull/33, head `af10e31c9df8f1363d3945e3b1d39518cd858009`, base recoveryPR29; not merged/deployed. `exact-gate/report.json` records clean/unchanged Node22.23.2 candidate,2242tests, all required local software gates and unchanged120s soak PASS.

`exact-ui/report.json` records clean exact SHA. Actual capture/edit/Undo/Redo/full browser restart/portable import/export subset passed:41 asset byte hashes preserved, original events/semantic state retained, master/stem/reopened/portable PCM768960frames48kHz stereo,maximum error0. Actual replay remains FAIL (source-read deadline here; scheduler deadline on prior quiet trial), so overall harness exits1. The harness phrase “natural end before final pause” is imprecise: only “already stopped” was observed; natural completion was not established. That wording will be corrected in follow-up diagnostics; it is NOT proof of continuous performance.

`exact-platforms/report.json`: native arrangement14/14 on Chromium151.0.7922.34 and Firefox153.0, including exact integer-frame PCM/WAV/ZIP test. Playwright WebKit26.5 failed IndexedDB audio-asset setup before any test; render/export there UNVERIFIED. No Safari/iOS/Android or physical/musical qualification claimed.

Parent approved normal open PR checkpoint, then continued dedicated replay diagnosis (`CORE-STEM-REPLAY-DEADLINE-001`). Mandatory remote CI pending at push, never bypassed; source/live stack and complete product release remain held.
