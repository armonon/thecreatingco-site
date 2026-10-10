# Website push and Netlify handoff — 2026-10-09

## Git handoff

- Repo: `armonon/thecreatingco-site`
- Branch: `feat/tools-directory-start-links-product-stories-20261009`
- Head pushed: `6354f944a46e13f324ac69cf08acae6c9bd7f9cd`
- PR: https://github.com/armonon/thecreatingco-site/pull/2 (open)
- Branch protection: `main` reports unprotected; PR currently reports no required status checks. No merge performed.
- Changes: preserve/ship all 21 image-led product stories; make both `/start/` app CTAs land on `/tools/`; include NOW Messages as an explicitly nonfunctional, non-E2EE concept preview in the directory; refresh product nav cache keys; include start-page style/media, app logos and sitemap source.

## Exact live baselines

- Company site `momentium-creative` (`59ccf268-f99f-43ba-89b6-1117fa561e93`): published deploy `6ac9255b650074067734fcfc`, 1,855 manifest entries. Community proxy digest `2a3d18e378a9832de4dd6e4aa73e6456f86cd826049f46ad86bf260e3a5d7f60`.
- NOW Suite preview (`69b08e37-f978-4f0b-a45b-b2fcd558aa0f`): published deploy `6a317eb0e9107190b4145c0b`, 77 manifest entries, no functions.

## Netlify publication status

Exact manifest overlays were created for both known sites. Both Netlify API deploy records remain in `uploading` with `required=[]` and summary `building`; their immutable deploy URLs return HTTP 500. Neither draft is published and neither live `published_deploy` changed.

- Company draft: `6ac960bb650074be4a34fcd5`; intended overlay is the 21 product pages, `/tools/index.html`, `/start/index.html`, and cache-bust-only pages as determined from the exact live manifest. No file removals; Community proxy digest is carried forward.
- NOW preview draft: `6ac96170a3371b4a38fa42af`; intended overlay updates suite/Passport/Community links and adds the three `/messages/` assets. No real auth, E2EE, network delivery, directory, invite service, or server-enforced expiry is claimed.

Resume condition: Netlify transitions exact API digest uploads out of `uploading` to `ready` and each preview URL serves the intended content. Then verify exact manifest, publish by restoring the ready deploy, verify current deploy IDs, and smoke-test both live sites. Do not ZIP/replace the production company site: the Community function and processed redirects must be preserved.

## Verification

- Source assertions passed: HTML parse across `/tools/`, `/start/`, all 21 product pages; Tools JSON-LD has 24 entries; prototype caveat is visible; all three `/start/` app links target `/tools/`; product-nav cache keys refreshed; sitemap XML parsed with jsdom; JavaScript syntax checks and `git diff --check` passed.
- Local static HTTP returned 200 for `/tools/`, `/start/`, the start CSS and both start-page images.
- Legacy `maintenance/tests/tool-product-pages.mjs` cannot run because its required `maintenance/reports/tool-product-pages-20261006/plan.json` fixture is absent from this mirror; `wave2-reconciliation.mjs` has the same missing fixture dependency.
- Before deployment, live `/tools/` and `/start/` returned 200 but did not contain the NOW entry or corrected Explore CTA; live `/messages/` returned 404.
- The verified and previously published 21-page visual tour remains live; this release adds the NOW catalog linkage and start CTA corrections, not new measured traffic or SEO outcomes.

## Follow-up check — 2026-10-09 15:25 PDT

- Netlify status is reachable. The two exact-manifest drafts still have not advanced: company `6ac960bb650074be4a34fcd5` and NOW `6ac96170a3371b4a38fa42af` remain `uploading`, `required=[]`, `summary=building`; their immutable URLs still return HTTP 500.
- Company `published_deploy` changed independently to ready deploy `6ac969607bc795f9612a0c37` at 22:23:47Z. Its full manifest has 1,858 paths and includes one function, six processed redirects and five processed header rules. `/tools/` and `/start/` return HTTP 200. This is not the requested feature release: deployed `/start/` still sends “Explore the apps” to `/#collection`; deployed `/tools/` has no NOW Messages entry. PR #2 remains open at `6354f944a46e13f324ac69cf08acae6c9bd7f9cd`.
- Because this newer production deploy carries a function and processed site rules, do not publish the old overlay or substitute a local-folder ZIP. The site has no connected Git repository in Netlify, and no verified deploy artifact currently reproduces that function/rule configuration. Resume with a fresh exact snapshot of the current published deploy plus the two requested page changes using a verified Netlify CLI/API release path; confirm the function and rules are retained before publish. NOW likewise requires reconciling its root `netlify.toml`/function bundle with the published configuration before any full-site deploy.

## Completed release — 2026-10-09 18:32 PDT

- Recovered the API deploy lifecycle from the prior successful tools-directory release: create an async draft, wait for `prepared`, upload each path whose content hash is returned in `required`, verify the exact manifest, then restore only after preview checks. The initial create response's empty `required` list is provisional; uploading before `prepared` or never re-reading the hash list can strand a deployment.
- NOW Messages is live on the existing NOW preview host at `https://now-suite-preview.netlify.app/messages/`, deploy `6ac994b4559b54cd63acdbee`. The exact manifest has 80 paths (77 prior plus three Messages assets and the intended existing-page link updates); no site files were removed. Suite home, Passport, Community and Messages routes/assets return HTTP 200. The UI says this is a concept preview with no account verification, network delivery, end-to-end encryption, server retention policy or abuse reporting.
- Company site is live at deploy `6ac995969ec633190977c984`, built as an exact overlay on current deploy `6ac97a65200ed978b194366e`. Its 1,861-path manifest has no removals; only `/tools/index.html`, `/start/index.html` and `/assets/app-logos/messages.svg` changed/added. It retains the current `community-proxy` function, six redirect rules and five header rules. `/tools/` serves 30 cards and 30 structured-data entries, including the visibly labeled concept preview; both Start CTAs lead to `/tools/`; both pages return HTTP 200.
- All 21 current product pages were rechecked on the live host: every route returned HTTP 200 and contained images. Their headers link to Apps & tools.
- Synced the latest published page versions and required assets into the existing website source branch, then pushed commit `a5bfb89d42add6f6dbedc6b1191ea377054c69f1` to `feat/tools-directory-start-links-product-stories-20261009`. PR #2 remains open; GitHub reports no checks, and no merge was performed.
- The abandoned drafts `6ac960bb650074be4a34fcd5` and `6ac96170a3371b4a38fa42af` remain stuck but are superseded; neither was published or used as a rollback target.
