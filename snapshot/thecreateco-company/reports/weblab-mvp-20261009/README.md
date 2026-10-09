# WebLab local prototype — verification record

**Date:** 2026-10-09 15:31 UTC  
**Status:** ALPHA / isolated Netlify draft preview deployed; not production and not a release candidate  
**Source:** `/Users/agentsattari/code/weblab`, branch `codex/weblab-mvp`  
**Commits:** `28b259727b180db5fcbc504be8d481cf1cc50620` (prototype), `d0e6f9dfe11b7eafebb9cf9ada5cc94a6a2cbac0` (stylesheet-coverage disclosure), `5baaf8f9d25258a8dbf661cc75a60c1d68abdf46` (loopback-only), `d028ab490fa941185725463e8bd41322198f0f22` (local verification gate), `f3bd2dac35eb6a912be59db2747efeb75d1f2c92` (server/rate-limit regression), `808cd644d6e7fa88d7aad1d826ff5e48a6c2e5af` (Netlify static/function runtime).  
**Remote:** <https://github.com/armonon/weblab> (private). Feature branch `codex/weblab-mvp` pushed. Draft PR [#1](https://github.com/armonon/weblab/pull/1) is open against `main`; not merged. No Actions workflows exist and no hosted checks ran.  
**Preview:** Draft Netlify deployment at <https://6ac90820c15d9115073c0953--weblab-preview-tcc.netlify.app> from commit `808cd644d6e7fa88d7aad1d826ff5e48a6c2e5af`, site `weblab-preview-tcc` (site ID `f34fdaf5-0672-431e-a085-9349631cc7b8`). This is a publicly reachable, unlisted/noindex preview URL, not private access control; no custom domain and no production alias were changed. The existing `thecreatingco.com` site was not touched.

## Implemented

- A local-first “Fix/check my website” interface with categorized evidence, scoped fix suggestions and JSON report download.
- Bounded, read-only public homepage audit: SEO and metadata, accessible names/structural form labels, up to 24 unique links, up to 6 linked stylesheets, static responsive overflow at five widths, and local axe-core WCAG checks.
- SSRF defenses: HTTP(S) only, no URL credentials, public DNS/IP validation (including IPv4-mapped IPv6), pinned DNS answers, redirects revalidated, bounded response sizes, idle and absolute request time limits, 5 redirects maximum.
- Browser isolation fix after an independent review found hostile-HTML execution: remote HTML is reconstructed from a semantic inert allowlist, event/script/SVG/embedded nodes and URL-bearing attributes are excluded, network is blocked, and only local axe is allowed via a per-run nonce.
- Per-scan concurrency tokens; query and fragment values are stripped from report URLs/evidence. Scans never submit forms or alter site content.
- Reports explicitly flag omitted/failed stylesheet coverage so a partial CSS sample cannot be mistaken for complete responsive qualification.
- Netlify hosting adaptation: static app in `public/`, `/api/audit` serverless function, tighter serverless request/link/style budgets, and explicit no-browser-coverage messaging. Security headers include CSP and `X-Robots-Tag: noindex, nofollow, nosnippet`. The local Node server delegates to the same bounded request handler.

## Local verification (exact candidate)

Browser executable used: `/Users/agentsattari/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` (Chrome for Testing 153.0.8010.12), Node `v26.9.0`.

- `WEBLAB_CHROMIUM_PATH='<path above>' npm run check` — PASS, syntax checks.
- `WEBLAB_CHROMIUM_PATH='<path above>' npm test` — PASS, 5/5 tests. Includes private/special IPv4/IPv6 rejection; hostile HTML, base-URL and token-redaction regression; loopback-only binding, private-target rejection and rate limiting.
- `WEBLAB_CHROMIUM_PATH='<path above>' npm run verify:local` — PASS at exact head `808cd644d6e7fa88d7aad1d826ff5e48a6c2e5af`: check + 6/6 tests + production audit 0 vulnerabilities.
- `npm audit --omit=dev --audit-level=high` — PASS, 0 production dependency vulnerabilities reported.
- `WEBLAB_CHROMIUM_PATH='<path above>' npm run verify:workflow` — PASS at `2026-10-09T14:42:05Z` on exact pushed head `f3bd2dac35eb6a912be59db2747efeb75d1f2c92`: actual UI input → scan → findings → mobile viewport → JSON download; no page errors; WebLab landing page had 0 axe violations and no 320px horizontal overflow.
- Read-only live audit of `https://thecreatingco.com/` at `2026-10-09T14:42:09Z` — HTTP 200; 24 links checked; 2 forms found, 0 submitted; 5 viewport widths checked with no static overflow; initial HTML response measured 68 ms in this single run (not a speed score). Full sanitized output is `live-site-check.json`.
- Live static axe findings: 2 serious rule groups (`aria-prohibited-attr`, `color-contrast`) and 3 moderate groups (`landmark-no-duplicate-banner`, `landmark-unique`, `region`). These are findings to verify against the live interactive experience, not automatic fixes.
- `WEBLAB_CHROMIUM_PATH='<Google Chrome.app path>' CI=1 npx --yes netlify-cli@latest build --offline` — PASS at exact head `808cd644d6e7fa88d7aad1d826ff5e48a6c2e5af`; 6/6 tests and one function bundled.
- `WEBLAB_URL='http://127.0.0.1:8888' WEBLAB_EXPECTED_LINKS=16 WEBLAB_EXPECT_BROWSER=unavailable WEBLAB_CHROMIUM_PATH='<Google Chrome.app path>' npm run verify:workflow` — PASS at `2026-10-09T15:28:01.626Z` against Netlify Dev: 16 links, 2 forms, none submitted, no site files changed, browser checks correctly unverified, no UI page errors, landing axe 0, no 320px overflow.
- Draft deploy CLI build/upload — PASS at 2026-10-09 15:28 UTC for deploy `6ac90820c15d9115073c0953`; uploaded 4 static files and one function, no `--prod` flag.
- Live preview smoke checks — GET `/` HTTP 200, CSP and noindex headers present. POST `/api/audit` blocked `http://127.0.0.1` with HTTP 422. A read-only audit of `https://thecreatingco.com/` returned HTTP 200, 16 links checked, 2 forms found, 0 submitted, browser status `unavailable`, 4 findings; no site files changed.

## Unverified / limitations / next work

- PR #1 is open as draft. The new repository has no GitHub Actions workflows or required status checks yet; establish independent CI/release gates before merging. Local verification is not hosted CI. Netlify draft deployment is not production release.
- This alpha checks one homepage only, not a crawl/sitemap. It does not sign in, submit or validate production forms, exercise JS-driven routes, apply fixes, access source repositories, audit authenticated paths, verify multiple browsers/devices, run Lighthouse/Core Web Vitals, or qualify launch readiness.
- CSS coverage is sampled (maximum six linked sheets; imported CSS is not followed). Large link targets over the cap are reported unchecked rather than labeled broken.
- Review the live accessibility findings manually with interactive content enabled; scanner intentionally removes remote JavaScript and reconstructs safe semantics, so carousel/dynamic behavior is outside current coverage.
- No automatic site mutations, custom domain, production alias, accounts or paid services were used. The preview is internet-accessible despite noindex; do not place private URLs or data in it. Current anonymous per-instance rate limiting is not a durable global quota. Add cross-instance abuse controls before a broader public launch.
- Netlify draft preview lacks a headless browser, so responsive and axe checks on audited targets remain unverified there. Hosted page scanning can still inspect static metadata/forms/links. It does not guarantee function cold-start/runtime behavior under load, multi-region performance, or full interactive UI coverage. No GitHub CI result is claimed.
