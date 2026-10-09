## Scoped production dependency remediation

Base: `wave5/luma-new` at `e709a1667ff72feacca91bb0a04238ec59ae96d7`. This is a narrow stacked dependency fix, not approval to merge PR #4/#3 or deploy their feature work.

- Next and matching ESLint config: 16.3.6 → 16.3.8.
- Pin advisory-fixed Sharp 0.35.5 and source-map-js 1.2.2; update matching native/libvips packages.
- No application features, CI gates, routes or deployment settings changed.

## Verification (2026-10-07 Pacific; Node 22)

- Clean `npm ci`: pass.
- `npm audit --omit=dev --json`: 3 high production findings → 0.
- Full dependency audit: 13 remain (10 high, 3 moderate); not an all-dependency clean bill.
- `npx tsc --noEmit -p .`: pass before and after.
- `npm test`: primary Vinext build and 4 rendered-HTML checks pass; engine suite exactly matches baseline: 1,372 pass / 1 known failure / 10 skipped, 1,383 tests total.
- Known baseline test failure: Form mesh contract assumes an absent sibling `sculptor-studio` checkout.
- `npx eslint app tests --max-warnings 0`: same baseline warning at `app/studio/upscale-dialog.tsx:98` (`@next/next/no-img-element`); does not pass CI's zero-warning gate.
- `npm run build:netlify` and `npm run desktop:build`: pass.
- Local Next production server: `/`, `/studio`, and local image optimization return 200; invalid image quality returns 400. Sharp SVG → PNG → resized WebP smoke passes.
- Separate bounded OpenAI review: no blocking dependency-patch findings; approves scoped push subject to recorded checks. Explicit reviewer route requested `gpt-6.1-sol`; child runtime suffix/fallback was not independently exposed.

## Gates / limitations

Exact-head CI run 37712122219 failed all three jobs before any steps started. Check annotations cite failed account payments or a spending limit. This is an account-execution blocker, not observed CI test execution; no billing/spend/account change was attempted. Local test/lint blockers above remain independently reproduced and still require repair.

Do not merge with failing checks. Repair the existing standalone test/lint blockers and qualify the exact head through normal CI/reviews. This PR does not approve or merge downstack work. No deployment, release, licensing or production rollback performed. Native Rust suites unavailable locally (`cargo` absent), full golden workflow and deployed runtime exploitability remain unverified.

Local evidence: `thecreateco-company/reports/luma-security-2026-10-07/` (audit/build/test logs and runtime receipt). Core company task: `CORE-LUMA-AUD-005`.
