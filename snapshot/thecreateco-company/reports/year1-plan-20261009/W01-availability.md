# W01 — public availability copy clarification

- Task: W01, `Reconcile hub launch registry with actually available products`.
- Source base: `origin/main` at `5515c3e`.
- Fix commit: `9b72229` (`codex/year1-availability-clarity-20261009`).
- Draft PR: https://github.com/armonon/thecreatingco-site/pull/1 — open, not merged,
  not deployed. No production change.
- Scope: About, Testing and Kickstarter copy now distinguishes the four Creative
  Suite native editions still in development from the free Reclaim Mac alpha linked
  on Downloads. Testing no longer hard-codes “nine apps”; it sends readers to the
  current availability page.
- Verification: `node --test maintenance/tests/year-one-availability.mjs` PASS 1/1;
  `git diff --check` PASS. This is static copy-contract verification, not analytics
  or a pagewide responsive/accessibility release audit.
- Remaining: human/CI/release gate and deployment; after publication, check all three
  live routes against the Reclaim Downloads page. No claims about conversion impact.
