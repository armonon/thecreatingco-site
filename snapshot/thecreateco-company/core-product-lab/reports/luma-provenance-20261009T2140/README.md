# Luma production provenance — 2026-10-09

Task P01; owner core-lab-20261009T2140-sol. Status BLOCKED, useful qualification batch completed; no production changes.

## Measured observations

- Netlify read-only API currently reports published deploy `6ac5d1a6d2965007d3910de2`, title “Cutout portable editable projects and safe failed imports”, published 2026-10-07T05:01:15.959Z. This supersedes the older WAVE5 observed deploy `6ac5b824…`. Commit and branch are null; context is deploy-preview despite being published. This is metadata, not proof of source identity.
- Full 1,692-file API manifest retained. At isolated clean source `30bea20f862c4302887b79b89f364f2d7bdf5710`, all 1,292 live-static overlay files match published SHA1; no stale or absent overlay files. All 277 public source files also match. Overlay equality is not complete source/deploy equality.
- Remaining 400 files: 277 public files, 122 compiled app/service-worker files and one netlify.toml. All 122 app/service-worker files downloaded from the deploy-pinned URL: HTTP200 and exact manifest SHA1, 36,175,449 bytes total. The deployed netlify.toml hash differs from source. Original compiled app inputs and server/function provenance remain UNKNOWN.
- Actual production overlay plugin dogfood in an isolated synthetic publish tree PASS: 1,291 exact copies, one intentionally conflicting fresh asset preserved, app-only file preserved, real homepage replacement exact. No deployed tree modified. This tests additive overlay semantics, not full Netlify assembly or product golden workflow.
- `npm run build:netlify` FAIL exit1, then one retry FAIL exit1: Turbopack rejects out-of-root node_modules symlink. Source unchanged. Attempted `cp -cR` returned0 but preserved the source symlink instead of dereferencing it. The initial “private copy” assumption was false; environment-diagnosis.json records the correction. Both raw build logs/results and panic logs retained. No identical third retry or assertion relaxation.

## Evidence and scope

Commands: python3 qualify.py; python3 map_public.py; node overlay-check.cjs; npm run build:netlify (two attempts). Scripts, manifests, raw fetched bytes, SHA1 comparison rows, command results and environment are adjacent to this report. Source worktree: /Users/agentsattari/code/company-worktrees/luma-provenance-20261009T2140; git status clean. Host/node/npm versions recorded in source-environment.json and environment-diagnosis.json. Existing Netlify CLI credential used only for authorized GET metadata/manifests; value not logged or stored in evidence.

Build and full UI synthetic golden save/reopen/export are NOT qualified. Official Netlify plugin/functions/redirect assembly, independent source attribution, physical/native/runtime/deployed golden workflow and mandatory hosted/stack gates NOT run. No consequential source change; no UX/design or independent review claimed. No commit/push/merge/deployment: qualification-only evidence, no agent-owned source branch.

## Models / cost

Director: actual OpenAI GPT-6.1 Sol runtime; executor deterministic Python/Node/shell. No Luna/Astra/reviewer/fallback calls. Preflight continue is advisory, all limits null, coverage partial; null budgets are not spending approval. No extra model invocation or invention request justified for this source-provenance task. Billed cost unknown.

## Resume

Reuse P01. Recover the original build input/receipt for published deploy 6ac5d1a6d2965007d3910de2 or independently establish a reviewed complete replacement candidate. Resolve dependency symlink via actual private dependencies on supported Node22/24, rerun npm run build:netlify, assemble Netlify functions/redirects, preserve all1692manifest paths, qualify synthetic UI save/reopen/export, and pass exact-source independent OpenAI/stack/CI gates before any promotion. Do not rollback or carry opaque compiled app chunks forward as source.
