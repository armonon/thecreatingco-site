# thecreatingco.com — marketing site

Source for the production site at https://thecreatingco.com (Netlify site
`momentium-creative`, site id `59ccf268-f99f-43ba-89b6-1117fa561e93`), deployed
by CLI/API rather than from a connected git repo.

## Check the current source baseline

Before website changes, run the read-only production comparison:

```sh
/usr/bin/python3 maintenance/scripts/audit-live-source.py --output /tmp/thecreatingco-source-audit.json
```

This uses the authenticated Netlify CLI and exact production site ID, verifies
that the deployment stays unchanged while reading its manifest, and compares
SHA-1 hashes with tracked files. It records deployment and function metadata
without exposing credentials. Exit 2 reports drift; exit 1 means the audit did
not complete. Repository-only files are reported but may be source or maintenance
files that are intentionally unpublished.

The October 17, 2026 audit of unmodified commit `e300dc9` found 145 changed files
and 440 live-only files against published deployment `6acdeb0dedf03e90c4a63f55`
(October 13). The existing `maintenance/tests/year-one-availability.mjs` test also
fails on that snapshot. These are baseline findings, not changes introduced by
the operator setup. Reconcile original source before feature edits: CDN-served
HTML can be transformed and must not be accepted when its manifest hash differs.
No production deployment or automatic Git deployment is enabled by this audit.

The historical reconstruction notes below still apply. Read AGENTS.md for the
maintenance workflow and release constraints.

## Historical reconstruction

This repository was reconstructed from the live published deploy on
**2026-10-06**: every file was downloaded from the then-published deploy
(`6ac497e9bdab52f76e8be724`) via the Netlify API (`GET
/api/v1/deploys/{id}/files` for the manifest, then each file fetched from
the deploy-pinned URL and sha1-verified against that manifest) and committed
as a pristine first commit before any changes were made. Three files
(`/_headers`, `/_redirects`, `/community/index.html`) could not be fetched as
raw bytes — Netlify processes them specially and never serves them as literal
paths — so they are intentionally absent from this working tree; see the
pristine-snapshot commit message for their known sha1/size. A Netlify
serverless function (`community-proxy`, used by the `/community` redirect)
also isn't represented here as source; it's referenced by digest when
deploying so it carries forward unchanged.

See `WAVE2.md` in `~/code/wave2/` (not part of this repo) for the full
publish record of the change on top of this snapshot: new tool pages/links
(AutoCut, Glyph Studio, and sections on the ScenePilot/Luma/Form/StemDeck
product pages for the rest of the Wave 2 tools), a few copy fixes, and the
rollback deploy id.

Until this site is wired to git-based deploys, treat this repo as a manual
mirror: pull the live deploy's files again before making further changes, the
same way this snapshot was built, so diffs stay meaningful.

## Wave 4 (2026-10-06): suite kit + Locker

- `suite/v1/suite.js` + `suite/v1/apps.json` — the shared apps menu and
  `window.TCC.locker` client every thecreateco app loads. Edit `apps.json`,
  then run `node maintenance/scripts/build-suite.mjs` (validates it and inlines
  the offline fallback copy into `suite.js`).
- `locker/` — the Locker page, the iframe bridge (`bridge.html` + `core.js`,
  exact-match origin allowlist) and a service worker scoped to `/locker/` only.
  Kill switch: `maintenance/locker-kill-switch-sw.js`.
- `_headers` is now tracked: the original `/*` rule was reconstructed
  byte-for-byte (sha1 `3c1fa8e9…` matched the deploy manifest); wave-4 rules are
  appended below it. `_redirects` and `community/index.html` are still absent and
  must be carried forward by sha1 from the published deploy's manifest, and the
  `community-proxy` function by digest, exactly as described above.
- Tests: `SUITE_BASE=<origin> node maintenance/tests/suite-kit.mjs`,
  `HUB_BASE=<origin> node maintenance/tests/hub-suite-pass.mjs`.
- Publish record and rollback targets: `~/code/wave4/WAVE4.md` (section K).
