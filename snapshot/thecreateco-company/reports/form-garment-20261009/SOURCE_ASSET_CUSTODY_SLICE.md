# Garment source-image custody slice — 2026-10-09

## Scope

Local implementation on branch `feat/pattern-first-scan-20261009`, based on draft Form PR #10 commit `d42d25caeb56550dc06ca227f38927a76dd520f1`. This extends the pattern-first scan contract with a versioned `.form` project-asset foundation for retaining untouched front/back photo bytes and provenance. No customer/user images were used.

## Changes

- Added `app/garment-scan-source.ts:addGarmentScanPhoto`: front/back assignment; PNG/JPEG/WebP MIME signature check; exact read-length check; 8 MiB per-source bound; SHA-256; original bytes encoded unchanged into a `.form` data URI; source filename (path/control characters sanitized), media type, byte count, import time and view recorded on the asset.
- Added `app/project-format.ts:addFormProjectAssets`: immutable append, duplicate-ID refusal, asset-count limit, checksum invalidation, revision update, safe-tree and project-schema validation. Revision identity includes asset metadata and a digest of any URI; it is a label, not a cryptographic integrity mechanism.
- Added `tests/garment-scan-source.test.mjs`: byte-exact save/reopen, SHA/view metadata, duplicate refusal, invalid signature/type, changed read length, oversized input, and revision-metadata distinction.
- Independent OpenAI/Sol source review found no blocking findings. Its low revision-identity concern was fixed and re-reviewed; the follow-up confirmed resolution. SHA-256 remains the scan-byte integrity mechanism.

## Verification

- `npx tsx --test tests/garment-scan-source.test.mjs tests/garment-scan-pattern.test.mjs tests/project-format.test.mjs`: 13/13 passed.
- `npm run typecheck`: passed.
- `npx eslint app/project-format.ts app/garment-scan-source.ts tests/garment-scan-source.test.mjs`: passed.
- `npm run build`: passed; Vinext completed all five phases. Nonfatal warnings remain for `node:module` externalization from `occt-wasm`, large client chunks, a Node deprecation, and static route classification.
- `git diff --check`: passed.

## Not yet delivered / limits

This is source-byte custody, not a user-facing scan workflow. It does not decode images, check dimensions/quality, provide upload/tracing UI, link imported asset IDs into `scanEvidence`, calibrate arbitrary images, or prove pattern geometry against physical garments. Those checks must be implemented before photo input can be accepted. Pattern construction remains limited to measured, traced simple skirts and produces an inferred draft, not a validated cutting pattern. Existing GitHub billing/spending-limit block on hosted PR checks is unchanged.

## Handoff update — 2026-10-09 10:26 PDT

The shared agent branch has advanced beyond this initial custody slice: commits `7978d66` (preserve original scans) and `c292256` (link stored scans to editable pattern) are on the remote head. Draft [PR #10](https://github.com/armonon/form-studio/pull/10) points at `c292256227befffde4646f9ec4b6fad56419c7fa`. The handoff helper verified the remote was already at that exact SHA (`already-current`); no duplicate push was made.

At exact current head, the combined focused scan/project tests passed 15/15, `npm run typecheck`, targeted ESLint, and `npm run build` passed. Hosted web and macOS checks did not start because GitHub reports account payment failure/spending-limit; the desktop artifact job was skipped. No retry was issued. The PR remains draft/unmerged/undeployed. Continue with scan image decode/quality validation, user-facing import/tracing, and physical evidence; do not treat the current alpha as production-ready.
