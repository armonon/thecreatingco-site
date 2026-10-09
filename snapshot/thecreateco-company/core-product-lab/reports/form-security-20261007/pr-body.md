## Summary
- Pin Next.js 16.3.8; lock sharp 0.35.5 and source-map-js 1.2.2.
- Scope security documentation to this source candidate, not deployed-runtime remediation.

## Validation
- Clean Node 22 npm ci, typecheck, web build, desktop-web build, Netlify marketing/review builds, and release version validation pass.
- Production audit: 1 critical + 2 high package groups → zero.
- Source-only lint fails one react-hooks/immutability error at unchanged app/cad-workspace.tsx:2174. Original post-build lint also examined generated Netlify artifacts; those outputs were retained outside the checkout and the exact lint command repeated with unchanged rules.
- Full unit suite: 1518/1526 pass, exactly the eight failures in the retained baseline log at b5abdd1. No assertions relaxed. Existing CORE-FORM-AUD-TEST-001 tracks those selectors/archive expectations.
- Four synthetic real-workspace jsdom lifecycle checks pass; five-project engineering smoke 5/5 passes. These do not qualify full desktop workflows.
- Separate isolated OpenAI reviewer found no patch-specific blocker after lock/metadata/tree/runtime-path inspection. Application validation was performed by the patch owner.

## Remaining gates
Do not merge until exact-head required checks/reviews pass. Full development audit retains 15 high + 4 moderate groups; Vinext worker exposure and deployed artifact dependencies remain unqualified. Native/signed clean-machine release gates have not run in this cycle. No deployment requested or performed.

## CI observation
Exact head b433a12: web/native-macos jobs did not start because GitHub reported failed account payments or spending-limit restrictions; desktop-artifact skipped. No checks bypassed and no merge/deploy.
