# CORE-SP-SEC-001 — ScenePilot production-dependency security repair

Date: 2026-10-07 America/Los_Angeles (2026-10-08 UTC). Result: NEEDS_REVIEW, not released.
Owner: director-20261008T0010-spsec. One bounded company/Core Product Lab task.

## Source and change

Baseline fb42d12b98c895b47642eaab4a9be74de0c2c358, isolated worktree `/tmp/scenepilot-security-20261008`.
Local branch `codex/scenepilot-security-20261008`, commit `4f92d2d8c6947b49cb830c61932e382c05ddf2c5`.
Only package.json/package-lock.json changed. Original dirty checkouts and the independent accessibility branch were not modified. No push, PR, deploy, rollback, messaging, licensing or account changes.

Patched/pinned Next and eslint-config-next 16.3.3 → 16.3.8; sharp override 0.35.4 → 0.35.5 (libvips artifacts 1.3.3 → 1.3.4); source-map-js override 1.2.1 → 1.2.2. Exact Next pin freezes this bounded candidate, avoiding an incidental minor upgrade. Review identified one unrelated nested workers-types patch drift, reverted before final clean install. Final 40 package-version changes are entirely these families and their platform binaries; no broad audit-fix/force operation.

## Commands and observations

Company root:
- `python3 engine/company.py recover` → no expired leases recovered.
- `python3 engine/company.py refresh`; `python3 core-product-lab/lab.py next` → highest severity eligible CORE-SP-SEC-001, no product owner conflict.
- `python3 engine/company.py claim --id CORE-SP-SEC-001 --owner director-20261008T0010-spsec --minutes 35`; retained token and heartbeated via CLI.
- Read AGENTS.md, DIRECTIVE.md, engine/README.md, COMPANY_STATE.md, lab directive/health and data/model-routing.json. PAUSE absent.

Repository/worktree:
- `git worktree add -b codex/scenepilot-security-20261008 /tmp/scenepilot-security-20261008 fb42d12b98c895b47642eaab4a9be74de0c2c358`.
- `npm audit --omit=dev --json` before changes → 3 affected packages: Next critical, sharp high, source-map-js high (expected exit 1). `audit-baseline.json` retains advisory/range/URL evidence. This run did not repeat the prior baseline functional suite; the earlier dated exact-SHA audit documents 1091/1091 passing tests.
- `npm view next@16.3.8 version`, `npm view sharp@0.35.5 version`, `npm view source-map-js version` verified registry availability.
- Targeted Python JSON edit to manifest, `npm install --package-lock-only --ignore-scripts`, `npm ci --ignore-scripts`. First caret resolution selected 16.4.0; corrected to exact 16.3.8 before testing, with `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm install --ignore-scripts`.
- Reverted incidental nested workers-types lock entry using the baseline git object, then `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm ci --ignore-scripts` → exit 0, final clean lockfile install. Logs retain all stages.
- `ln -s /opt/homebrew/bin/ffmpeg node_modules/ffmpeg-static/ffmpeg` after clean installs: isolated runtime setup only, not a repository change. Install lifecycle disabled to avoid previously documented external OpenVINO download failure; bundled ffmpeg/clean-machine/native installers are NOT qualified.
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test` → Vinext build and 1091/1091 tests pass, twice (after final narrowed lockfile too); final-test.log. Node22 is supported by package engines; initial package-resolution tooling used Node26/npm11, final install/tests/check used Node22.
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run check` → TypeScript and ESLint pass, repeated on final narrowed lockfile; final-check.log.
- `SCENEPILOT_BUILD_EVIDENCE_OUT=/tmp/scenepilot-security-20261008/outputs/security-site PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build:app` → pass; does not rewrite tracked site assets.
- `PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run desktop:renderer` → pass. Not a packaged/notarized desktop release.
- Node ESM smoke using sharp: rasterized generated red 12×8 SVG to PNG and verified dimensions. source-map-js SourceMapGenerator/Consumer roundtrip preserved line 2, column 3. override-smoke.log retains results. This is normal-input compatibility, not adversarial exploit qualification.
- Final `npm audit --omit=dev --json` → exit 0, ZERO findings in npm production-classified tree; audit-final-production.json.
- Final `npm audit --json` → expected exit 1, 30 remaining findings (18 high, 12 moderate), none critical; audit-final-all.json. This is NOT a vulnerability-free desktop/runtime declaration.
- `npm ls next eslint-config-next sharp source-map-js`; `git diff --check` → pass. Saved binary-capable diff as security-fix.patch; committed only two package files; final git status clean.
- Initial overbroad AGENTS discovery was interrupted after macOS denied unrelated Library folders. Follow-up inspection stayed scoped to repository ancestors and audited source. No private Library contents were loaded.

## Reachability triage and limitations

Source imports next/headers and next/navigation; no direct next/og or next/image imports found in app/worker/electron search. Vinext's public shim map and plugin alias resolution substitute Next APIs. Worker image route `/_vinext/image` delegates to Vinext and Cloudflare IMAGES, not demonstrated upstream Next image-server code. The checked-in Netlify configuration publishes static site/ with no build step; site/app builds a static SPA. These are source configuration observations, NOT current deployed artifact provenance or proof of exploitability/non-exploitability. No public host or release artifact was inspected; deployed paths remain unverified. Production source/release drift and additive-overlay restrictions remain intact.

The remaining full-tree advisories are retained, not suppressed. Electron is a devDependency but is the shipped desktop runtime. Its sandbox/preload/protocol advisories therefore remain release-security concerns even when omit=dev returns zero. electron/main.js sets sandbox=true and nodeIntegration=false with a window-open handler; these settings do not independently prove advisory paths unreachable. Separate follow-up must triage/update Electron and relevant tooling in its own bounded candidate; never apply npm audit's suggested Vinext downgrade blindly.

No full creative golden workflow, human UI review, exact shipped artifact qualification, target-platform matrix, physical capture, clean installation, native OpenVINO install, notarization or exploit test was performed. Quality, maturity and company metrics remain unknown/ALPHA as before. Build/test success does not qualify a release.

## Independent review and model accounting

Director runtime verified with session_status: openai/gpt-6.1-sol, no fallback observed. One bounded native independent read-only reviewer was requested with gpt-6-luna; native receipt did not expose actual runtime model and child lacked session_status/tool_search. Actual reviewer model and fallback are unverified; do not claim Luna execution or count it toward routing quotas. Child's initial claim of inherited Sol was explicitly withdrawn as unverified. No Sonnet creative work or Opus review justified for this narrow dependency patch.

Reviewer found no major scoped compatibility concern, requested removing incidental workers-types drift (done), and required preserving the distinction between production-classified audit and shipped Electron security (above). Review evidence is review-findings.md.

## Next action

Review local commit 4f92d2d through existing source/PR/check gates; reconcile intended canonical candidate and deployment provenance before any release. Retain Electron/runtime/tooling security follow-up and full golden-workflow qualification as separate tasks. This repair is NEEDS_REVIEW, not COMPLETE or deployed.
