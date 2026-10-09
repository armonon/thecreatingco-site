# Independent scoped review — CORE-FORM-WORKER-IMAGE-BINDING-001

## Disposition

**APPROVE the narrow local Worker binding/fallback repair. No blocking candidate-introduced findings.** This is source review plus local evidence assessment, not production/release/full-product qualification. Normal exact-head required reviews/checks remain necessary; source/live/native/hosted/downstack gates remain unresolved. No deployment, access/binding changes, spending, queue mutation or product edits performed by this reviewer.

## Reviewer and exact source identity

- Independent native child reviewer; inherited `openai/gpt-6.1-sol`, confirmed by parent session_status metadata. No model override/fallback; child usage/cost not exposed.
- Worktree: `/Users/agentsattari/code/worktrees/form-worker-images-20261009`; branch `fix/form-worker-images-20261009`.
- Base and HEAD at review: `be1f7272c5689d6401194d643fa3eb09a2b0b73b`; candidate still uncommitted.
- Tracked diff file: `independently-reviewed-tracked.diff`, exact SHA-256 `e60afeff75b7b331ef486c4504e72387cde844637fc592b2d17045198183c565`. This diff includes the three tracked files; the added untracked script is identified separately below. All four final source contents were inspected.
- `worker/index.ts`: `4283c69bf2ec961ac23c9cb7bcf6aa554452cf8c9c75b6d33c0d1363d2107ff9`
- `vite.config.ts`: `a59955895d7f6aef79d5d4aff17604388c81cdc677abbcf86bff2bbabf787c94`
- `package.json`: `458ed1a1d410f007ccb8cd5442ac40395e1c4e799dfed9c1059912eff213bd9f`
- `scripts/test-worker-image-binding.mjs`: `08fb5b0c24c0b4e4f2436da796c37f787cd846c8d84886860ab47af900967332`

## Findings and reasoning

- **No blocking regression:** emitted config has `STATIC` Assets Fetcher and `ASSETS` R2Bucket. Optimizer only fetches through STATIC, not through R2 or dynamic APIs. The vinext handler receives its expected `ASSETS: env.STATIC` adapter. API modules import the original global `cloudflare:workers` env, preserving DB and R2 operations; they do not consume the narrowed handler adapter. Runtime R2 CRUD evidence corroborates this separation.
- **No blocking security regression:** same-origin/local-path validation and safe image MIME allowlist remain in vinext. SVG/nonimage sources reject; absent IMAGES returns original PNG bytes/type even with positive width and WebP Accept, rather than claiming transcoding. Successful fallback retains CSP sandbox, nosniff, inline disposition, Vary Accept and immutable cache headers. Static-only private API proxy denial is tested.
- **P3 advisory, preexisting dependency behavior:** one-year immutable caching also applies to non-content-addressed public static paths. A changed image at the same URL can remain stale. Concrete future fix: version/content-hash image URLs, or qualify an upstream configurable cache policy for mutable sources. Not introduced by this patch; private R2 paths are not exposed through the optimizer.
- **P4 advisory, preexisting dependency parser behavior:** parseInt accepts numeric suffixes such as `w=640junk` and `q=75junk`. Concrete future fix: strictly validate decimal strings before range/allowlist checks upstream. This does not enable arbitrary origin/width access and is not a repair blocker.
- Initial test timeout advisory was resolved before final review: fetch now uses a 10-second AbortSignal; D1 subprocess has a 30-second timeout; shutdown escalates SIGTERM to SIGKILL with bounded waits.

## Tests executed independently versus evidence read

**Executed by reviewer:** targeted installed-vinext dependency smoke, seven cases PASS: external URL, scheme-relative URL, backslash-normalized external URL all reject without asset fetch; SVG, HTML, octet-stream MIME reject; no-transform PNG passthrough preserves synthetic bytes with nosniff/CSP/Vary/cache headers. This deliberately does not claim a real PNG decode or emitted Worker run. No duplicate broad build or golden run executed.

**Read and inspected:** current `scripts/test-worker-image-binding.mjs`; `worker-image-regression.log` explicit PASS and actual Wrangler local binding list/HTTP response sequence. It starts the emitted Worker with local isolated state and validates static bytes, no-IMAGES fallback at widths 0 and 16, WebP Accept with original PNG type/bytes, cache/security headers, invalid external/scheme-relative URL and width, SVG/nonimage/missing source, authenticated real local R2 POST/GET/DELETE and 401, and optimizer refusal to proxy a private R2 API path. Synthetic identity is only a local fixture, not proof of hosted authentication infrastructure.

Read successful repaired web build and desktop build logs, typecheck invocation/log, empty targeted lint log (parent reports exit success; empty output alone is not exit-code proof), and browser-workflow.log. Browser evidence reports material undo/redo, save → full browser close/relaunch → reopen/compare, real Worker STEP download and GLB header checks, errors `[]`. These were not rerun independently. Parent full check/focused asset tests are in flight and not asserted passed here.

## Limitations and gates

- Actual IMAGES-present transform success/error behavior is unqualified; optional callback remains the existing provider API path with captured binding. No new binding/spend was authorized or performed.
- No hosted/live deployment, production authentication, remote D1/R2, native/desktop runtime, complete Form workflow/long-session qualification, or downstack release-gate clearance is claimed.
- Local browser golden evidence reduces regression risk; this narrow patch does not alter material/UI source. It is not proof of every material/model workflow.
- Any source-content changes after these hashes require an updated review. A later commit may retain the reviewed hashes, but exact-commit checks must still pass independently.
