# StemDeck release-gate independent review — 2026-10-07

Disposition: APPROVE the one-line build-parity correction for commit/push through normal PR CI. No blocking findings. This is not release approval or a claim of passing rerun CI.

Reviewer: independent OpenAI/Codex child context (no Claude). Parent implementation was not edited.

Scope: `scripts/studio-release-gate.mjs` working-tree diff against `278e0874a69b8c0ea531fc5ff1ec66acc30a2e4b`. Diff SHA-256: `355bbfdf708a39615342076484b29ada7e599489ddbf5631888822deff75ea73`.

## Evidence

- The sole added step is `['service-worker', ['scripts/build-studio-sw.mjs']]` after prerender and before SEO/browser checks. This matches `package.json` build order: Vite → prerender → service-worker.
- `build-studio-sw.mjs` requires the prerendered pages and two Split runtime assets, checks template placeholders, and writes only `dist/studio-sw.js`. Failure throws and fails the gate through the existing subprocess-status handling.
- `src/pwa/studioPwa.js` registers `/studio-sw.js` in production. The prior release gate omitted the generator even though normal build includes it. Archived Node22 and Node24 browser/UI reports both show two unsupported `text/html` MIME errors at each of 1440/615/390 widths; this is consistent with missing-worker fallback HTML.
- Clean-tree/disk preflight, source fingerprint and unchanged HEAD/tree check, full-step success requirement, browser assertions, soak, and `releaseApproved: false` are unchanged. `artifactIdentity` hashes all dist files except the root release manifest, so generated worker bytes are covered. Exact-artifact verification remains intact.
- Independently executed `git diff --check` and `node --check scripts/studio-release-gate.mjs`: PASS. Read original archived CI reports: build/prerender/SEO pass and browser fails on both runtimes.

## Limits / next gate

Parent reports local build plus three-width UI passed using system Chrome; I did not independently rerun that browser suite. Require normal exact-head CI with pinned browsers after this patch, including downstream soak and artifact checks. Full physical/release qualification remains separate. No source, queue, Git refs, or external publication modified by reviewer.
