# Form runtime/toolchain security cycle — 2026-10-07 Pacific / 2026-10-08 UTC

Task CORE-FORM-AUD-SEC-002. Started03:40Z; one isolated product worktree, no competing Form company lease observed. Parent PAUSE/lab PAUSE absent. Authority AUTONOMY.md and CI_OUTAGE_POLICY.md read before product execution. Selected severity-first task via lab.py next, claimed exactID with unique owner/45minute lease; heartbeat renewed. No queue SQLite/exports hand edits.

## Result
Reviewed/pushed commit `be1f7272c5689d6401194d643fa3eb09a2b0b73b`, branch qa/form-runtime-security-20261008T0340, PR https://github.com/armonon/form-studio/pull/7 OPEN stacked directly on PR5 (not unrelatedPR6). Base1e7f6d1c84a6c956ece3cfe6f74b665208bf069c. Only package.json/lock changed; source checkout clean and remote SHA verified. NO merge/deploy/release/rollback/physical capture/payment/access change or CI retry.

Compatible lock-only tooling updates: Cloudflare Vite1.54.6→1.63.0, Wrangler4.130.0→4.148.0, Miniflare5.20260908.0-alpha→5.20261006.0-alpha/workerd1.20261006.1, undici7.29.0→7.29.1, brace-expansion1.1.18→1.1.21/5.0.9→5.0.12. Scoped Vinext image-size override2.0.2→2.0.4; sharp0.35.2→0.35.5 globally (Next already0.35.5). No forced major framework change, no assertion relaxation.

## Measured checks
Environment Darwin25.2 arm64, pinned Node22.23.2/npm10.9.8; browser Chrome154 via Playwright/SwiftShader. Exact commands/exit codes/timestamps in *.receipt.json; raw output in matching *.log. candidate-manifest.json contains source/lock, build artifacts and synthetic fixture hashes.

| Check | Actual result |
| --- | --- |
| Baseline npm ci | PASS |
| Baseline full npm audit --json | exit1:15high+4moderate=19 package groups |
| Baseline production audit | exit0:0 |
| Candidate final clean npm ci | PASS; global-clean-install receipt |
| Candidate full audit | exit1:8high+4moderate=12 package groups; NOT CLEAN |
| Candidate production audit | exit0:0 |
| Pinned npm ls image-size sharp --all | PASS with final global sharp override, including clean-install repeat |
| Full unit npm run test:unit | 1527/1527PASS,0fail/skip;306.953s |
| Budgets npm run test:budgets | 15/15PASS |
| Typecheck/lint | PASS |
| Web/desktop frontend builds | PASS before commit and again exact committed head |
| Synthetic real-browser menu save/open/STEP/GLB | Six widths1440,1280,1100,768,390,320 PASS;0pageerrors |
| Golden scoped realbrowser lifecycle | SVG→40mm resize→12mm exact model→brass→undo/redo→save download→tabclose→newtab→open→compare actual geometry/material fields→STEP/GLB PASS;0pageerrors |
| Parser/local Images binding | Generated32x16PNG→16x8WebP through actual Miniflare/workerd IMAGES PASS; patched sharp/image-size APIs pass; exact-head repeat PASS |
| Emitted local Worker | /og.png200; valid /_vinext/image500 ASSETS.fetch not function; externalURL400 (repro assertionsPASS, endpoint isBROKEN) |

Unit run occurred before commit using unchanged application/test code from1e7f6d1 plus the patched installed dependency tree. During run the scoped sharp override became global solely to repair npm10 dedup-edge validation; package-lock SHA stayed bd2219af132c72ee9bdb2d522512eb02e940743b6d2e06dcb5b256c9363b2cbd and installed versions were unchanged. This is qualified candidate-content evidence, not a claim that the unit command ran after commit. Full existing suite was not weakened. Exact-head builds and parser smoke were rerun after clean install and commit.

## Exposure/independent review
Separate native OpenAI Codex reviewer produced review.md, final exact diff approval, reviewer-candidate-identity.json and desktop import traversal. Runtime-provided identity for parent/reviewer is OpenAI GPT-6/Codex; exact serving suffix not exposed. No Luna or fallback invoked in this bounded cycle; no Claude/Sonnet/Opus review. Requested routing remains Sol; no claim that another named suffix executed. Reviewer did not deploy or authorize release.

Vinext image-size consumes local static-import/metadata files during build: untrusted image build inputs are a concrete surface, not ordinary image request bodies. Worker optimizer validates URLs and delegates decoding to Cloudflare Images. Miniflare uses sharp for local image emulation; actual synthetic binding exercised. Managed Cloudflare codec security/deployed exploitability not certified. Desktop build entry/import boundary reviewed, native packaged artifact/OS codecs not qualified.

Independent review identified unchanged Worker binding mismatch. ASSETS is R2 with get/put/delete in assetAPI, but image endpoint calls ASSETS.fetch; generated Worker config lacks explicit static Fetcher and IMAGES. Actual local artifact confirms500. Deduplicated followup CORE-FORM-WORKER-IMAGE-BINDING-001 queued with repro, preserving R2/static API and no inferred paid binding entitlement. This is not introduced by dependency repair.

## Preserved failures/limitations
Initial browser-golden attempt failed connection-refused because listener startup was not ready; unchanged assertions passed repeat. Initial local smoke used obsolete Miniflare constructor and then relative modulesRoot; both harness errors/logs retained, corrected to installedV5 API/absolute path; actual image assertions retained. Scoped sharp override initially made pinned npm10 parser tree invalid although npm11 accepted it; global override repaired pinned npm10 and clean-repeat passed. Full-tree npm ls also reports peer/optional-install problems (three/openvdb,webpack,optional sharp wasm): full-tree clean validity NOT claimed.

Residual audit8high+4moderate: braces/glob chains through ESLint and Vinext commonjs/dynamic-import tooling plus Drizzle/@esbuild-kit/esbuild moderate paths. These inherited audit groups are not12 distinct confirmed exploits. No compatible patched braces version was established; npm suggested downgrades would be breaking/unqualified. esbuild advisory concerns activated serveAPI; configured db:generate is not itself proof of serve reachability. Untrusted build/lint inputs remain a trust boundary. Full advisory-by-advisory runtime exploitability, deployed source/artifact identity, signed/native clean-machine and complete Model/Sketch/Fabric/Animation golden/platform qualification remain unknown. Prior mandatory hosted CI billing/spending outage remains release blocker; no bypass/retry.

Checkpoint BLOCKED: scoped remediation reviewed and pushed, but remaining security work not falsely closed. Resume on a published compatible braces/tooling fix OR a concrete compatibility-reviewed replacement plan, then exact-head full audit and affected builds/tests; release additionally requires mandatory CI/downstack/native/source-artifact gates. Keep residual work on this existing task; no duplicate security followup created. Worker binding defect has distinct task above.

Exact-head automatic CI observation03:51Z: PR7 open, web/native jobsFAILURE, desktop-artifactSKIPPED. Web job113139727449 ran zero steps and check annotation explicitly confirms failed account payments/spending limit. Evidence ci-observation.json; no manual retries or gate bypass.

Local listener teardown observation: the running Wrangler watcher reloaded while the postcommit web build replaced dist and transiently failed with `No such module __vite_rsc_assets_manifest.js` imported from index.js. This is a build/watch race in this qualification harness, not a passed runtime check; original request results preceded rebuild. Raw observed failure preserved in worker-watch-race.log. No deployment occurred.

After stopping/restarting the rebuilt exact-head Worker cold, exact-head-worker-cold-repro again verified static200, valid-image500 and externalURL400 at03:52Z. Cold startup succeeded; watcher failure above was transient during live rebuild. All qualification listeners stopped.
