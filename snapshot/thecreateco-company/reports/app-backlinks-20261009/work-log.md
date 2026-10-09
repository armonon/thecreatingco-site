# Owned web-app company backlinks — execution log

Updated: 2026-10-09 09:58 PDT / 16:58 UTC

## Live audit

- Method: headless Chromium against the actual public routes; checked HTTP, DOM anchors and the shared app menu (including opening its shadow-root menu).
- Result: 21/21 endpoints returned HTTP 200. 17/21 already expose `https://thecreatingco.com/` through the footer or shared app menu. No duplicated links were added to these apps.
- Live UI exceptions: Form Studio, Cast review UI, Librarian. WebLab previously had plain text only; its current draft preview is fixed.
- Detailed endpoint evidence: `audit.json` in this directory.

## Changes

- WebLab: source commit `8d51ea2c3387df3f49808e2bdf9510c6d37b5c67` pushed to draft PR #1. Separate Netlify draft preview rebuilt and verified at https://6ac9198c96879eb55d2917bd--weblab-preview-tcc.netlify.app/; visible accessible company-home link, HTTP 200 and 320px layout check. Not production.
- Form + Cast: isolated branch `codex/form-company-backlink-20261009`, commit `cbde0fd`. Added accessible home links to Form and CAD headers and Cast dialog, including keyboard tab traversal and narrow-screen treatment. Draft PR #11: https://github.com/armonon/form-studio/pull/11. Not merged/deployed.
- Librarian: existing draft PR #1 already adds the shared suite menu and company-home route. No duplicate code added. It remains intentionally draft because the recorded Netlify function/source credentials and missing live PDF asset block safe deployment. Live page not fixed yet.

## Exact local checks for Form PR #11

- Checkout base SHA: `b5abdd1de5f71fe0244ef9a651a6d983067541ff` (`origin/main` at worktree creation); changed-head commit: `cbde0fd`.
- Runtime: Node `v22.23.2`, matching repo CI Node 22 and `engines >=22.13.0`.
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --experimental-strip-types --test --test-name-pattern='Cast checks a selected mesh' tests/workspace-smoke.test.mjs` — PASS, 1/1.
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` — PASS.
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx eslint app/cad-phone.css app/cad-workspace.tsx app/cast-studio.css app/cast-studio.tsx app/form-ui-v2.css app/studio-v2.tsx tests/workspace-smoke.test.mjs` — exit 0, no code errors; ESLint reports 3 CSS files ignored because no CSS config.
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run build` — PASS; production build complete. Existing warnings include >500KB chunks and `node:module` externalized by OCCT dependency.
- `git diff --check` — PASS.
- Full `npm run test:react` under Node 22 was started, then stopped after failures confirmed. Examples: tests 47/48/55 fail on ambiguous `role=status`; test 50 fails due missing expected texture data. These occur outside backlink assertions and remain untriaged. The focused Cast/company-link test passes. Full suite is NOT reported green.
- GitHub hosted CI was not represented as successful; no repeated workflow retry attempted due billing outage.

## Release state / remaining work

- No production deployment or merge made.
- PR #11 Form/Cast is draft, awaiting review and normal required checks.
- WebLab PR #1 remains draft; its separate alpha preview is not the company production site.
- Librarian remains blocked at its existing draft PR #1. Resolve the documented Netlify function-key/source problem and missing live PDF asset before release; do not deploy the draft around this.
- Once normal release authorization/gates are satisfied, re-run the 21-route live audit and close remaining Form/Cast/Librarian exceptions.
