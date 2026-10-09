# Luma production dependency remediation — bounded director cycle

Date: 2026-10-07 Pacific / 2026-10-08 UTC. Cycle began 01:10 UTC; observations below collected during this run. Task `CORE-LUMA-AUD-005`, owner `director-20261008T0110-luma`. Company CLI claim token retained only for heartbeat/finish, not published here. No expired leases recovered. StemDeck and revenue work were actively owned and left alone. Core Lab `next` selected this eligible P0 task ahead of unrelated app experiments.

## Result / checkpoint

**BLOCKED for landing/qualification, not completed or released.** Narrow source repair committed and pushed: `5afa61c3febc1bb12acf156889b147e5fd51e41a`; remote branch verified at the same SHA. [PR #5](https://github.com/armonon/luma-studio/pull/5) is OPEN against `wave5/luma-new` at audited source `e709a1667ff72feacca91bb0a04238ec59ae96d7`. Worktree: `/Users/agentsattari/code/company-worktrees/luma-security-20261007`, branch `fix/luma-production-security-20261007`. Original checkout untouched.

Production-classified audit: **3 high → 0**. Fixed install, typecheck, primary Vinext build/rendered checks, Next/Netlify build, desktop bundle and local Next/image smoke passed. Full test/lint commands reproduce existing baseline failures exactly; no newly observed regression. Separate read-only OpenAI review approves scoped push, not merging/deployment. Only package.json/package-lock.json committed.

Exact-head [CI run 37712122219](https://github.com/armonon/luma-studio/actions/runs/37712122219) reports failure for verify, Native core and Desktop bridge. **No job steps ran.** Each job's annotation says: “The job was not started because recent account payments have failed or your spending limit needs to be increased.” Failed log retrieval returned `log not found`; jobs API returned empty steps, and check annotations established the actual blocker. Do not attribute these remote failures to the code/test suite. No billing/spend/account change or CI bypass attempted.

## Scope / source evidence

Read company AGENTS.md, DIRECTIVE.md, engine/README.md, COMPANY_STATE.md, AUTONOMY.md, Core Lab DIRECTIVE.md/HEALTH.md/AGENTS.md, selected product audit/JSON and data/model-routing.json. No parent/Core Lab PAUSE was present at selection. Also read REVENUE_DIRECTIVE.md; initial revenue README was not yet present during startup (another owner had the revenue task), so no revenue facts inferred.

`git fetch origin`, branch logs and `gh pr list` confirm existing stack: PR4 `wave5/luma-new → wave4/luma-suite`; PR3 `wave4/luma-suite → main`; separate PR2 `fix/mockup-preview-recovery → main`. This security PR does not review/merge that stack. No blind main rewrite or production rollback.

Manifest changes: Next and eslint-config-next 16.3.6→16.3.8, advisory-fixed overrides sharp0.35.5 and source-map-js1.2.2. Lockfile changes restricted to those families/native Sharp-libvips/WASM dependencies. Sharp patch also overrides Miniflare's 0.35.4 request: primary build/rendered tests exercise compatibility. No feature removal, application/route/config/CI changes, deployment, physical capture, licensing, public outreach or messages.

## Commands / observed results

Commands run in owned worktree unless stated. Logs/JSON are adjacent files. Baseline install/audit and Sharp smoke used default Node26.9.0; test/typecheck/lint/build commands explicitly prepended `PATH=/opt/homebrew/opt/node@22/bin:$PATH`. Local Next server also used Node22. This is macOS local evidence, not Linux CI or clean-machine/native qualification.

| Command | Baseline | Fixed |
|---|---|---|
| `npm ci` | exit0; baseline-install.log | exit0 under Node22; fixed-install.log |
| `npm audit --omit=dev --json` | exit1; 3 high, baseline-audit.json | exit0; zero findings, fixed-audit.json |
| `npm audit --json` | exit1; 16 high, baseline-audit-all.json | exit1; 10 high + 3 moderate, fixed-audit-all.json |
| `npx tsc --noEmit -p .` | exit0 | exit0 |
| `npx eslint app tests --max-warnings 0` | exit1; one existing image warning | exit1; identical warning |
| `npm test` | exit1; build + rendered4 pass; 1383 total, 1372 pass / 1 fail / 10 skip | exit1; identical counts and failure; build + rendered4 pass |
| `NEXT_TELEMETRY_DISABLED=1 npm run build:netlify` | not rerun | exit0; Next16.3.8 build and generated service worker |
| `npm run desktop:build` | not rerun | exit0; static desktop bundle, not signed Tauri package |
| `git diff --check` | clean | exit0 |
| `npm ls next sharp source-map-js --all` | affected baseline graph inspected | expected patched versions; fixed-tree.log |

Known baseline test failure: `tests/form-mesh.test.ts:21`, absent relative sibling `sculptor-studio/app/luma-mesh-asset.ts` in this isolated checkout. The canonical Form source at `/Users/agentsattari/code/wave2/form-D` SHA `b5abdd1de5f71fe0244ef9a651a6d983067541ff` matches the Luma contract byte-for-byte (`cmp` exit0). No sibling fabricated and no required check silently skipped. Lint failure: `app/studio/upscale-dialog.tsx:98`, `@next/next/no-img-element`, zero errors/one warning. Keep these as real follow-up gates.

Lock generation: Python stdlib changed four manifest entries, then `npm install --package-lock-only --ignore-scripts` under Node22 (exit0), followed by clean `npm ci`, not `npm audit fix --force`. Manifest SHA256 `14b496ba28e19fe210b48bacc150a1b8019f53c99f86ea18d7cb8f4d60e3695b`; lock SHA256 `845481a71d7b1f28628a936585d5a4d5d2f614d069a90d2aabecd5bac3195c6d`. Same files remained after builds and were independently reviewed/committed.

Synthetic Sharp smoke via `node --input-type=module`: render a 16×16 generated SVG with sharp, encode PNG, resize to 8×8 WebP and inspect metadata. Observed sharp0.35.5/libvips8.18.7, expected 8×8 WebP. No private media or physical input.

`node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 36317`: local production server; Python stdlib urllib exercised `/`, `/studio`, valid local desert image optimization (all200) and invalid quality (400). Exact paths, response hashes, headers and observed_at in next-runtime-smoke.json. Server stopped with Ctrl-C after checks.

`git add package.json package-lock.json`; `git commit -m "fix: patch production dependency security advisories"`; `git push -u origin fix/luma-production-security-20261007`; `gh pr create --repo armonon/luma-studio --base wave5/luma-new --head fix/luma-production-security-20261007 --title "fix: patch Luma production dependency advisories" --body-file .../pr-body.md`. Remote verification with `git ls-remote`; PR state/rollup in pr-state.json; CI jobs and three annotations retained. No merge request submitted.

## Runtime exposure / models / limits

Next/Netlify is a genuine secondary runtime and `app/page.tsx` uses next/image with local images. No explicit remote image pattern configuration, Draft Mode/use-cache or metadata-image pattern was found. Local Next image pipeline passes; **deployed exploitability remains unassessed**. Primary Vinext uses a separate image handler; inspected installed parseImageParams rejects nonlocal/protocol-relative URL forms, but this inspection is not live exploitation testing. Desktop is a static Vite/React bundle, not a Next server. source-map-js appears in PostCSS/Tailwind tooling; no direct app source-map parser found. Production dependency classification alone does not prove exposure or deployment safety.

Director actual model: `openai/gpt-6.1-sol`, verified via runtime session_status. No director fallback observed. Independent native reviewer was explicitly requested `gpt-6.1-sol`; child confirmed OpenAI GPT-6/Codex but exact deployment suffix/fallback is not independently exposed by its tools. No Claude route requested/reported; reviewer fallback occurrence is unobservable, not asserted as a measured zero. Full review and limitations: independent-review.md. Routine work performed directly; no research/creative volume task needed a Luna worker.

Remaining full-audit advisories include Cloudflare/Vinext/build-tool chains; production audit0 is not an all-dependency clean bill. `cargo` absent locally: native Rust and signed Tauri package remain unverified. No full interactive import/edit/layers/save/close/reopen/compare/export golden run, independent compatibility corpus, clean-install/update, live deployment/source reconciliation, performance benchmark or release qualification. Quality/revenue/user metrics unchanged/unknown, not fabricated.

## Next action

Use existing `CORE-LUMA-AUD-001` to repair the checkout-independent required cross-app contract test and the existing zero-warning local-image lint blocker (preserve cross-app coverage). Restore GitHub Actions execution through the account's existing authorized billing/admin path; this job does not authorize spend/account changes. Then rerun exact-head CI, retain independent source review, and qualify stack prerequisites separately before any authorized landing. Keep PR5 unmerged and deployed artifact unqualified until gates pass. Company task remains BLOCKED with this recoverable source/PR/evidence checkpoint.

## Final durable transition

At `2026-10-08T01:20:14Z`, `python3 engine/company.py finish CORE-LUMA-AUD-005 --owner director-20261008T0110-luma --token <retained-token> --status BLOCKED --evidence reports/luma-security-2026-10-07/README.md --result <verified-result> --next-action <checkpoint-above>` succeeded; owner/lease cleared and result_evidence attached. Before finish, `update-products --file reports/luma-security-2026-10-07/product-patch.json` succeeded and `revise --file reports/luma-security-2026-10-07/ci-task-revision.json --reason <dated-baseline-evidence>` updated the existing CI follow-up without claiming/performing it. Core Lab product JSON received a separate dated source-remediation observation without replacing its historical initial audit. Company `refresh` and Core Lab `lab.py refresh` succeeded after meaningful batches and final transition. PR body updated with actual no-steps CI blocker. Product branch remains clean, pushed, OPEN/unmerged, no deployment. Local supervisor heartbeat invoked for this BLOCKED transition with verified result/test/blocker fields; no channel/person send tool used. Cycle stopped around 01:20 UTC, within 35 minutes, with no ongoing workers or test server.
