# Requested live-site rollback — 2026-10-09

Armon requested undoing the published Tools-directory expansion and NOW Messages preview.

## Published results

- **Company site:** published narrowly scoped rollback overlay `6ac9a117d2e01be1e2cc3c67` at 2026-10-10 02:22:44 UTC. Its base was current deploy `6ac99fc60f83c20e10e6c332`; the content restored was from pre-expansion deploy `6ac97a65200ed978b194366e`.
- Only `/tools/index.html` and `/start/index.html` were restored, and the Messages app-logo asset `/assets/app-logos/messages.svg` was removed. Current Community proxy digest, `_headers`, `_redirects`, WebLab product integration, and latest workspace captures were preserved.
- **NOW Suite preview:** restored from Messages preview deploy `6ac994b4559b54cd63acdbee` to prior deploy `6a317eb0e9107190b4145c0b`. Manifest comparison found exactly three added Messages files and three changed links; no files had been removed by the preview release.

## Verification

- Company draft reached `ready`; exact manifest comparison passed. Preview `/tools/index.html` and `/start/index.html` matched the exact pre-expansion content hashes.
- Company production `/tools/` and `/start/` returned HTTP 200 with no NOW Messages preview text or logo reference.
- WebLab product route and latest captured workspace assets remained HTTP 200.
- Company Community proxy function digest matched before/after; security headers and redirects had identical source hashes.
- NOW Suite production `/`, `/now/`, and `/community/` returned HTTP 200; `/messages/` returned 404 after rollback.
- This changes only the two requested live website surfaces. The source PR remains open and unmerged; the rollback does not merge or close it.
