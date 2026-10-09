# StemDeck initial product audit — 2026-10-07

## Source and scope

Inspected `armonon/sattari-custom-site`, source `8c06f816e47bc2405e20f8941e19a4697d5c7c3f`,
isolated branch `core-lab/stemdeck-audit-20261007` at
`/Users/agentsattari/code/core-product-lab/stemdeck`. Original wave2 checkout has an
untracked helper and was not modified. The older canonical checkout is June source,
not an appropriate October baseline. Remote main advanced during this audit to
`47006d5` (unrelated retail catalog descriptions); these results are not claimed to
certify that later SHA or production. The later local dependency patch is separately
tracked by CORE-STEMDECK-SEC-001 and its report.

No public deployment, microphone capture, native install or physical-device test.
Node 26.9.0 is host default; Node 22 is the CI-compatible unit-test baseline.

## Fresh checks

- `npm ci --ignore-scripts --no-audit --no-fund`: installed isolated dependencies.
- Default Node26 `npm test -- --maxWorkers=2`: 2,066 pass, 167 fail / 2,233.
  Native Node localStorage shadows the jsdom storage environment; these are not
  167 established browser-app defects. Full failing log retained.
- `/opt/homebrew/opt/node@22/bin/node node_modules/vitest/vitest.mjs run --maxWorkers=2`:
  **245 files, 2,233/2,233 pass** before the dependency patch.
- `npm run type-check` and `npm run build`: PASS. Build includes Vite, prerender and
  service-worker generation. Diagnostic elapsed times are in stemdeck-checks.json;
  concurrent-audit wall time is not product performance or a historical comparison.
- `node scripts/report-performance-support.mjs --json`: `fullyQualified:false`;
  rows retain PARTIAL/PRINTED ONLY/UNSUPPORTED where warranted.
- `gh issue list`: no open GitHub issues returned. This is not evidence of no bugs.
- Latest inspected GitHub run [37568746966](https://github.com/armonon/sattari-custom-site/actions/runs/37568746966)
  failed dependency security; deployment skipped. Earlier audio qualification
  failures remain historical evidence, not assumed to recur on the audited SHA.
- `npm audit --json`: one critical (`proxy-addr` 2.0.7) and one high
  (`source-map-js` 1.2.1). Production-only audit: one critical advisory. Affected
  dependency versions are confirmed; deployed exposure was not penetration-tested.

Raw evidence is adjacent `stemdeck-*.log/json`; no transient-only test receipts.

## Actual browser workflow subset

Started isolated source server at 127.0.0.1:4216 and built preview at :4217. Default
Playwright launch failed because its pinned Chromium revision was not installed;
that failed log is retained. Re-ran with installed Google Chrome via the harness's
documented executable override. Browser version/identity is not the CI-pinned one.
All browser contexts were fresh, generated media only, output muted.

`scripts/session-ui-qa.mjs` against built preview: **1440, 615 and 390 widths PASS**,
including workspace interactions and synthetic WAV/track-stem exports. Only the
unrelated `/api/inventory` request was mocked; actual Studio code ran. Screenshots,
geometry and export byte counts are in `stemdeck-ui/`; desktop Perform screenshot
was visually inspected. The deck is the primary surface; small labels and lower
toast overlap are validation candidates, not a redesign mandate or measured error.

Source browser `scripts/reference-lifecycle-qa.html`: synthetic reconstructed
performance, split clips, MIDI and automation survive a **document reload**; reopened
PCM SHA-256 is identical (maximum error 0); master export maximum PCM error
6.332993507385254e-8 against the 2e-6 limit; ten aligned pre-master stem files.
The harness itself declares `fullReferenceProjectQualified:false`. It fabricates
action history and does not capture a full live performance, close the entire
browser process, test every DSP mutation, or measure real hardware.

`scripts/arrangement-browser-qa.html`: **13 passed, 0 failed**, covering actual
offline rendering, fades, gaps, seek/loop behavior, MIDI, aligned export, durable
source chunks and playable recording/timestamped controls.

Actual portable synthetic UI fixture and hash are saved in `../golden-projects/`.
It is one deck/six arrangement lanes, explicitly not the proposed four-deck golden
performance project. See stemdeck-golden-browser.json for raw output.

## Fifteen audit areas

1. Architecture: React/Vite shared Studio shell, Tone/WebAudio engine, bounded
   source pages, durable performance journal, printed safety reference and editable
   reconstruction. Workspace switching retains one session.
2. Tests: 245 Node/Vitest files plus dedicated browser/audio/release harnesses;
   component tests alone cannot establish sonic fidelity.
3. Test run: counts and runtime issue above. Post-patch runs are separately recorded.
4. Build: current web build and types pass; native packaging not exercised.
5. UI: scripted interaction at three widths; actual desktop screenshot inspected.
6. Main workflows: synthetic reconstruction/reload/export and arrangement subset
   executed. Full real perform/capture/arrange lifecycle still unqualified.
7. Bugs: advisory data, CI, docs/PROFESSIONAL_ACCEPTANCE.md and SESSION_INTEGRITY_1_0.md
   reviewed; no open issues returned. Source runtime test failure is distinct from
   user-facing defects. No new data-loss bug is claimed.
8. TODOs: no TODO/FIXME/HACK hits in studio components/utils. Formal acceptance
   ledgers, not comment counts, contain actual remaining work.
9. Release: exact-source fingerprint gate exists; security CI blocks release;
   source drift, physical qualification and native clean-install remain separate.
10. Performance: historical normal/heavy profiles and deadline failures examined;
    no fresh long-session CPU/RSS, latency or supported-load benchmark completed.
11. Save/reopen: source validation, portable assets, localStorage tab-conflict guard
    and IndexedDB persistence inspected; synthetic reload/export parity demonstrated.
12. Undo/redo: history/arrangement regressions in the full suite; full professional
    session, every destructive operation and native interactions not signed off.
13. Import/export: synthetic project import, master WAV and aligned stems executed.
    Codec corpus, real music listening, Live-version interchange and browser/device
    portability remain separate qualifications.
14. Failure recovery: validated project/session storage, capture/recovery tests and
    reference preservation inspected; actual process crash/disk exhaustion and
    hardware disconnection were not tested.
15. Documentation: professional acceptance, session-integrity, performance-first
    workspace, stable-candidate protocol, and publication status reviewed. Historical
    opinion scores were NOT imported as fresh quality scores.

## Priority and limits

Structured candidates and eight planning estimates: `../products/stemdeck.json`.
Ten deduplicated candidates, not fifty invented bugs. Highest immediate repair is
confirmed dependency security; subsequent work is full capture/replay golden
qualification, recovery and measured long-session behavior. No category receives a
numeric health score yet. ALPHA / not professionally qualified.

Sonnet screenshot review was attempted; Anthropic returned insufficient credits.
The error receipt is retained; no completed Sonnet critique is claimed. Sol handled
inspection and a separate Sol reviewer is examining the security patch.
