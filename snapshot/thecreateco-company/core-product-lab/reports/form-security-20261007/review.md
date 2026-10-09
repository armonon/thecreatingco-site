# Form security dependency patch — independent review

Date: 2026-10-07. Reviewer: separate, isolated Codex native OpenAI reviewer. Parent requested `gpt-6.1-sol`; spawn was accepted with no fallback reported. Runtime-provided identity is GPT-6/Codex; exact runtime suffix was not independently surfaced. No Claude used.

Scope: read-only review of `/Users/agentsattari/code/worktrees/form-security-20261007` against base `b5abdd1`. Checkout was not modified. This report is not release or deployment approval.

## Recommendation

No blocking defect found in the three-file dependency repair. Recommend accepting this narrow source dependency change subject to the parent's checks and existing PR/release gates. Do not characterize it as deployed-runtime remediation or full release readiness.

## Verified evidence

- Only `package.json`, `package-lock.json`, and `KNOWN_ISSUES.md` differ from base. `git diff --check b5abdd1` passed.
- Manifest changes only Next from `^16.3.1` to exact `16.3.8`; actual base lock was Next `16.3.4`. Production and development dependency sections exactly match the lock root.
- Lock comparison found 39 changed package entries including root, no additions/removals: Next/env/SWC `16.3.4 → 16.3.8`, Next's optional sharp and platform binaries `0.35.4 → 0.35.5`, libvips binaries `1.3.3 → 1.3.4`, and shared source-map-js `1.2.1 → 1.2.2`. No unrelated version drift, new scripts, overrides, or registries observed.
- `npm ls next sharp source-map-js react react-dom vinext --all` passed (exit 0), showing Next `16.3.8`, nested sharp `0.35.5`, and all displayed source-map-js consumers `1.2.2`.
- Independently queried `npm view` for Next `16.3.8`, sharp `0.35.5`, and source-map-js `1.2.2`; all three published dist.integrity values match the lock. This was a metadata check, not an independent download/hash verification of every platform tarball.
- Next and sharp require Node `>=20.9.0`, compatible with project `>=22.13.0` and observed Node `v26.9.0`. React/react-dom `19.2.8` satisfy Next's `^19.0.0` peers and Vinext `0.0.50`'s `^19.2.6` peers. Next's optional SWC entries are aligned at `16.3.8`. No peer incompatibility found.
- Supplied `baseline-audit.json` reports three vulnerable package groups (one critical Next, high sharp, high source-map-js). Their recorded vulnerable ranges exclude the candidate versions: Next advisories end before `16.3.6` or `16.3.8`, sharp `<0.35.5`, source-map-js `<1.2.2`.
- Supplied `fixed-audit.json` has no advisories. I inspected those reports; I did not independently rerun audit. Supplied `baseline-ci.log` is an installation log (successful install with full-tree vulnerability summary), not a test-suite failure transcript.

## Exposure and non-blocking boundaries

1. Website scripts run Vinext, not `next build/start`. The Cloudflare worker delegates to `vinext/server/app-router-entry`. App API assets/scenes use Next-compatible request/response imports, so compatibility checks remain important even though no route source changed.
2. Search found no application `next/og`/`ImageResponse`, `use cache`, `draftMode`, or actual next/image import. This reduces evidence of the named Next advisory paths being exercised; it does not prove deployed exploitability absent.
3. `worker/index.ts` explicitly exposes `/_vinext/image`, using Vinext's handler and Cloudflare `env.IMAGES` transformation. Installed Vinext handler only accepts relative local paths, normalizes backslashes, checks origin stability, and blocks SVG by default. Next's image optimizer advisory fix must not be represented as an independent security certification of this separate endpoint.
4. Desktop builds use the separate Vite `desktop` root; Tauri bundles `desktop-dist`, with no Next server configured. No claim is made about a shipped binary's dependency tree or runtime.
5. Development graph still includes sharp `0.35.2` under Cloudflare/Miniflare, as independently observed by `npm ls`. The production-only zero-advisory result is not a clean full development-tree result. Existing development advisories remain out of this patch's intentionally bounded scope.
6. `KNOWN_ISSUES.md` appropriately narrows its claim to an isolated source candidate and explicitly preserves desktop/release gates. ESLint's existing Next config remains `16.3.0`; no demonstrated incompatible peer requirement was found, and lint/build results must be evaluated by the parent.

## Testing and blockers

I ran dependency-tree, JSON lock comparison, registry metadata, source exposure inspection, and whitespace checks only. I did not run application tests, typecheck, lint, website build, desktop build, native tests, or deployment smoke checks; the parent owns those executions. No patch-specific blocker found. Any pre-existing failed suite must remain recorded as an existing gate and must not be called fixed by this dependency-only patch; attribution requires parent baseline/candidate evidence rather than assumption.
