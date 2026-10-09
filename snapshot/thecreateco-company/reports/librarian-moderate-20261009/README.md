# Librarian moderate dependency reachability assessment

Task: PROGRAM18-LIBRARIAN-MODERATE-DEPS-001. Actual model: openai/gpt-6.1-sol, confirmed via session_status at 2026-10-09 14:14 UTC. Complex security/reachability judgment directed by Sol; execution, dependency collection and assertions handled by deterministic Python/Node/npm. No Luna/Astra or other model requests, no new paid services. Preflight returned advisory continue with unknown budget limits; this was not spending approval.

## Exact source and ownership

Clean detached assessment checkout: /Users/agentsattari/code/worktrees/librarian-moderate-assess-20261009, ca7e806c86d376e707c0afdefc8a0e84ff40b35e. Existing product checkouts untouched. Queue had no active product owners at selection; commissioning proof already COMPLETE, so selected the highest eligible severity P2. No company/lab PAUSE and no leases needed recovery. Claim owner company-director; token used only in queue CLI. Source and lock unchanged, confirmed by source.log and recorded hashes. PR3/source deployment remains unchanged.

## Findings and actual checks

- Fresh full npm audit: 0 critical, 0 high, 13 moderate (exit 1 means findings). Production-only audit: 0 findings, exit 0. These are dependency audit results, not a complete privacy/native-platform/security qualification.
- UUID7.0.3 is pulled through Xcode3.0.1. Its only UUID API call in lib is pbxProject.js:90, uuid.v4() with zero arguments. Vulnerable buffered v3/v5/v6 APIs are not used at this inspected call site. Do not infer the entire package is repaired.
- Actual Xcode parser loads the repository iOS project, generates 100 unique 24-character uppercase IDs, adds a group, writes a report-only project and reparses it. A spy confirms 101 v4 calls with no arguments. Baseline passes.
- Report-only UUID11.1.1 CommonJS substitution passes the identical actual Xcode operations. Its normal v5 output matches UUID7, while short-buffer v5 rejects with RangeError; UUID7 accepts the short buffer. This supports a targeted xcode UUID11 override follow-up, not blind package-wide/ESM-latest upgrades. It is not a lockfile repair or install/full-native-toolchain qualification.
- sprintf-js1.1.3 remains the registry latest at this observation; no same-package fixed release is available. Roarr2.15.4 treats multiargument string calls or context-plus-message calls as formats. A safe precision101 control throws RangeError when the caller controls the format. This is not an unbounded DoS reproduction.
- Inspected global-agent3.0.0 log sites use fixed message literals; URLs, proxy settings, headers and errors go into structured context. Actual Roarr context and single-string cases preserve precision-like text literally. Actual global-agent unconfigured-proxy Agent.addRequest preserves a precision-like request URL in context and invokes the fake fallback once without a network request.
- Do not force old electron-builder/Capacitor versions merely to reduce audit counts, and do not suppress advisories. sprintf remains an upstream logger-chain upgrade/patch decision with bounded call-site exposure, not an exploitable network path proven here.

8/8 deterministic assertions PASS. See verify.cjs, results.json, commands.json, registry metadata and audit/source logs. Rejected diagnostic invocations are preserved: initial rg --glob *.js expanded to the root filename and returned no matches; corrected quoted-glob scans returned exit0. Missing installed dependencies in the earlier checkout were resolved by an isolated clean npm ci --ignore-scripts --no-fund --no-audit (exit0,409packages); unrelated install scripts/Electron downloads were intentionally skipped. UUID candidate installed only into report fixture with scripts/audit disabled (exit0).

## Scope and next action

Assessment COMPLETE; vulnerabilities are not repaired or waived. Queue a scoped Luna implementation capsule for the validated xcode UUID11 override, with independent OpenAI review, exact lock installation, actual asset/sync-tool compatibility and normal PR/CI gates. Keep sprintf residual explicitly open; track upstream replacement/patch without speculative downgrades. No product edits, push, merge, release, external messages, downloads of Electron binaries or native/physical-platform claims in this cycle. Existing public-reader and release blockers remain.
