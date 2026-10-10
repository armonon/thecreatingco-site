# W08 live performance baseline — 2026-10-10

## Scope and method

Measured `https://thecreatingco.com/`, `/tools/`, and the verified Luma product page `/products/luma/`. Each route ran three times at 1365×900 desktop and 390×844 mobile (DPR 1), headless Google Chrome 154.0.8037.99 through Playwright Core 1.64.0. Mobile used `isMobile`/touch emulation. Navigation waited for `load`, then sampled after 1.5 s. Network was unthrottled with no interception. Every run used a new browser context; HTTP cache was not explicitly disabled and OS/network/CDN caches may be warm. These are local browser navigation measurements, not lab-throttled or guaranteed cold-cache results. No forms were submitted.

FCP and LCP are from the Navigation/Performance APIs. CLS is the observed sum of layout-shift entries without recent input during the page sample window, **not** a full-page field CLS guarantee. Resource transfer is the sum of `transferSize` for observed resource entries; it is distinct from compressed response payload alone. Errors include uncaught page errors and console errors. The 3×6 detailed observations and resource lists are in [measurements.json](measurements.json); one-pass LCP attribution and image render dimensions are in [lcp-attribution.json](lcp-attribution.json). Run code is [measure.js](measure.js).

## Three-run median

| Route | Viewport | FCP ms | LCP ms | CLS sample | Load ms | Resource transfer | Resources |
|---|---|---:|---:|---:|---:|---:|---:|
| `/` | desktop | 488 | 488 | 0.0046 | 786 | 435,057 B | 65 |
| `/` | mobile | 292 | 292 | 0.0000 | 533 | 345,560 B | 64 |
| `/tools/` | desktop | 680 | 680 | 0.0164 | 1,192 | 816,319 B | 60 |
| `/tools/` | mobile | 596 | 596 | 0.0000 | 746 | 366,634 B | 54 |
| `/products/luma/` | desktop | 436 | 592 | 0.0196 | 919 | 732,252 B | 75 |
| `/products/luma/` | mobile | 384 | 400 | 0.0000 | 842 | 688,385 B | 76 |
All 18 page navigations returned 200 and had zero captured page/console errors. The corrected collector records the final LCP candidate on each individual run; candidates agreed per route/device and are attached per-run in `measurements.json`. Home uses `/assets/hero/creative-journey.jpg` (1536×672, 79,525 B transfer in run sample, high priority; mobile rendered 350×153); tools uses `/assets/workflows/form-technical.png` (1280×720, 126,109 B, 440×297 desktop / 251×169 mobile, auto priority); Luma selects responsive `luma-1280.webp` desktop and `luma-640.webp` mobile (high priority). Luma desktop image source is 682×383 rendered at 1242×699, an upscaled hero. Exact observations from an independent LCP/image probe are in the attribution artifact; per-run final LCP candidates from the full measurement are in measurements.json.

## Largest measured issue and actionability

`/tools/` has the largest measured route payload at 816,319 B desktop (median), 60 resources, with several above-the-fold tool-card captures. The top transfer is `form-technical.png` at 126,109 B; the next listed capture is `scenepilot-timeline.png` at 94,055 B. The LCP image is not configured high priority and it is also reused in a below-fold lazy card. Reasonable follow-up: compare image byte savings from a visually reviewed responsive WebP/AVIF derivative and explicitly prioritize only the first visible card image; retain the lazy duplicate. The LCP observer confirms this same 126 KB image is the LCP candidate in all six `/tools/` runs, even where its LCP timestamp equals FCP. Luma desktop's 682×383 high-priority hero is upscaled to 1242×699; inspect a true full-resolution candidate and compare bytes and visual quality. The recorded desktop Luma CLS median is 0.0196; the observed shift source entries primarily include navigation/header action geometry, but no source edit is justified before reconciling live and checkout markup.

A narrow report-only asset candidate was prepared because this LCP asset itself is byte-identical in live and checkout: [form-technical-jpegtran.jpg](form-technical-jpegtran.jpg). The input hash is `d08e3b05f67a18c02757ee2295bd9352f28c7483dd86a06c0797616d3439a04a` on both sides. It is JPEG data despite its `.png` suffix; the live response serves `Content-Type: image/png` and `X-Content-Type-Options: nosniff`. `jpegtran -copy all -optimize -progressive` yields a 123,462-byte candidate from 125,809 B (2,347 B / 1.9% smaller) with decoded RGB pixels byte-identical (`ffmpeg` raw RGB `cmp`, exit 0). The candidate alone is not applied: deploying it under a proper `.jpg` MIME URL requires changing references, but live route HTML does not match checkout HTML. Changing extension or MIME without matching deployed references is not justified. The comparison artifacts also include lossless WebP (345,618 B) and q95 WebP (168,166 B) encodings, both larger than the original; the JPEG candidate offers only a modest route-byte reduction. The live HTML response hashes are not the current checkout source hashes, so local markup edits cannot be safely attributed to live output. Live SHA-256: `/` `e327e97b7c56f671117838648519ca8e7c71fd1fb592cf5e37384f25a1db2409`; `/tools/` `5956e58d26a5a2fc85741a6a6d645e31fa817159c9cb5ff1883a34bdfa9348bb`; `/products/luma/` `bfb41be4ab6ee93bc16d4d94c0b07ba5dfc18c2962329ef2a1c395d41986e096`. Checkout is clean at `a5bfb89d42add6f6dbedc6b1191ea377054c69f1`. The reversible JPEG candidate remains report-only; no checkout files were modified.

## Route verification and next action

`https://thecreatingco.com/luma/` returns HTTP 404 (23,407 B response; `curl -L` effective URL remained `/luma/`). The correct verified product route is `/products/luma/` (200). Do not treat the root `/luma/` 404 as a performance regression or modify routing based on this baseline. Next: reconcile the currently deployed source for `/tools/` and `/products/luma/` with this checkout, then test a responsive image candidate in isolation, compare visual quality and bytes, and repeat the same browser protocol before proposing a source change. No deployment, staging, or commit was performed.

## Environment / commands

Checkout `/Users/agentsattari/code/wave2/thecreatingco-live`, branch `feat/tools-directory-start-links-product-stories-20261009`, clean at baseline commit above. Chromium: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --version`; Playwright module reused from `/Users/agentsattari/code/weblab/node_modules/playwright-core` (no install). Route checks used `curl -L -sS -o /dev/null -w '%{url_effective} %{http_code} %{size_download} %{time_total}\n' URL`. Browser protocol is reproducible using `node /Users/agentsattari/thecreateco-company/reports/w08-performance-20261010/measure.js`.

## Director checkpoint / durable handoff

Scheduled director runtime verified as `openai/gpt-6.1-sol`; native worker explicitly requested `gpt-6-luna` with bounded W08 capsule. The child reported GPT-6 Codex identity without an exposed minor variant, so exact child runtime/usage remains unverified. No Astra used. Cost preflight was advisory continue; limits unset, no new spending authorization inferred. PAUSE absent; no leases recovered; commissioning proof already COMPLETE. WebLab exact-ID claim refused by existing fencing; W08 exact-ID claimed under company-director.

Director independently validated 18/18 HTTP200 observations with no captured errors, per-run LCP attribution, live/source asset byte identity, and candidate decoded RGB identity with ffmpeg. Receipt: director-verification.json. Browser metrics remain short unthrottled samples, not release or field-performance qualification.

**Task status: BLOCKED** for integrated optimization: all three live HTML hashes differ from checkout; tools/start rollback must remain preserved. Baseline and isolated candidate checks passed, but candidate was not applied or timed in a changed page. Reconcile exact deployed route source before changing image references/MIME or claiming performance improvement.

Checkout remained clean at `a5bfb89d42add6f6dbedc6b1191ea377054c69f1`, branch `feat/tools-directory-start-links-product-stories-20261009`. No task-owned product code edit or commit resulted; no push was needed. Report-only collector and candidate are task evidence, not maintained company-engine code. No remote SHA receipt was generated by this task; no merge, deploy, release or external messages.
