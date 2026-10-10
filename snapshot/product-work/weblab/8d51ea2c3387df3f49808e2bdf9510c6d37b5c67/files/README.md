# WebLab — local website checkup prototype

WebLab is a standalone alpha for the requested “Fix/check my website” workflow. Its public alpha footer links to The Creating Co. Start with Node 22 or newer:

```sh
npm ci
WEBLAB_CHROMIUM_PATH="/path/to/Chrome-or-Chromium" npm start
```

Open `http://127.0.0.1:4177`. The server always binds to IPv4 loopback; `WEBLAB_HOST` cannot expose the unauthenticated URL-fetch API on a network interface. If no Chrome/Chromium executable can be found by Playwright, metadata/link checks still run and browser-only checks are explicitly marked unavailable.

## Current checks

- One homepage response: status/content type, title, description, viewport, canonical, headings, language, social metadata, image alternatives, link names and structural form labels.
- Up to 24 distinct links found on that page, checked concurrently with bounded response sizes and timeouts.
- Automated axe-core WCAG 2.0/2.1 A/AA and best-practice checks on a reconstructed, inert semantic copy of the returned HTML. Remote scripts, event attributes, SVG, embedded content and URL-bearing attributes are omitted; a per-run CSP nonce allows only the local axe engine.
- Static CSS layout overflow at 320, 375, 768, 1024 and 1440 CSS pixels.
- A single server-side HTML GET duration. It is **not** Lighthouse, a Core Web Vitals report or a regional speed score.
- A downloadable JSON checkup. URLs have query strings and fragments stripped from the saved/displayed report to avoid exposing common tracking/session tokens.

## Safety and honest coverage

The checker rejects non-HTTP(S), credential-bearing, localhost and non-public IP targets (including IPv4-mapped IPv6), resolves DNS and pins validated public addresses for each request, and revalidates redirects. Requests have response-size, absolute-time, idle-time and redirect limits. The server accepts only two concurrent scans and applies a local rate limit. The browser audit uses an isolated page with network access blocked; only a bounded stylesheet sample is inlined. It does not sign in, submit forms, click destructive controls, change website files, or call site write APIs.

This is an **alpha tool**, not a launch-readiness certification. It checks one page, not a full sitemap/crawl. Form submission/validation, authentication, JavaScript-driven behavior, real-user performance/Core Web Vitals, source-level SEO, cross-browser/device and deployment checks are not exercised. Findings are evidence plus suggestions; they are not automatically applied. A zero-finding report means only that no issue was found in the checks that ran.

## Development

```sh
npm ci
npm run check
npm test
WEBLAB_CHROMIUM_PATH="/path/to/Chrome-or-Chromium" npm run verify:local
WEBLAB_CHROMIUM_PATH="/path/to/Chrome-or-Chromium" npm start
WEBLAB_CHROMIUM_PATH="/path/to/Chrome-or-Chromium" npm run verify:workflow
```

`verify:local` is the independent local gate (syntax, unit/security tests and production dependency audit). When `WEBLAB_CHROMIUM_PATH` is provided it also runs the hostile-HTML browser regression; otherwise that one browser-dependent unit test is explicitly skipped. `verify:workflow` requires the local server and browser, and exercises a real read-only scan/report download.

## Netlify preview runtime

`netlify.toml` publishes only `public/` and routes `/api/audit` to the Netlify Function in `netlify/functions/`. The hosted function uses tighter time/link budgets and a per-instance in-memory rate limit. It intentionally does **not** claim responsive or accessibility browser QA because a headless browser is not bundled in the function; those checks remain unverified in the hosted runtime. The UI reports that limitation instead of inventing a pass. Use `netlify dev --offline` to exercise the function locally. The preview is marked `noindex`; this does not make the URL private.

The intended deployment is a separate, unlisted Netlify draft preview; it does not use a custom domain, production site, or account integration. A `noindex` response is not an access-control boundary.
