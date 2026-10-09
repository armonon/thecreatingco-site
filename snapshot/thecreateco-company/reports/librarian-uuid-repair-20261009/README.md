# Librarian targeted Xcode UUID override

Task: `PROGRAM18-LIBRARIAN-UUID-REPAIR-001`  
Assessment/source base: `/Users/agentsattari/code/worktrees/librarian-moderate-assess-20261009` at `ca7e806c86d376e707c0afdefc8a0e84ff40b35e`.  
Implementation checkout: `/Users/agentsattari/code/worktrees/librarian-uuid11-repair-20261009`, branch `fix/librarian-uuid11-20261009`, created from that exact commit.  
Actual model: OpenAI GPT-6/Codex worker context. Exact routed model was not available from session tools, so Luna routing is **unverified** and is not claimed. No model/API calls or new paid services were made by commands; npm registry access was used for the bounded dependency install/audits.  
Window: began `2026-10-09T15:11:13Z`; evidence assembled by `2026-10-09T15:13:03Z`.

## Source decision and exact patch

The reviewed assessment found Xcode 3.0.1 calls UUID v4 with no arguments and demonstrated actual parser/project mutation compatibility with UUID 11.1.1. UUID 11.1.1 preserves the normal v5 output tested against UUID 7.0.3 and rejects the short-buffer v5 case that UUID 7.0.3 accepted. This justifies a scoped `xcode -> uuid: 11.1.1` override for the P2 UUID advisory; it is not a claim that all UUID consumers or APIs have been exhaustively qualified.

Only two tracked files changed:

- `package.json`: added `"xcode": { "uuid": "11.1.1" }` under `overrides`.
- `package-lock.json`: pins the corresponding UUID 11.1.1 package/integrity and metadata.

All existing overrides (`@capacitor/assets.sharp`, `http-cache-semantics`, and self-referential `@capacitor/cli`) remain intact. Patch bytes are in `patch.diff`, SHA-256 `d7bada417ff4550ac55f0d5b5650bb6120867cb4d73ca1cb7d16318bd8733238`.

## Commands, times, exits, results

Times below are UTC. Commands ran from the implementation checkout unless noted.

| Time / command | Exit | Result |
|---|---:|---|
| `2026-10-09T15:11:13Z` `npm ci --ignore-scripts --no-fund --no-audit` (before edit) | 0 | Clean bounded install, 409 packages; scripts/Electron downloads skipped. |
| `npm pkg set 'overrides.xcode.uuid=11.1.1'` | 0 | Scoped manifest change. |
| `npm install --package-lock-only --ignore-scripts --no-fund --no-audit` | 0 | Lock updated. |
| `npm ci --ignore-scripts --no-fund --no-audit` (after edit) | 0 | 409 packages installed from changed manifest/lock. |
| `npm ls xcode uuid --all` | 0 | Both `@capacitor/cli` and the assets tool resolve Xcode 3.0.1; its UUID is overridden to 11.1.1. |
| `node -p "require('uuid/package.json').version"` | 0 | `11.1.1`. |
| `npm test` | 0 | 44 tests passed, 0 failed. |
| `npm run build` | 0 | Vite production build passed. |
| `node reports/librarian-uuid-repair-20261009/verify-xcode.cjs <implementation> <assessment>` | 0 | Actual Xcode parser generated 100 unique project IDs; spy observed 101 no-argument v4 calls; add-group/write/reparse passed. Normal v5 output matched UUID 7.0.3 and UUID 11.1.1 threw `RangeError` for a one-byte short buffer. Result and output project hash are in `xcode-result.json`; generated project is report-only. |
| Copied-input `npx --no-install capacitor-assets generate --ios` | 0 | Generated 13 iOS icon/splash assets in isolated copy. Log: `capacitor-assets-generate-ios.log`. |
| Copied-input `npx --no-install cap sync ios` after including `scripts/normalize-ios-package.mjs` | 0 | Actual copy/update sync completed; two plugins recognized and SPM manifest written. Log: `cap-sync-ios.log`. Isolated copied input path is in `capacitor-results.json`. |
| `npm audit --json` | 1 | 8 moderate, 0 high/critical; UUID advisory no longer present. Full registry report: `audit-full.json`. |
| `npm audit --omit=dev --json` | 0 | 0 production advisories. Report: `audit-production.json`. |
| `git diff --check` | 0 | No whitespace errors. Pre-commit tracked diff was exactly the two target package files. |

Diagnostic failures are retained rather than treated as passes:

- The first isolated `cap sync ios` reached copy/update but failed its configured after-hook because the initial minimal copied fixture omitted `scripts/normalize-ios-package.mjs`. After copying `scripts/`, the direct actual `cap sync ios` passed as listed above.
- `npm run ios:sync` in that same minimal fixture failed at Vite entry resolution (`index.html` absent), because the fixture intentionally copied built `dist`, assets, iOS inputs, config, package files and scripts but not the whole source tree. It is **not** claimed as passing. Standalone `npm run build` passed in the full implementation checkout, and the direct Capacitor sync tool passed on copied isolated native inputs.

## Audit residual and limits

The fresh full audit still reports moderate advisories for `sprintf-js` and its logger chain (`roarr`, `global-agent`), plus Electron packaging dependencies. Preserve `sprintf-js` as an explicit open residual: this capsule does not patch, suppress, or claim to repair it. The production dependency audit is clean, but this is not a complete app/native release security qualification. No Xcode/iOS build, Electron binary download, physical-device test, push, merge, or release was performed. No existing product checkout or lease was modified.

## Review state

Implementation commit: `dce2f0f7e7e6a235967ccc19e55db3fcf8af1056` (`fix: pin xcode UUID dependency to 11.1.1`). The worktree is clean after commit. No push, merge, release, or queue completion was performed. Parent/director independent review is still required.

## Director checkpoint

Independent OpenAI GPT-6.1 Sol review PASS; exact manifest equality and single lock-entry mutation asserted. Director independently reran all44 tests, exit0. See independent-review.json and independent-test.log. Sol runtime confirmed by current session_status. Native spawn explicitly requested gpt-6-luna; child actual model route/usage was not exposed and remains unverified. No Astra used. Preflight advisory continue; unset cost limits not treated as spending approval.

Pushed dce2f0f7e7e6a235967ccc19e55db3fcf8af1056, remote ls-remote equality verified, and opened draft https://github.com/armonon/librarian/pull/4. No merge/deployment/release. Live PR3 is already MERGED (by prior work, not this run). Fresh origin/main413e3e9 descends from ca7e806 with newer unrelated code/native/docs; package manifest/lock match candidate parent exactly, but main integration/native/required hosted gates remain unqualified. NEEDS_REVIEW checkpoint retains these normal gates; next eligible cycle should qualify updated-main integration and exact-head required checks, avoiding billing retry loops. Logger sprintf residual remains open.

Completed director checkpoint at 2026-10-09T15:15:11.374767+00:00
