# Independent security exposure review — CORE-FORM-AUD-SEC-002

Reviewer: independent OpenAI GPT-6/Codex context; no Claude. Read-only checkout inspection. Baseline commit `1e7f6d1c84a6c956ece3cfe6f74b665208bf069c`. No deployments, checkout edits, malicious parser payloads, or installed-candidate approval performed.

## Final scoped candidate verdict

**APPROVED for the scoped dependency remediation; no blocking security or API-compatibility issue found in the final reviewed manifest/lock.** This is not deployment or product-release approval. Parent must retain existing CI/review gates and capture its planned final clean-install/parser-tree repetition.

Independently verified final identity:

- Diff SHA-256: `0a03be28f48b2b4bd03bf30479039fdc86d8dc0a4267889b429d48a4a1c23bdb`.
- Lock SHA-256: `bd2219af132c72ee9bdb2d522512eb02e940743b6d2e06dcb5b256c9363b2cbd`.
- Final overrides: Vinext -> image-size 2.0.4; global sharp 0.35.5. Global sharp changes no installed version relative to the prior candidate; Next and Miniflare already resolve 0.35.5.
- Reviewer reran parser dependency tree under Node 22.23.2/npm 10.9.8: exit 0, correct overridden/deduped versions, no sharp invalid. This resolves the earlier scoped-override npm10 mismatch. The historical candidate addendum below records the prior issue, not a remaining final blocker.

Reviewed parent receipts: browser-golden-repeat and browser-lifecycle both exit 0 with final diff identity. Lifecycle log records actual extrusion/material undo-redo/save-close-reopen/STEP/GLB behavior and no browser errors. Unit receipt exits 0; its older receipt does not record diff hash, so it supports unchanged installed dependency graph rather than independently pinning final manifest identity. Parent web and desktop builds also pass for the same locked installed versions.

Confirmed image endpoint follow-up: `worker-requests.log` records `/og.png` 200, valid local optimizer request 500 (`env.ASSETS.fetch is not a function`), external URL 400. Source and emitted entry explain the same defect. It predates these dependency edits and remains a separate binding-contract repair; the broken optimizer must not be represented as a working image runtime or used to justify permanent security exclusion.

Desktop emitted frontend boundary: reviewer traversed actual `desktop-dist/.vite/manifest.json` entry imports/dynamicImports: 20 reachable manifest modules of 21, entry `assets/index-K-_hPTqZ.js`, React/OCCT/Three/fabric static imports and Tauri/updater/process/OpenVDB/shared application lazy imports. This confirms the configured browser/Tauri frontend entry structure rather than a bundled Vinext server entry. Native packaging/resources/codec audit and platform release gates are still outside this check; manifest traversal is not a proof of all module internals or native resource exclusions.

Residual full audit is 12 findings (8 high/4 moderate), described below. They need explicit retained build/lint/tooling exposure disposition, not a “clean audit” claim. Pre-existing native/frontend peer issues are not repaired by this patch. No checkout modifications or deployments were made by the reviewer.

## Verdict

**Baseline dependency audit is not clean: 19 findings (15 high, 4 moderate).** The production-only audit is insufficient for this product because Vinext and the Cloudflare integration execute build/dev/server paths regardless of npm dependency category. Nevertheless, the examined Worker image request path does **not** call the vulnerable image-size parser or local sharp binary. Its decode boundary is a Cloudflare Images binding, with source fetched through a static-asset Fetcher. This is a source/control-flow finding, not a conclusion drawn from missing package-name strings.

**Runtime qualification remains incomplete:** the emitted binding contract conflicts with the image handler, and the desktop artifact/native release were not independently built or launched in this review. Do not translate these boundaries into “all runtime dependencies safe,” a clean npm audit, or release approval.

While inspecting, `git status --short` changed from clean to modified `package.json`/`package-lock.json`. This report deliberately freezes to the already inspected baseline and audit logs. The moving dependency candidate was not reviewed; exact final diff, locked versions, clean-install and emitted-artifact evidence require a separate follow-up.

## 1. Vinext image-size: concrete build-file input boundary

Baseline `vinext@0.0.50 -> image-size@2.0.2` has infinite-loop advisories GHSA-5p2g-fcmc-qvqq (JXL/HEIF) and GHSA-w3rx-r6r6-pgpr (ICNS). Both vulnerable intervals include 2.0.2.

Actual parser call sites inspected:

- `node_modules/vinext/dist/index.js:1281-1310`: `vinext:image-imports` Vite plugin resolves virtual image metadata; `load` takes a resolved repository image path, calls `fs.readFileSync(imagePath)` and `imageSize(...)`, then emits literal width/height metadata. Catching errors does not stop an infinite loop.
- `node_modules/vinext/dist/server/metadata-route-build-data.js:10-16,29-38,83-100`: metadata construction reads `route.filePath` from local filesystem, hashes it and computes image dimensions. This operates on discovered file-based metadata during metadata-source generation, not a request body.
- The runtime file-based metadata implementation and emitted route table were inspected separately: metadata head/route data are generated for the Worker, rather than this local-file dimension parser being called by the image optimizer.

Thus malicious image bytes committed/imported as build inputs (including untrusted PR assets, upstream/generated assets, or a future user-upload-to-build pipeline) can hang the build/tooling process. Ordinary remote `/_vinext/image` request bytes have no demonstrated edge into these imageSize calls. Upgrade/override to a patched version with exact locked-version verification and build/metadata regression checks; do not claim devDependency classification resolves this finding.

## 2. Worker optimization: actual route and binding defect

Source `worker/index.ts:1-2,33-43` explicitly routes `/_vinext/image` to `handleImageOptimization`, with `fetchAsset(path) => env.ASSETS.fetch(new Request(new URL(path, request.url)))` and `transformImage => env.IMAGES.input(body).transform(...).output(...)`. The emitted Worker preserves this path at `dist/server/index.js:16612-16626`. Entry selection is confirmed by `dist/server/wrangler.json` (`main: index.js`, `no_bundle: true`), not merely inferred from source presence.

Vinext handler `node_modules/vinext/dist/server/image-optimization.js`:

- Lines 65-86 normalize backslashes, reject external/scheme-relative URLs, check same-origin parsing, validate widths (max 3840 and configured allowlist) and quality 1-100.
- Lines 165-180 fetch the source with the supplied callback; reject unsuccessful/bodyless source and non-allowlisted content types; hand the response stream to the supplied Cloudflare transform callback. It does not inspect dimensions via image-size, nor dispatch to sharp.
- Lines 143-155,181-200 add CSP, nosniff and Vary to allowed images; SVG is blocked in the supplied default configuration. A transform failure falls back to source passthrough (possibly refetching the source). It therefore must not be interpreted as a guarantee that every response was transformed.

**Binding inconsistency:** emitted `dist/server/wrangler.json` declares R2 bucket binding `ASSETS`, static assets directory `../client` without an explicit Fetcher binding name, and no `IMAGES` declaration. `app/api/assets/route.ts:64,96,112` confirms `ASSETS` is intentionally used as R2 (`get`, `put`, `delete`). R2 is not the Fetcher contract assumed in the image branch. A valid image request can therefore fail at `env.ASSETS.fetch` before entering the handler transform fallback. Missing `IMAGES` alone can instead be caught as a transform error and fall back if source fetching worked. The inspected artifact is not proof of actual deployed bindings; there was no remote inspection or deployment.

Qualification recommendation: use separate R2/static-Fetcher binding names, verify generated/deployment configuration against entry expectations, then exercise actual Worker requests for a supported local PNG, external/scheme-relative URLs, SVG/nonimage types, invalid widths, unknown source, and transform failure. Check result status/headers and whether the intended backend transformed bytes. Preserve existing release/deployment gates. Do not “prove” safety by relying on currently broken bindings.

Authenticated project uploads are not another image-size edge: `app/api/assets/route.ts:77-100` validates room/member, filename/size, consumes bytes and writes R2 without local image parsing. GET performs authorization and returns R2 bytes (`50-74`). The optimizer fetch callback targets the static-asset binding directly, not the authenticated app API; do not change it into a proxy for private asset URLs without reviewing cache/authentication semantics.

## 3. Other audit packages and activation conditions

Audit source: `baseline-full-audit.log`; graph source: `dependency-tree.log`. Wrapper findings inherit their underlying issues and are not 19 independent exploits.

| Packages | Verified baseline boundary / remaining qualification |
| --- | --- |
| sharp 0.35.2 via Miniflare (Next has 0.35.5) | Vulnerable native HEIF/SVG libraries in installed Miniflare path. Worker callback uses Cloudflare Images, not this binary. Miniflare local Images emulation/tooling can decode image inputs; patch local toolchain and test that path if it is enabled. This does not assess Cloudflare's managed codec implementation. |
| undici 7.29.0 via Miniflare/jsdom | Advisories require distinct APIs: WebSocket/WebSocketStream, RetryHandler/retry, cache/dump interceptors, BalancedPool, or compressed-response handling. Installed occurrence alone does not establish every condition. Local dev emulation and jsdom test environments are separate surfaces from Worker-native fetch. Patch to >=7.29.1 and qualify any activated APIs with actual call-site/runtime evidence rather than applying a blanket “not production” exclusion. |
| braces 3.0.3; brace-expansion 1.1.18 and 5.0.9; micromatch/fast-glob; eslint-config-next/@next/eslint-plugin-next; Vinext commonjs/dynamic-import plugins | Untrusted nested glob/pattern input can exhaust parsing resources. Baseline graph connects them to lint and build module discovery; requests are not inherently glob inputs. Keep PR/source/build inputs inside the review trust boundary; use patched resolutions and validate lint/build behavior. |
| esbuild <=0.24.2 via @esbuild-kit/core-utils -> esm-loader -> drizzle-kit | Advisory specifically concerns esbuild development-server cross-origin requests. Merely transforming/loading Drizzle configuration is not equivalent to calling esbuild's serve API. `db:generate` runs drizzle-kit; no activated vulnerable serve path was established in this scoped review. Upgrade/override compatibly; do not accept npm's suggested Drizzle downgrade without checking functionality. |
| @cloudflare/vite-plugin/miniflare/wrangler | Installed tooling actually executes in the web build/dev config, so omission from production-only audit is not a security disposition. Patch and verify full tooling graph, not just top-level semver ranges. |

The emitted Worker’s explicit image handler and binding delegation provide a stronger boundary argument than package absence. This review is not an exhaustive call-graph proof for every module, Worker route, local developer tool, or vulnerability; undici advisory-by-advisory exploitability is not claimed established.

## 4. Desktop boundary

`src-tauri/tauri.conf.json:7-11` runs `desktop:web:build` and packages `../desktop-dist`; it does not package the web Worker as its frontend server. `vite.desktop.config.ts:1-15` uses the React Vite plugin with desktop root, not Vinext/Cloudflare. `desktop/index.html` loads `main.tsx`; `desktop/main.tsx:1-5` mounts shared `app/studio-entry` through React DOM. Therefore npm build-tool execution and a shipped desktop frontend must be assessed separately.

Client image-import code inspected (`app/cad-workspace.tsx:4449-4460`, photo texture paths) uses browser Image/canvas decoding with limits; this is not image-size/sharp on Node. Tauri native code and OS/WebView codecs have separate attack surfaces not covered by this npm audit. Baseline `tauri.conf.json` has CSP limiting network connections to IPC and local self/data/blob image sources; that constrains the baseline frontend but is not a native parser audit or proof of all updater/release configuration variants.

No desktop-dist or native binary was produced/verified by this independent reviewer, so exclusion of vulnerable packages from a **shipped desktop artifact** must remain conditional until the exact entry/chunk graph and native resource list are inspected after a clean desktop build. Inspect real reachable frontend modules and Tauri resources; package-name string absence is insufficient.

## Required closure evidence

1. Final immutable candidate diff and lockfile; record installed versions, full npm audit, and any intentionally residual advisory/API qualifications.
2. Clean web build plus exact Worker binding/entry verification and handler behavior checks.
3. Clean desktop build, emitted entry/chunk and Tauri resource inspection; existing native/release gates remain separate.
4. Security conclusion must distinguish patched installed graph, deployed Worker behavior, desktop behavior, and local tooling exposure. Baseline audit alone authorizes none of those releases.

## Candidate follow-up — exact finalized dependency changes

The parent supplied the completed candidate for a separate read-only review. `reviewer-candidate-identity.json` pins the reviewed diff/lock SHA-256. Only package.json and package-lock.json differ in the reviewed checkout. Manifest adds scoped Vinext image-size 2.0.4 and Miniflare sharp 0.35.5 overrides; lock updates compatible tooling (Cloudflare Vite 1.63.0, Wrangler 4.148.0, Miniflare 5.20261006.0-alpha, workerd 1.20261006.1), undici 7.29.1 and brace-expansion 1.1.21/5.0.12 plus related platform binaries. No runtime source/security policy was changed.

**Independent scoped dependency review: API/security remediation is supported, but pinned npm tree validation remains unresolved.** Baseline R2/IMAGES integration is a pre-existing follow-up, not a reason to block these scoped parser/toolchain security updates. Existing product release gates remain intact; this is not release approval.

API compatibility evidence: Vinext uses named `imageSize(Uint8Array/Buffer)`; candidate package preserves this ESM export. Reviewer directly parsed repository `public/og.png` with image-size 2.0.4 (1731 x 909), and used sharp 0.35.5 `rotate().resize(16,null).png().toBuffer()` then parsed result (16 x 8, 481 bytes). This independently exercises the same API family used by installed Miniflare image transforms (`node_modules/miniflare/dist/src/index.js:119261-119357,119478-119539`); it does not test every codec or malicious payload. Native sharp reports libvips 8.18.7, libheif 1.23.5, librsvg 2.63.2. Parent evidence independently records successful clean npm ci, web build and desktop frontend build.

**npm override tree check — version-specific mismatch confirmed:** system Node 26.9.0/npm 11.19.1 `npm ls image-size sharp --all` exits 0, but the pinned runner Node 22.23.2/npm 10.9.8 reproduces `ELSPROBLEMS`: sharp 0.35.5 deduped is invalid against Miniflare exact 0.35.4, despite Miniflare and image-size being marked overridden. This is not a stale diagnostic. Both see the patched installed version, and direct sharp API use works, but the pinned package-manager validation must not be reported as passing.

Recommended minimal resolution to test: a global `sharp: 0.35.5` override instead of the Miniflare-nested override. Next already uses 0.35.5, so the present resolved codec version would not broaden; this should make the override apply consistently to both deduped dependency edges under npm 10. Regenerate lock, clean npm ci and rerun the pinned parser tree. A `miniflare@5.20261006.0-alpha` selector is narrower but may retain the deduped-edge validation mismatch; neither alternative is approved as effective until reproduced. No checkout files were modified by this reviewer. System full-tree problems independently include extraneous @emnapi/runtime/@img/sharp-wasm32, openvdb/three peer incompatibility and missing webpack; classify the latter against baseline.


`final-full-audit.log` still reports 12 vulnerabilities (8 high, 4 moderate), specifically braces/glob/Vinext commonjs/dynamic-import lint/build chains and esbuild/Drizzle tooling. image-size, sharp, undici, brace-expansion and Cloudflare toolchain findings are removed in that audit. **Do not claim clean full npm audit.** There is no indicated patched braces version in this graph; any further broad framework/downgrade change requires separate compatibility work. Maintain explicit residual build-input trust boundary and follow-up owner.

The observed parent browser-golden receipt exits 1; this reviewer does not count it as passing. Parent is continuing behavioral qualification. Candidate desktop build exists, but this addendum has not inspected a packaged native artifact or demonstrated all runtime module exclusions. These limitations do not negate the verified parser API compatibility or dependency remediation.
