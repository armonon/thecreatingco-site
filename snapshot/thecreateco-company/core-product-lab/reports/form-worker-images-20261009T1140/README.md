# Form Worker image binding repair

Task `CORE-FORM-WORKER-IMAGE-BINDING-001` · branch `fix/form-worker-images-20261009` · checkout `/Users/agentsattari/code/worktrees/form-worker-images-20261009`.

## Candidate

Base is exact source `be1f7272c5689d6401194d643fa3eb09a2b0b73b` (`fix/form-worker-images-20261009`). The isolated checkout is uncommitted and contains only these scoped source changes:

- `vite.config.ts` explicitly names the static-assets Fetcher binding `STATIC`; its build-derived directory is preserved.
- `worker/index.ts` uses `STATIC.fetch` to source optimizer images, declares `ASSETS` as `R2Bucket`, and supplies `STATIC` to vinext's app-router static fallback under vinext's expected `ASSETS` property. The Cloudflare `cloudflare:workers` environment still exposes the original `ASSETS` R2 bucket to project-asset API routes.
- The optional `IMAGES` binding installs `transformImage` only when present. If absent, vinext's validated passthrough path returns original bytes: it does **not** resize or transcode.
- `package.json` and `scripts/test-worker-image-binding.mjs` add `npm run test:worker:images`, a bounded local emitted-Worker regression test. It runs only local Wrangler bindings and synthetic fixtures/identity; it cannot use remote D1/R2 or paid Images.

No queue, shared checkout, dependencies outside this worktree, lockfile, commit, push, PR, deployment, remote binding or paid service was changed/used. No merge/release qualification is claimed. The `ASSETS` R2 name and authenticated CRUD behavior are preserved.

Candidate identity: `git diff --binary` SHA-256 (tracked delta) `e60afeff75b7b331ef486c4504e72387cde844637fc592b2d17045198183c565`. File SHA-256:

| File | SHA-256 |
| --- | --- |
| `worker/index.ts` | `4283c69bf2ec961ac23c9cb7bcf6aa554452cf8c9c75b6d33c0d1363d2107ff9` |
| `vite.config.ts` | `a59955895d7f6aef79d5d4aff17604388c81cdc677abbcf86bff2bbabf787c94` |
| `package.json` | `458ed1a1d410f007ccb8cd5442ac40395e1c4e799dfed9c1059912eff213bd9f` |
| `scripts/test-worker-image-binding.mjs` | `08fb5b0c24c0b4e4f2436da796c37f787cd846c8d84886860ab47af900967332` |

## Reproduction and verification

Environment at preflight: macOS 15.2 arm64 / Apple Silicon, Node `v26.9.0`, npm `11.19.1`, Wrangler `4.148.0`; about 39.4 GiB free. `director-preflight.json` records task/base, pauses, model route and available capacity; `cost-preflight.json` records no set daily/weekly spending limit and no spend request. This implementation child was spawned with `openai/gpt-6-luna`; no fallback was used. Root Sol directed the work and an independent Sol review was requested. No paid access was made.

1. Isolated dependencies: `npm ci` — **exit 0**, log `npm-ci.log`.
2. Pre-fix web baseline: `npm run build` — **exit 0**, log `baseline-web-build.log`.
3. Pre-fix emitted Worker: `npx wrangler dev --config dist/server/wrangler.json --port 1448 --local` — local Wrangler only; stopped by Ctrl-C (**exit 130**). `baseline-worker.log` records the actual runtime error. Direct static PNG returned **200**; `/_vinext/image?url=%2Fimage-worker-fixtures%2Fone.png&w=0&q=75` returned **500** with `TypeError: env.ASSETS.fetch is not a function`. Wrangler identified `ASSETS` as an R2 Bucket and the emitted config had no explicit static Fetcher binding.
4. Repair typecheck: `npm run typecheck` — **exit 0**, `typecheck.log`.
5. Repaired web build: `npm run build` — **exit 0**, `repaired-web-build.log`. Emitted `dist/server/wrangler.json` declares `assets.binding: STATIC` alongside `r2_buckets[].binding: ASSETS`.
6. Repaired actual Worker: local Wrangler on port 1449 returned PNG **200**, exact same 67 bytes and SHA-256 `1b02976117de50b34e651cfe53b1190fb8a714943ea418a63071e921f57edf9d`; default CSP, `nosniff`, inline disposition, immutable cache and `Vary: Accept` were present. External and scheme-relative URLs, disallowed width, SVG and non-image returned **400**. Authenticated project-asset API produced POST 200, GET byte-identical 200, DELETE 200 and GET-after-delete 404 using local R2 and synthetic D1 schema. Full receipts: `repaired-worker.log`, `local-d1-fixture.log`.
7. Durable regression: `npm run test:worker:images` — **exit 0**, final hardened run in `worker-image-regression.log`. It starts the emitted Worker under Wrangler with a temporary local persistence directory, uses an ephemeral loopback port, fetch timeouts and bounded SIGTERM/SIGKILL cleanup, then deletes its fixtures/state. It asserts emitted binding identities; static route bytes; optimizer PNG status/bytes/headers; positive allowed width `16` with `Accept: image/webp` still returning original PNG type/bytes when Images is absent (no transformation claim); external/scheme-relative URL, invalid width, SVG/non-image/missing-source policy; authenticated ASSETS R2 CRUD; 401 without identity; and that the STATIC binding cannot proxy the authenticated R2 route (404).
8. Desktop web build: `npm run desktop:web:build` — **exit 0**, `desktop-web-build.log`. This is the desktop frontend build, not native bundle qualification.
9. Full checks: `npm run check` — **exit 0** (typecheck and repository-wide lint), `npm-check.log`.
10. Focused existing tests: `node --experimental-strip-types --test tests/project-asset-access.test.mjs tests/project-assets.test.mjs` — **exit 0**, 4/4 passed, `project-asset-tests.log`.
11. Earlier targeted `npx eslint worker/index.ts vite.config.ts scripts/test-worker-image-binding.mjs` and `git diff --check` — **exit 0**, `lint-targeted.log` plus command receipt above.

Synthetic fixture hashes used by the local Worker regression:

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| 1×1 PNG | 67 | `1b02976117de50b34e651cfe53b1190fb8a714943ea418a63071e921f57edf9d` |
| SVG with script element (rejected by default policy) | 92 | `9ad0d9be2d8b13b2a9d892f4419ead146b33b3a16067dc8f4de82eca8b78d314` |
| non-image text | 12 | `5464533c9647b67eb320c40ccc5959537c09102ae75388f6a7675b433e745c9d` |
| synthetic R2 body | 24 | `f95fb42b0a604b83804b62d06027dad0ceb12283d0c91803a7df8fe550ceb9f0` |

## Product workflow coverage

Also ran the existing synthetic real-browser workflow from `reports/form-golden-20261008T0310/browser-workflow.cjs`, copied to `browser-workflow.cjs`, changing the port and using `/studio` because `/` is the current marketing page. All assertions passed: SVG sketch → 40 mm → exact 12 mm extrusion → brass → undo/redo → save → close browser → launch a fresh browser context → reopen and compare project fields → STEP/GLB download validation. `browser-workflow.log`, `browser-workflow-result.json`, `reopen-checkpoint.json`, `golden-bracket.form`, `golden-bracket.step`, `golden-bracket.glb` and screenshots retain receipts. This is one synthetic authoring workflow, not complete product/release certification or live production evidence.

The first run against `/` timed out on the old “Blank precision part” selector before editing; `/` is the landing site now. The captured tool output and original port-only command are preserved in `browser-workflow-initial-failure.log`. No assertion was weakened: the existing workflow was pointed at the studio route and then passed unchanged. No page errors were reported in the successful run.

## Review handoff

An independent reviewer has been sent the exact base, candidate file hashes and report location. This worker did not commit or push; parent owns the next independent review and branch/PR decision. No deployed, merged, CI, native, production, paid-Images or customer-data behavior is claimed.

## Director completion — 2026-10-09T11:50:11.432951+00:00

The preceding implementation handoff describes the precommit state. Parent Sol subsequently verified all four independently approved source hashes unchanged, committed **b5f8b08832dc7961b097ce2ae7a0c29db2fc0055**, verified a clean checkout and matching remote head, and pushed draft [PR9](https://github.com/armonon/form-studio/pull/9) on PR7. Independent scoped OpenAI review is recorded in `independent-review.md`; seven additional dependency smoke checks passed. Full check and four focused asset tests completed successfully after the review handoff. No source edits followed independent review; build/runtime/browser evidence maps to these exact committed source contents. Native bundle/full unit/full golden/IMAGES-present transforms remain untested in this cycle.

**Task checkpoint BLOCKED**: exact-head hosted `web` and `native-macos` failed without starting; `desktop-artifact` skipped. Both annotations state recent account payments failed or spending limit needs increase (`pr-state.json`, `hosted-annotations-*.json`). No billing change, rerun, merge or deployment. Resume only after concrete access/billing-resolution evidence, then bounded exact-head normal checks and complete downstack review; native/full-product/source-live gates remain. Narrow Worker reliability repair is implemented/tested/reviewed/pushed, not release-qualified.

Actual routing: Sol director, explicit native Luna routine executor, independent native Sol reviewer; no fallback/Astra/Claude. Existing authorized OAuth execution only; unknown monetary budgets were not interpreted as new spending authority. `director-completion.json` records source/remote identity and command exit results.
