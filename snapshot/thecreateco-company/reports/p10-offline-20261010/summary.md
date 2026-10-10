# P10 — offline/update/cache recovery audit (scoped evidence)

**Observed:** 2026-10-10, 16:11–16:15 UTC. **Status: partial / broader acceptance unresolved.** No product checkout changes, queue edits, commits, deployment, push, messages, or spend. Evidence is task-owned and disposable browser contexts were used.

## Target, provenance, and toolchain

| App | Public URL exercised | Local source identity | Checkout |
|---|---|---|---|
| Animate | `https://animate-thecreatingco.netlify.app/studio` | commit `2a9ec4936b13f77cfe21252db072e8669493e640` | clean |
| Portfolio | `https://portfolio-studio-384.netlify.app/studio` | commit `ae9a10e30204bcb9771272a48dc34a887b478693` | clean |

Source hashes (SHA-256):

- Animate `src/sw.ts` `0752dab501f779faefa1008a5fdfcbfa1bcb97ad297e7365d54083ba38864705`; `src/App.tsx` `ff2d6eead42c6f600e3a05ed6cadcbe2eeda6e6509172485bf7d3e2f8a6a7627`; `src/lib/idb.ts` `62090d3877dd073b6a0d09d5eff1354c6576d40e83888f70596fb3e18e984f6e`; `src/lib/use-pwa-update.ts` `7e07364f00e06187c463d5079aaec5899a7ec8d1a832ff4ce018c89f4758da99`; `src/components/UpdatePrompt.tsx` `2ff8a68ab624d75d636b669d0e57a932f93368000fd3679b3fbe90b154d6af6f`.
- Portfolio `src/sw.ts` `a9bad2f7e099c4cd15c2c20dd1aeeece40a7a865acb748640c6587176db7d346`; `src/App.tsx` `01b3a9ad98f6a0c3dd7a7bfa46d33e7a018638a78754057cbf537c7798e6bf41`; `src/lib/db.ts` `0652c7e92eda23b92b3599edee99663e618aef9a5a86f3010f8b98a620ce4bd1`; `src/lib/use-pwa-update.ts` `a3f72dbca644111245ff02656476247e121147082be7d17d9910130e512e7f80`; `src/components/UpdatePrompt.tsx` `4ce1e60a102c56d10af74145f59f7e5d44661aff6b259dd0dc9460fa6d2639d5`.
- Live `/sw.js` fetched 2026-10-10 16:11:56 UTC: Animate SHA-256 `b33ad4bc1b1bd844944886ea5240dc24e511c473289050efca258d82b92e633d`, HTTP 200, `Cache-Control: no-cache`, 26,330 bytes; Portfolio SHA-256 `0acf571173e7a017779d274ccc363fc39a430154c65beee6a25190668e14dee8`, HTTP 200, `Cache-Control: no-cache`, 26,456 bytes. These are deployed bundle hashes, not asserted to equal a local build.
- Playwright 1.63.0 reused from `/Users/agentsattari/openclaw/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright`; no install. Browser run command: `node /Users/agentsattari/thecreateco-company/reports/p10-offline-20261010/check.mjs > /Users/agentsattari/thecreateco-company/reports/p10-offline-20261010/browser-results.json` — exit 0. Raw per-app observations: [browser-results.json](./browser-results.json); disposable check: [check.mjs](./check.mjs).

## Expected vs observed

| Check | Expected | Observed |
|---|---|---|
| Initial live app and installability shell | Studio, manifest and a registering service worker load | Both production URLs returned HTTP 200, correct studio/title, manifest link `/manifest.webmanifest`; worker was `activating` on first visit and controlled the subsequent reload. |
| Offline reload | Previously visited app shell remains usable without network | With isolated context set offline, both `/studio` routes reloaded and remained rendered; worker controlled the offline-reloaded page. Animate still exposed editor UI and accepted an actual frame-0 brush stroke before reload. Portfolio's editor remained visible. |
| Unsaved-work preservation | A distinct user edit not exported/saved to a file remains after offline reload | Animate: drew one 4-point stroke, waited 1.5s for autosave, recorded IndexedDB layer/cel state, then offline-reloaded; after reload the autosave record still had one stroke/four points and the same layer/cel structure (`sameDrawing: true`). Portfolio: created a project titled `P10 unsaved recovery marker`, waited 1.2s for debounced autosave, offline-reloaded, and the unique marker remained visible in the editor (`markerPreserved: true`). Neither project was exported to a file. |
| Update does not silently interrupt edits | A new version waits until user explicitly chooses reload; show a waiting-update affordance and preserve work | **Not dynamically exercised.** In both live registrations, no new worker was waiting (`waiting:false`); no update prompt was displayed. Source review supports the intended gate: update prompts offer explicit Reload, registration hook invokes `updateServiceWorker(true)` only from that action, and source SW listener calls `skipWaiting()` only on `SKIP_WAITING`. This is source-level evidence only; current public deploy could not produce a second version without changing/deploying the site. |
| Runtime errors | No unhandled/page console errors during tested path | None observed for either app in this browser run. This does not imply broad browser/device compatibility. |

## Failures, limitations, and decision

- No check failure in the exercised live path. Animate first load initially reported its worker `activating`/not yet controlling; after the explicit reload, the worker controlled the page and offline reload worked. Portfolio likewise became controlled after reload.
- The Animate canvas wrapper contains no descendant canvas, so the browser check did **not** visually compare rendered pixels after the offline reload. It did verify the uniquely created stroke's autosave content (one stroke with four points, same persisted layer/cel structure) remained available; source describes IndexedDB autosave recovery. Portfolio's unique marker was verified in the offline-reloaded UI.
- The update acceptance criterion remains unproven end-to-end: no waiting-worker state was available. Forcing one on production would require publishing/changing the site and was deliberately out of scope. Source/deployed-bundle hash and source review cannot substitute for that scenario.
- This samples two newer apps only; it is not a portfolio-wide check across all non-music apps, nor does it test app-specific asset/media recovery, browser crash recovery, schema migrations, kill-switch, or update + active-edit interleaving. Therefore P10 should remain **partial/blocked for full acceptance**, not marked complete based on this sample.

## Next action

Use an isolated local fixture served from exact current source/build (or a disposable deploy with an approved two-version fixture) to stage v1 → v2 while an unsaved edit is open, assert v2 remains waiting and current app state/edit survives until explicit Reload, then reload and assert the edit remains. Repeat same scenario across additional non-music PWAs or establish a sample/coverage matrix with the director. Keep live PWA deployments untouched for this check.

No push is needed: only task-owned report/script/results were written; no product or operations source code changed.
