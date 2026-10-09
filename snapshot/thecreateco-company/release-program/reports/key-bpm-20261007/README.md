# Key & BPM first-wave completion log — 2026-10-07

Task PROGRAM18-KEYBPM-001; owner keybpm-completion-20261007.
Baseline1569ef377f6d3e079936116b1d8e5c4fe7586f48, isolated worktree
`/Users/agentsattari/code/core-product-lab/key-bpm`, branch
`release18/key-bpm-20261007`. Scope Key & BPM only; excluded lab code retained.

## Discovery and baseline

Live route `https://sattarimusic.com/studio/keybpm` returned HTTP200. Existing app
is in the unmerged Wave4 source stack, absent on main; no blind main deployment.
Main/stack/live-only provenance gate remains open. Product maturity alpha.

Actual built Chromium151 decoder/worker/UI: generated C-major120BPM→Cmajor/8B/120;
A-minor100BPM→Aminor/8A/100rough; silence→no key/tempo; malformedWAV→clear error.
CSV download/readback passed.3 CSS widths passed page-overflow checks. These are
original synthetic fixtures, NOT labelled-music accuracy or real-device results.
`baseline-built/chromium-report.json`, screenshots and CSV preserve evidence.
A first Vite-development run had an HMR-port error and incorrect test label query;
that diagnostic is retained separately in `baseline/`, not counted as app pass.

## Confirmed defects and current implementation

1. Unavailable analyzer response was marked done and could display undefined
   measurement fields. Component regression failed expectederror vs actualdone;
   repaired to preserve result.status. Evidence unavailable-row-before.log.
2. Two distinct audio files with matching names/lengths: second rejected as
   duplicate. Real built-browser repro in collision-before/chromium-report.json.
   Repaired with SHA256 comparison only for candidate collisions, cached perFile;
   serialized intake, clear checking state and explicit read errors. Identical
   content still deduplicated; source-less report metadata is never fake audio.
3. Previously measurements lived only in tab, so reload lost results. Owner
   completion requirement includes save/reopen/export: added a real versioned
   portable report with measurements, confidence, source metadata and timestamps.
   Report explicitly contains no source audio/reanalysis or accuracy certificate.
   Opening adds validated results; CSV remains unchanged. Malformed/oversized or
   inconsistent report rejects atomically without changing current results.
4. Result table gets a labelled keyboard-focusable scroll region for narrow CSS
   widths. Screen-reader/device qualification remains UNVERIFIED.

Current tests:34 targeted tests PASS (report validation/roundtrip, errorrow,
contentidentity, engine fixtures and existing audio-lab shell). Build/types/lint
and full browser final workflow ongoing; no commit/push/release claim yet.

## Exact next actions / gates

- Run real built Chromium/Firefox/WebKit decoder/worker/import/report-reopen/CSV.
- Exercise actual600/601second boundary, malformed files and Stop/Resume queue.
- Independent OpenAI review; normal tested-branch PR, exact-source remote gates.
- No merge/deploy without reviewed prerequisites and source/live-artifact mapping.
- Physical mobile/Safari-app, labelled-music corpus accuracy, broadscreenreader
  support UNVERIFIED. Do not replace these with viewport/emulation claims.

## Milestone: portable round trip and review

- Real CSV + portable report download/fresh-context reopen/reexport retained exact
  values/confidence/timestamps in Chromium151, Firefox153 and WebKit26.5.
  Malformed/oversized report imports preserved all existing rows in each engine.
- Chromium extended actual600-second WAV accepted,601-second rejected;20-file
  queue stopped after1completed file and resumed all20 without lost/duplicate rows.
- Firefox complete scripted workflow PASS. WebKit initial workflow passed but
  native arrow scrolling timed out; explicit focused-region Left/Right handling
  added. Reverification pending; not promoting the earlier full WebKit run toPASS.
- Parent independent OpenAI source/report review found no blockers but requested
  overlap regression. That test revealed201rows when report read overlapped suite
  intake; final cap recheck + separate report busy flag now preserves200limit.
  Regression fails before and passes after; overlap-before.log retained.
-35 targeted tests PASS. Earlier full suite247files/2248tests PASS preceded final
  overlap fix, so it is not claimed as final exact-head qualification.
- Exact-head full suite and all built browser checks next; release remains local.

## Published candidate and exact-head evidence

Candidate `dab0dda829ffc436987773d650abbe0232f4a0ec` pushed in
https://github.com/armonon/sattari-custom-site/pull/31 (OPEN, not merged/deployed).
Target PR28's security branch; unrelated/excluded source unchanged. Independent
OpenAI review approved final source/report parser/intake cap and scope documentation.
Final full suite247files/2249tests PASS; targeted35PASS; build/types/lint PASS.
The final source was frozen for those tests; subsequent edits were QA format
coverage and documentation only. Exact-head browser records include sourceDirty=false.

- `candidate-chromium/chromium-report.json`: Chrome151.0.7922.34 core/report,
 600/601second limits,20-file Stop/Resume, MP3/FLAC/M4A/OGG, three widths and
 keyboard scrolling PASS. AIFF explicit unsupported decoder response retained.
- `candidate-firefox/firefox-report.json`: Firefox153 core/report, failures,
 identity, three widths and keyboard scrolling PASS. Earlier exact implementation
 format extension in `exact-firefox/` also passes MP3/FLAC/M4A/OGG; AIFF unsupported.
- `candidate-webkit/webkit-report.json`: WebKit26.5 core/report, failures,
 identity, widths and keyboard scrolling PASS. All-format extension FAILED for
 M4A/AAC; evidence in `exact-webkit/webkit-report.json`. Other formats there pass.
 This is not a Safari application or physical iOS test. No universal codec claim.

Remote exact-head software/release CI started:
https://github.com/armonon/sattari-custom-site/actions/runs/37718570242
Currently pending; do not claim pass, merge or deployment before checking result.

Remaining: source/live stack and actual release artifact reconciliation, real
Safari/iOS/Android qualification, complete screen-reader/accessibility/performance
budgets, broader musical-corpus accuracy evidence. Existing alpha limits remain
explicit. No remaining reproduced report/intake defect is known after regressions,
but that is not full-product completion or a stable-release certification.

### Exact-head remote gate — attempt1 failure retained

Run37718570242 on dab0dda: Node22 unit/types/build/browser passed, mandatory120s StemDeck soak stopped around13s with scheduler-deadline lateness0.237s. Node24 cancelled by matrix fail-fast; deploy skipped. This is a real gate failure, not GitHub billing and not a KeyBPM-specific unit failure. Exact failure log: `remote-failure.log`. One unchanged-head rerun started (attempt2); no threshold weakening and no merge/deploy while unresolved.

### CI attempt2 settled

The single unchanged-head rerun succeeded: Node22/24 frozen-source gates including mandatory120ssoak PASS on dab0dda; deployment skipped. `remote-attempt2.json` and downloaded Node22 evidence pin the result. Attempt1 scheduler failure remains preserved; no threshold/production source changes or repeated billing retries. PR31 stays open, not merged/deployed.
