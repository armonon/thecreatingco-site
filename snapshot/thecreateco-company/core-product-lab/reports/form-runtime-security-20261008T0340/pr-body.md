## Scope
- Compatible lock-only updates to Cloudflare Vite 1.63.0, Wrangler 4.148.0, Miniflare 5.20261006.0-alpha/workerd 1.20261006.1, undici 7.29.1, brace-expansion 1.1.21/5.0.12.
- Patch Vinext's pinned image-size to 2.0.4 and sharp to 0.35.5. Global sharp override avoids npm 10's deduped-edge validation problem; Next already used 0.35.5.
- No application behavior or release-gate changes. Stacked directly on PR5; does not include unrelated PR6 STL work.

## Local verification
Node 22.23.2/npm 10.9.8, macOS arm64. Clean npm ci; parser npm ls passes. Full audit improves 19 to 12 groups (15 to 8 high, 4 moderate unchanged); production-only audit remains zero. Full npm audit is NOT clean.

1,527/1,527 unit tests, 15/15 budget tests, typecheck/lint, web and desktop frontend builds pass. Real Chrome synthetic SVG sketch -> 40mm resize -> 12mm exact extrusion -> brass material -> undo/redo -> save -> close/new tab -> reopen/compare -> STEP/GLB passes. Six viewport menu/save/open/export regression variants pass. Actual local Miniflare Images binding PNG -> resized WebP passes with patched sharp.

Separate read-only OpenAI/Codex review approved final two-file diff and parser APIs, with retained limitations. Reviewed diff SHA256: 0a03be28f48b2b4bd03bf30479039fdc86d8dc0a4267889b429d48a4a1c23bdb. Lock SHA256: bd2219af132c72ee9bdb2d522512eb02e940743b6d2e06dcb5b256c9363b2cbd.

## Residual boundaries
Remaining braces/glob/Vinext build-discovery and Drizzle/esbuild tooling advisories need upstream-compatible remediation; no forced framework downgrade. Vinext image-size takes local build inputs, whereas Worker image decoding delegates to Cloudflare Images; this is not a deployed-exploitability certification.

Local emitted Worker qualification reproduces a pre-existing binding defect: static /og.png returns 200, valid /_vinext/image request returns 500 (ASSETS is R2 but handler calls .fetch), external URL rejected 400; generated config lacks IMAGES. Tracked separately, not introduced by this dependency change.

No merge, deployment, CI retry, or release claim. Existing mandatory hosted-CI outage and full native/platform/source-deployment qualification gates remain; all downstack PR gates must pass before landing.
