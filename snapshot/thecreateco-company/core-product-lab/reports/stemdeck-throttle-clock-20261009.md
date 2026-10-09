# StemDeck staff throttle clock — 2026-10-09

Task `CORE-STEMDECK-TEST-001`; owner `joey-20261009-stem-test`. Isolated checkout `/Users/agentsattari/code/core-product-lab/stemdeck-throttle-clock`, base `1569ef377f6d3e079936116b1d8e5c4fe7586f48`, pushed commit `6265c325014d92430f9b7b9b2b8ccbc6f0821149`, PR <https://github.com/armonon/sattari-custom-site/pull/37> against open security PR #28. Clean source tree after push; remote ref matches exact head.

Changed only `tests/netlify-functions/staff-login.test.js`. The revocation/global-throttle case now pins `Date.now` for its entire body and restores the spy in `finally`. A second case proves the real global counter resets when the fixed 15-minute boundary advances by 2 ms. No production authentication, throttle, payment, or access code changed. Earlier independently reviewed boundary failure/control evidence: `stemdeck-security-review.md`.

Exact-head Node 22 checks: `npm ci --no-audit --no-fund --ignore-scripts` PASS; focused staff-login suite 17/17 PASS; full serial Vitest 245 files, 2,234 tests PASS; focused ESLint and `git diff --check` PASS. The full suite ran 189.31 seconds. No hosted checks reported yet on PR #37; no merge or deployment. PR #28 and the broader Sattari stack retain their own review, CI, and release gates.
