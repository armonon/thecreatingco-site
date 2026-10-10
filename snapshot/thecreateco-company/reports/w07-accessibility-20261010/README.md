# W07 — live mobile keyboard / first-action audit

Observed 2026-10-10 13:13 UTC on the public site, using installed Google Chrome through `/Users/agentsattari/code/weblab/node_modules/playwright-core`. Routes: `/`, `/tools/`, and `/products/luma/`. This is browser evidence, not a general accessibility score or release qualification.

## Reproduce

From this directory, run:

```sh
node audit.mjs
```

The script uses 390×844 and 320×844 phone viewports, then 1440×900 desktop. It writes `evidence.json` and viewport screenshots. It does not submit forms, change site data, install dependencies, or edit product source. The JSON's `htmlSha256` is a hash of Playwright's serialized post-load DOM (`page.content()`), not the raw HTTP response body.

## Results

- All three routes returned HTTP 200 at both phone widths. `documentElement.scrollWidth` equaled `clientWidth` (390/390 and 320/320); no horizontal document overflow was measured.
- Homepage first main actions are named “Try Form Studio ↗” and “Join the launch list ↗”; each is 350×51 at 390px and 280×51 at 320px. The first is fully visible and in the initial viewport at both widths.
- `/tools/` first main action is “Find your tool ↓” (173×50 at both widths). The two featured product links have discernible visible labels. Their layered bounding boxes overlap: 26,981 px² at 390px and 12,805 px² at 320px. `elementFromPoint` in the overlap resolves to the foreground Luma link (`/products/luma/`), not Form. Screenshots confirm that the overlap is visually intentional card layering; this is therefore recorded as a concrete touch-target ambiguity/usability issue, not a WCAG conformance verdict. Recommendation: review whether the Form link should remain reachable across the visibly covered portion; if so, separate mobile hit regions or adjust stacking while retaining both card actions.
- `/products/luma/` first in-main links are the breadcrumb links (24px high inline text); the next actions are “Try it” (61×44) and “Features” (82×44) at 390px, and “Try it” (61×44) / “Features” (82×44) at 320px. The 44px project touch-control target is met by these buttons/CTAs; the smaller breadcrumb text links are not being labeled a failure here.
- Desktop Tab navigation on each route begins with a visible “Skip to content” link; the first 18 tab stops all reported `:focus-visible` and a solid outline. The trace stays in a sensible header-to-page order; no hidden stop appeared in the sampled sequence.
- At 390px on all three routes, keyboard Enter opens the native Site menu disclosure. Tab enters at the named “Close site menu” button, then Escape closes the menu and focus returns to the “Site menu” summary. Keyboard activation of the close button also leaves focus on the summary. No menu-activation, Escape, or return-focus defect was reproduced.

## Interpretation and limits

This was deterministic browser interaction and geometry inspection, not a screen-reader/manual assistive-technology audit. Name reporting uses visible text/ARIA attributes as a practical DOM approximation; it is not a complete computed accessibility-tree audit. The script records a count of DOM candidates with zero/hidden geometry for diagnostic context; that count alone does **not** establish keyboard reachability or a defect (native closed disclosures and hidden panels contribute). The desktop trace is 18 stops per route, and the phone menu test is focused on the shared disclosure. No physical phones, zoom/reflow beyond the specified widths, color-contrast sampling, voice control, or form submission was tested. The script is reproducible evidence, not a substitute for those checks.

## Source limitation / next action

`source-reconciliation.json` records HTTP 200 for each live route and confirms that each live raw HTML hash differs from clean checkout `a5bfb89d42add6f6dbedc6b1191ea377054c69f1`. The checkout was initially clean. Consequently, do not implement a live repair from that mismatched checkout. Next: reconcile the exact currently deployed marketing source/build, then review and, if appropriate, correct the featured `/tools/` card hit-region overlap at phone widths; rerun this audit against the matched candidate before any release.

## Evidence files

- `audit.mjs` — reproducible Chrome / Playwright script.
- `evidence.json` — per-route viewport dimensions, HTTP status, serialized DOM hash, overflow, first actions, menu keyboard behavior, and desktop focus trace.
- `source-reconciliation.json` — live-vs-checkout raw response hash comparison, supplied by the director.
- `home-390.png`, `home-320.png`, `tools-390.png`, `tools-320.png`, `products-luma-390.png`, `products-luma-320.png` — initial-viewport screenshots.

## Director checkpoint / handoff

Sol director with requested bounded OpenAI `gpt-6-luna` native worker capsule; exact child minor runtime/usage was not independently exposed. Deterministic Playwright/HTTP/Python operations performed measurements and verification; no Astra. Cost preflight returned advisory continue with unset limits: no new spending authority inferred. Company/lab PAUSE absent; no expired leases recovered. Commissioning proof already COMPLETE, not repeated. P1 WEBLAB-MVP-001 claim rejected by existing product execution hold; highest eligible W07 claimed by company-director.

Director verification PASS: 6 phone HTTP200/no-overflow observations, 54 sampled focus-visible solid-outline desktop stops, 3 successful keyboard menu journeys, 3 fresh live/source mismatches. Independent hit tests reproduced Form/Luma overlap at both phone widths (director-hit-verification.json). Assertions and evidence SHA-256 manifest retained in director-verification.json. These limited checks are not full accessibility or product/release qualification.

**Status: BLOCKED for integrated repair.** Audit completed; overlapping linked cards merit usability review, not a fabricated WCAG failure. All three deployed route sources differ from checkout, so no repair was applied or claimed. Resume after exact deployed source/build reconciliation, then review and qualify any narrow mobile hit-region change.

No task-owned product code edit or commit resulted. Checkout remained clean at `a5bfb89d42add6f6dbedc6b1191ea377054c69f1`; **no push was needed**. Audit scripts are report evidence, not maintained company-engine changes. No task branch/remote SHA receipt, merge, deployment, release, form submission or external message.
