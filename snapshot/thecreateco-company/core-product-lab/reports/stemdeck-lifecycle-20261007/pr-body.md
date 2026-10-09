## Scope
- Preserve the capture engine's event/source clock independently of compressed reference timing.
- Use validated encoded packet end for source description, window decoding and known-codec fallback memory admission; weak per-Blob timing cache prevents repeated long-source scans.
- Supply exact integer OfflineAudioContext frames to avoid one-sample truncated WAVs and rejected stem ZIPs.
- Add real UI lifecycle and actual native audio regressions; retain all existing replay deadline and ZIP validation limits.

## Evidence
- Actual generated four-deck M4A metadata: 0.3115 s versus packet/ffprobe 14.9446 s; previously blocked reconstruction/export.
- Actual native export: 27 requested frames became 26 before repair; 27/779448-frame render, WAV payload and stem ZIP checks pass after repair.
- Local independent OpenAI source review approved. Exact clean af10e31 Node 22.23.2 gate passed: 2,242 tests, lint/types/build/SEO, native/browser suites, and the unchanged 120-second soak; immutable artifact identity verified.
- Exact-head real UI archive roundtrip passes: 41 referenced audio assets retain SHA-256 identity after fresh-profile portable import; original events/state preserved; master/stem/reopened/portable PCM is identical.
- Native arrangement suite: 14/14 on Chromium 151 and Firefox 153. Playwright WebKit 26.5 fails audio-asset IndexedDB setup before any test; export there remains unverified.
- Actual UI replay-print still stops on a scheduling/source-read deadline. This remains a FAIL and a separate active follow-up, not a product-complete or full replay-parity claim.

## Release state
Stacked on recovery PR #29 (and security PR #28). Open PR only: not merged, not deployed. Required CI/review/source-stack gates must remain satisfied before release; no billing-outage retries or rule bypass. Full physical/musical/mobile/installed-app qualifications remain unverified.
