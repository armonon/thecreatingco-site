# Local CI / self-hosted feasibility — 2026-10-08

Read-only tooling audit; no runner registration, repository settings, credentials, branch protections or release authority changed.

## Existing working local CI

- Checkout: `/Users/agentsattari/code/company-worktrees/sattari-integrated-20261007`, clean exact SHA `e547d7d4eef74d533795cea493a426b091b92d2a`.
- Harness: `scripts/studio-release-gate.mjs`; run `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run test:studio-release`. Uses `scripts/release-artifact.mjs`, pinned Playwright, isolated source/preview origins, actual browser/audio checks and mandatory 120-second soak. No duplicate harness needed.
- Existing executable `/opt/homebrew/opt/node@22/bin/node`:22.23.2. Default `node`:26.9.0, not a Node24 replacement. `/opt/homebrew/opt/node@24/bin/node` absent. Cached npx executable `/Users/agentsattari/.npm/_npx/31e18084b4a02655/node_modules/node/bin/node` is20.20.2. Bounded nvm/local/volta/tmp/npx search found no Node24. Previous StemDeck24 receipts are REMOTE artifacts, not local installation evidence.
- Playwright1.62.1 installed; Chromium revision1234, browser151.0.7922.34. Exact executable path/hash in `local-gate/report.json`. Installed system Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` is154.0.8037.98; separately scoped process-recovery receipt identifies it.
- Actual local result:248 test files/2273 tests, lint/types/build/prerender/SW/SEO/browser/audio/120s-soak PASS. Exact source unchanged, softwarePassed=true; releaseApproved=false. Captured immutable local evidence at `local-gate/`; artifact identity retained. This does NOT certify physical hardware/full product/platform requirements or upload a GitHub required check.
- Existing workflow `.github/workflows/build-deploy.yml` runs22.x and24.x on ubuntu-latest and preserves exact validated build. Single current dispatch37719598238 passed BOTH lanes, deployskipped. No outage retry needed for this repository/head.

## Independent local runner feasibility

The existing harness can run under an OS scheduler/supervisor against a clean isolated checkout and produce deterministic SHA-linked receipts without registering with GitHub. Require pinned explicit Node/browser paths, clean source and locked dependencies, disk/RAM preflight, exclusive ports and product ownership, synthetic-only browser profiles and media, atomic evidence retention, bounded timeouts, cleanup of owned processes, and compare source/artifact hashes after execution. It must report failed/untested checks honestly. A local run is not a remote required status and cannot waive normal merge/release checks.

## GitHub self-hosted Actions requirements

Not configured or registered in this assignment. Before using it, an authorized admin must establish runner registration/installation credentials, repository/organization ownership and permitted runner groups/labels. Confirm whether existing GitHub billing restrictions permit job scheduling; self-hosting cannot be assumed to clear an account execution restriction.

Never expose this personal agent Mac's unrestricted workspace, stored credentials, mounted private data, Docker socket or production authority to untrusted PR code. Use a dedicated least-privilege isolated ephemeral VM/host and fresh checkout with controlled network/secrets; do not share persistent browser profiles or run fork PRs with secrets. Pin actions/toolchains, limit concurrent jobs and disk/ports, retain logs/artifact hashes, revoke short-lived registration material, and destroy job workspace after preserving nonprivate evidence. Runner labels/workflow routing and required-status names must be deliberately reviewed; do not alter protections or claim an equivalent required check just because a local command passes.

Current decision: reuse existing independent local gate for useful evidence. No new daemon/runner harness, registration, credential changes, purchases or protection changes are justified. Missing Node24 local executable is explicit; remote exact-head lane already passed. Parent's broader local-environment audit is authoritative for other products/toolchains.
