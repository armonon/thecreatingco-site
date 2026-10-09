# Independent OpenAI security-evidence review

Task: CORE-SP-SEC-RESIDUAL-001. Reviewed candidate `c26d518bc3d05f0adbf7287f79c5f5f15ac25220` in the named isolated worktree. Reviewer: independent OpenAI Codex child context; exact inherited model identifier is **unknown** to this reviewer (no model override requested). Director independently reports runtime `openai/gpt-6.1-sol`; that is not substituted for an independently observed child model identifier.

## Verdict

**APPROVE bounded qualification checkpoint; required wording clarification verified as applied. Security closure, packaged/deployed absence, release approval and full golden qualification are NOT approved. Task remains BLOCKED.** No product files changed; no installation, build, registry call, push or deployment performed by reviewer.

## Verified evidence

- Current worktree HEAD matches the full candidate hash; git status is clean. Recomputed all nine SHA-256 values in source-hashes.json against current worktree/shared dependencies: all match. Shared dependencies are still not a clean isolated installation.
- commands.json records full audit exit 1 and production audit exit 0. Retained audit JSON supports 16 affected-package groups: 8 high, 8 moderate, 0 critical; production report contains no vulnerabilities. These are package groups propagating two leaf advisories, not sixteen independent defects. Both leaf lock entries are dev=true: braces 3.0.3 and sprintf-js 1.1.3 (the latter also optional). Production audit is not a deployed-binary inventory.
- dependency-paths.log supports both braces paths and the electron-builder → app-builder-lib → @electron/get → global-agent → roarr → sprintf-js path. Retained latest-version receipts and advisory ranges do not identify a fixed published leaf version. npm's fixAvailable downgrade suggestions do not establish a safe, compatible fix; no downgrade was validated here.
- Independently parsed main and renderer metafiles: 13 and 2081 inputs respectively; no braces, sprintf-js, micromatch, roarr or global-agent inputs. Main emitted imports externalize only Electron and Node builtins. Renderer emitted outputs contain zero external imports. These esbuild scopes do not reproduce configured Vite/Vinext transformations, staged resources or shipped artifacts.
- electron/package.json has explicit runtime files/renderer and no dependencies field. extraResources separately copy media tools, native runtime/model assets and the OpenVINO inpaint-provider runtime. vite.desktop.config.ts also copies public mediapipe/models assets, not represented by this esbuild qualification. No signed app.asar, packaged provider inventory, installer or hosted artifact was audited.
- Retained golden-components.log records 39 passes, 0 failures; this reviewer did not rerun these tests. The README correctly excludes real browser/native golden execution and perceptual export qualification. Environment receipt shows 157292 KiB available; deferral of capacity-heavy operations is justified, not a successful qualification.

## Input trust and reachability

- source-4: Next ESLint rootDir strings/arrays feed fast-glob without a nesting bound in that function. source-5: source dynamic-import expressions are converted into glob patterns passed to fastGlob.sync; path/extension restrictions do not themselves establish a nested-brace limit. Untrusted contributor-controlled lint settings/source therefore remain a plausible developer/CI input boundary. No exploit payload was executed and exact-source production-build exploitability is not established. Runtime graph absence cannot close build-tool advisories.
- source-6 and source-7: inspected global-agent calls use literal messages; request paths, proxy configuration, headers and errors enter structured context. Those values do not become sprintf format strings at these callsites. source-8: roarr passes the second argument directly to sprintf for context+message calls, and the first directly for multi-argument string calls. Single-argument strings use literal `%s`. Caller-controlled format strings remain possible in roarr's API. This is evidence about inspected callers only, not a global trust guarantee, every transitive callsite, or zero exploitability. README correctly retains that limitation.

## Wording clarification resolved

Original renderer external_imports=[] described **emitted-output imports**, not all metafile import records. Input records retain external-marked references for 11 unique relative paths (for example ../lib/pro-editor); they do not appear as emitted-output external imports. Director updated README to “no emitted-output external imports,” renamed the field emitted_output_external_imports, and recorded input_metadata_external_marked_paths. Reviewer re-read both updated files and verified their values against the metafiles. The limited runtime graph conclusion remains sound; this nuance does not show either affected leaf in emitted code.

## Resume conditions

Retain all sixteen audit groups and existing PR-stack/CI/release gates. Resume the same blocked task with adequate disk, a normal exact-source configured build/package, inspection of copied/staged provider/runtime resources and actual signed package contents, and authorized real golden execution. A fixed upstream version or independently reviewed narrow build-input mitigation is still needed for residual advisory closure. No release or deployment authorization is supplied by this review.
