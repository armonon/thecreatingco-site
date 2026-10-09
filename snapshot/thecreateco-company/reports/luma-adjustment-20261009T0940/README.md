# Luma adjustment variant qualification — 2026-10-09

Task `CORE-LUMA-ADJUSTMENT-VARIANTS-001`; bounded evidence-only qualification on exact source `8c15f8537c1176b7d4c0076182b7501c92f714b5` (`app/engine/renderer.ts` SHA-256 `1ef23da681e8159d1cefcf65a071dc5470b887dee4b7a027564af2078cb88bad`). Checkout: `/Users/agentsattari/code/company-worktrees/luma-adjustment-20261009T0940`, branch `qualification/luma-adjustment-20261009T0940`; clean tracked worktree. No application source edits. Runtime: macOS arm64, Node v22.23.2, npm 10.9.8. Lockfile SHA-256 `845481a71d7b1f28628a936585d5a4d5d2f614d069a90d2aabecd5bac3195c6d`; fresh `npm ci` added 578 packages / audited 579 and reported 13 existing dependency advisories (3 moderate, 10 high). Build workspace had 41 GiB free at end. No additional paid API/service invocation or spending commitment. Native OpenAI Luna executed deterministic qualification under Sol direction; billed model cost/usage is unknown.

## Exact commands and results

| Command | Result |
|---|---|
| `/opt/homebrew/opt/node@22/bin/npm ci` | exit 0; fresh lockfile-pinned dependencies installed; 13 audit advisories reported, no audit fix run |
| `/opt/homebrew/opt/node@22/bin/node --import tsx --test tests/adjustment-composite-alpha.test.ts` | exit 0; 7 passed, 0 failed |
| `/opt/homebrew/opt/node@22/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false` | exit 0 |
| `/opt/homebrew/opt/node@22/bin/npm run build` | exit 0; all five Vinext build phases complete; warnings: large chunks, `module` externalization, some routes unclassified |
| `node_modules/.bin/esbuild build/qualify-adjustment-variants.ts --bundle --platform=browser --format=iife --global-name=LumaVariants --outfile=<report>/adjustment-variants-browser-bundle.js` | exit 0 |
| `/opt/homebrew/opt/node@22/bin/node run-browser.mjs` | Chromium 153.0.8010.12: 24/24 existing renderer cases, 0 page errors |
| `/opt/homebrew/opt/node@22/bin/node --import <worktree>/node_modules/tsx/dist/loader.mjs variant-probe.ts` | expected regression-oracle exit 1: 6 of 15 synthetic samples fail alpha-coverage equality; complete outputs/assertions retained in `variant-probe.log` and `.json` |
| `/opt/homebrew/opt/node@22/bin/node --import <worktree>/node_modules/tsx/dist/loader.mjs persistence-roundtrip.ts` | exit 0; synthetic 1×1 Multiply adjustment project archived (1,109 bytes), reopened, exact rendered RGBA reproduced; blendStack and invert metadata preserved |

The first bundling attempt invoked the native esbuild binary with Node and failed with a syntax error (log `browser-bundle.log` was overwritten by the successful `.bin` invocation, so that transient error is preserved in the run transcript only). A first browser matrix attempt also stopped because Firefox 1543 is not installed; Chromium was rerun alone and passed. Firefox/WebKit are unknown for this run, not passes.

## Measured variant outcomes

Synthetic source pixel `[80,120,160,alpha]`, alpha values 64, 160, 255. The test's coverage oracle expects color adjustments and an enabled but zero-opacity/no-op effect not to alter backdrop alpha. It was not relaxed:

- Normal one-pass control preserved alpha at all three values.
- Multiply, one enabled pass: alpha delta `+48`, `+60`, `0` respectively.
- Two normal source-over passes at 50% each: delta `+45`, `+51`, `0`.
- Enabled zero-opacity drop-shadow/no-op style, which routes through styled legacy compositing: delta `+48`, `+60`, `0`.
- The configured BlendIf source white-cutoff case preserved alpha at all three values; only that specific cutoff/configuration was sampled.
- Save/reopen reproduced the Multiply regression exactly: source alpha 160 rendered to alpha 220 both before save and after reopen. This is a deterministic synthetic compositor/persistence qualification, not full UI dogfood.

The alpha-oracle repro script and its input generator are kept alongside the report, with output at `variant-probe.json`. The fixture is synthetic; no customer/media asset used. FullUI/native/hosted qualification remains unknown. Only Chromium's existing 24-case harness ran; new expanded variants ran through the deterministic Node canvas harness.

## Next action

Keep the task BLOCKED/incomplete pending a separately reviewed compositor fix or approved narrow semantics for legacy non-normal, multi-pass and styled paths. Add regression coverage for these exact alpha cases before changing expectations; rerun the new failing probe, focused suite, exact-head typecheck/build, persistence roundtrip, and available browser variants. Do not infer styled effects that visibly add coverage should preserve alpha; this probe deliberately uses an enabled transparent/no-op style only. Existing full UI/native/hosted gates remain separate.

## Director checkpoint

Actual models: OpenAI GPT-6.1 Sol director and native GPT-6 Luna executor; no fallbacks, no Astra invocation, no independent code-review claim (no source change). Cost preflight returned advisory continue, all monetary limits unset, partial telemetry; unset budgets were not spending approval. Parent reviewed the report, executable oracle, pixel results and persistence receipt. No new commit/push: exact reviewed PR9 source remains unchanged. Existing hosted billing/stack gates retained without retries. Legacy compositor source inspection matches the measured coverage inflation; full corrective semantics require independent OpenAI review before publishing a fix.
