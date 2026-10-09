## Scoped repair
- Name the static Fetcher `STATIC`, preserving `ASSETS` R2 and authenticated project CRUD.
- Adapt vinext static fallback and use validated original-image passthrough when IMAGES is absent; no paid binding or transform claim.
- Add `npm run test:worker:images` for the emitted local Worker with isolated synthetic R2/D1 fixtures, URL/MIME/security policies and bounded cleanup.

## Evidence
- Pre-fix isolated emitted Worker reproduces valid PNG500 (`ASSETS.fetch` TypeError); repaired PNG200 preserves source bytes and security/cache headers.
- Web and desktop frontend builds, full typecheck/lint, 4 focused asset tests and actual emitted Worker integration passed.
- Real synthetic browser: sketch/extrude/material undo-redo/save/full process close/reopen comparison/STEP+GLB export passed, zero page errors.
- Independent OpenAI Sol scoped review approves the four exact source hashes; 7 additional independent dependency smoke checks passed.

## Gates and limitations
Stacked on PR7; no merge of unreviewed downstack. Full native, hosted mandatory CI, source/live and full-product qualification remain unresolved. Actual IMAGES-present transform is unqualified. Local checks do not substitute for hosted CI. No deployment/spending/access changes. Parent report: core-product-lab/reports/form-worker-images-20261009T1140/README.md in company workspace.
