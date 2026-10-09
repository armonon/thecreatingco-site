# StemDeck security patch publication — 2026-10-07

Task: CORE-STEMDECK-SEC-001. Worker: stemdeck-land-20261007.
Authorization: Armon, Discord #4geeks message 1557557217585270805 at 17:56 PT:
continue upgrading/pushing without waiting for personal review; frequent reports.
This does not waive independent review, CI, source provenance or deploy gates.

## Published

- Exact commit: `278e0874a69b8c0ea531fc5ff1ec66acc30a2e4b`.
- Branch: `core-lab/stemdeck-security-20261007`.
- PR: https://github.com/armonon/sattari-custom-site/pull/28
- Target: `wave4/sattari-suite`, head `ee9f86c1a33c8ef0cf09b9828a2726417f2844d6` when opened.
- GitHub PR files verified: only package-lock.json (+10/-6).
- Full exact-head workflow: https://github.com/armonon/sattari-custom-site/actions/runs/37710555464
- No main push, merge or production deploy.

## Independent review and reused evidence

Original patch author is separate from native GPT-6.1 Sol reviewer documented in
`../core-product-lab/reports/stemdeck-security-review.md`. This landing worker also
independently inspected exact commit diff and tree identity: proxy-addr 2.0.7→2.0.8,
source-map-js 1.2.1→1.2.2, registry integrity/metadata only. No app source or auth
changes. OpenAI only; no Claude reviewer used for this landing.
`git diff --check 278e087^ 278e087` passes; original worktree remains unchanged.

Existing exact-head evidence in `../core-product-lab/reports/stemdeck-security-fix.md`:
Node22 serial 245 files / 2,233 tests pass; types/build pass; saved npm audit zero;
synthetic three-width browser subset pass. Earlier concurrent 2,232/2,233 failure
is retained: real-clock fixed-window throttle timing, independently reproduced
with deterministic fixed-clock/cross-window controls; separate task
CORE-STEMDECK-TEST-001. No failed evidence was hidden, no assertions weakened.
These checks were not gratuitously repeated locally on the unchanged exact head.

## Stack and release constraints

Patch parent `8c06f816e47bc2405e20f8941e19a4697d5c7c3f` is the existing unmerged Wave4
stack. Current target's additional `ee9f86c` changes only catalog descriptions;
PR merge diff remains lockfile-only, does not revert catalog changes. Main also
contains newer unrelated catalog/SEO edits; direct-main cherry-pick or broad stack
merge would change the audited product baseline and provenance.

Existing PR #27 explicitly warns git-triggered main deployment can drop live-only
Downloads/SEO files. Its last CI run failed on these dependency advisories. The
workflow triggers PR events only for main/develop, so a workflow_dispatch was
explicitly run on the security branch; deploy condition requires main and cannot
run for this dispatch. No main branch or target branch repository rules were
returned by GitHub rules API; this is not permission to bypass established gates.

## Current gate state

Remote Node22 and Node24 advisory scans both PASSED; both full release gates running (observed 2026-10-08 01:10 UTC). No final CI claim yet. Final result
will be appended; full physical/audio/hardware and source/artifact provenance
qualification remain independent open gates even if software checks pass.

## First exact-head remote result — 2026-10-08 01:11 UTC

Run 37710555464 FAILED. Both Node22 and Node24 passed advisory checks, matrix,
lint, all 2,233 unit tests, types, meter, tempo, build, prerender and SEO. Both
failed browser UI at 1440/615/390px with exactly two unsupported text/html script
MIME errors per width; export downloads themselves succeeded. Mandatory final
windowed soak was not reached. Full immutable reports/logs/screenshots downloaded
under `reports/stemdeck-ci-37710555464/node22` and `node24`. Source unchanged true.
This is not a dependency scan failure or provider billing problem.

Root cause in release packaging: gate runs Vite build and prerender separately,
but omits `scripts/build-studio-sw.mjs`, which normal `npm run build` runs. PWA
registers `/studio-sw.js` twice (studio and assets scopes); without the generated
worker the preview server supplies its HTML fallback. Proposed one-line repair
adds a named `service-worker` gate step after prerender, before SEO/browser. No
assertions suppressed, no error ignore, no timeout loosened, no app logic changed.

Independent landing checkout for this repair:
`/Users/agentsattari/code/core-product-lab/stemdeck-security-land`, branch
`core-lab/stemdeck-security-gate-20261007`. Original author's checkout untouched.
Local clean dependency installation and npm build passed; generated worker is
12,880 bytes served `text/javascript`. Existing session-ui-qa against preview
port 4283 passed all three widths with zero console errors and both exports.
Local UI used installed system Chrome because pinned Playwright Chromium was
absent; full pinned remote qualification still required. ESLint on changed gate
and `git diff --check` passed. Independent parent OpenAI review requested before
commit/push; this is not waiting for personal founder review.

## Independently reviewed gate repair pushed — 2026-10-08 01:15 UTC

New head `1569ef377f6d3e079936116b1d8e5c4fe7586f48` adds the one missing build step. A separate native OpenAI
reviewer APPROVED (report `2026-10-07-stemdeck-gate-independent-review.md`),
confirming preserved clean-source, browser, soak, artifact and release boundaries.
PR #28 body now includes both changes and the actual failed baseline. New full
Node22/24 pinned-browser workflow:
https://github.com/armonon/sattari-custom-site/actions/runs/37712013927
Currently running, not certified green. No merge/deploy.

## Final exact-head remote result — 2026-10-08 01:30 UTC

Run 37712013927 PASSED on head `1569ef377f6d3e079936116b1d8e5c4fe7586f48`.
Node22 (14m41s) and Node24 (13m58s) each passed security scan, matrix, lint,
2,233 unit tests, types, meter/tempo, build/prerender/service-worker/SEO, complete
browser/audio/UI and mandatory 120-second soak, frozen-source/artifact verification.
Both reports: `softwarePassed=true`, `unchanged=true`, `audioChecked=true`,
`builtArtifactUiChecked=true`, `releaseApproved=false`. Deploy SKIPPED as intended.
Downloaded complete artifacts: `reports/stemdeck-ci-37712013927/node22` and
`node24`; PR snapshot `reports/stemdeck-ci-37712013927/pr28.json`.

PR #28 remains OPEN, two files only. No mergerule bypass or production deployment.
The broader unreviewed #27/#23 stack, current-base integration and live-only
Downloads/SEO provenance are not implicitly approved by this security fix.
Existing QUEUED O02 contains exact continuation evidence and should autonomously
reconcile the base/production sources and normal landing/release gates. No personal
Armon review is required or being awaited. The bounded dependency repair,
independent review, gate packaging correction, push and exact-head software
qualification are complete; broader stack/main landing remains outstanding.
