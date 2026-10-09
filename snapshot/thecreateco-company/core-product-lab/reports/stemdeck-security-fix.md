# StemDeck dependency security repair — 2026-10-07

Task: CORE-STEMDECK-SEC-001. Local commit
`278e0874a69b8c0ea531fc5ff1ec66acc30a2e4b`, branch
`core-lab/stemdeck-audit-20261007`, isolated checkout
`/Users/agentsattari/code/core-product-lab/stemdeck`.

## Change

Only package-lock.json: `proxy-addr` 2.0.7 → 2.0.8 and `source-map-js` 1.2.1 → 1.2.2,
with registry integrity/metadata updates. Existing semver ranges accommodate both.
No runtime application, authentication, payment, ownership or access code changed.
Command: `npm update proxy-addr source-map-js --ignore-scripts --no-fund --no-audit`.

Saved npm audit reports: before one critical + one high, after **zero advisories**.
This resolves the two advisory versions that blocked the inspected CI security
stage; it does not claim the remote CI run is now green or production was fixed.
No deploy, push or public release was performed.

## Verification

- Independent Sol review: `stemdeck-security-review.md`; exact narrow dependency
  diff reviewed. Sonnet was unavailable because of provider credits, not silently
  substituted and labeled successful.
- `git diff --check`: PASS before commit; checkout clean after local commit.
- Node22 full suite, serial release-gate worker configuration: **245 files,
  2,233 tests passed**. Log: `stemdeck-fixed-unit-serial.log`.
- Post-patch types and production web build: PASS; see `stemdeck-fixed-checks.json`.
- Browser subset outcomes and any post-patch UI recheck are saved separately; they
  do not equal a complete pinned-browser release/hardware gate.

## Preserved failure and root-cause investigation

First post-patch concurrent suite: 2,232 pass, one failure in staff revocation/
global-throttle expectation (expected 429, actual 200). Do not discard this run.
The test uses real wall time across repeated password hashing, while global quota
resets at each 15-minute boundary. Its run spans 17:00.

Independent reviewer held the clock within one window: pass; advanced it across
the boundary mid-test: reproduced the exact failure. Parent/reviewer focused
suites each passed 16/16. Historical exact timestamps were not captured, so the
earlier failure is strongly explained by, not conclusively timestamp-proven as,
this existing test bug. No authentication defect is established. The unchanged
serial full suite subsequently passes. Test-only clock stabilization is separately
queued as CORE-STEMDECK-TEST-001 with the deterministic proof; no assertion or
production security behavior was weakened to make this repair pass.

## Remaining gates

Review/land through repository workflow and rerun the complete unchanged remote
release gate on the exact proposed head. Main advanced with unrelated catalog
changes during audit; reconcile without overwriting that work. Pinned Chromium,
real audio deadlines, long-session physical hardware, native install/update and
full perform/capture/replay/arrange/save/reopen/export qualification remain open.
This is a reviewable local repair, not release approval.
