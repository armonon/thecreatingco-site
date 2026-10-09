# Form Worker image-binding checkpoint — 2026-10-08

Task: CORE-FORM-WORKER-IMAGE-BINDING-001. Outcome: BLOCKED, not repaired or release-qualified.
Owner: director-form-images-20261008T1549. One bounded source/config audit; no competing running product lease in refreshed state. Company and lab PAUSE absent. Lease acquired through company CLI; token retained only for CLI completion, not this report.

## Selection and actual routing

Read company AGENTS.md, DIRECTIVE.md, engine/README.md, COMPANY_STATE.md, AUTONOMY.md, CI_OUTAGE_POLICY.md, REVENUE_DIRECTIVE.md, model-routing.json, Core Lab DIRECTIVE/HEALTH and named18 directive/manifest/matrix. RELEASE_MATRIX.md is at company root, not release-program/; initial missing-path read corrected. No startup-memory reread. Core Lab severity-first `next` selected the Form binding task over unrelated experiments. Preserved first-wave scope and all product holds.

Runtime session_status confirmed actual director openai/gpt-6.1-sol. No fallback, Luna or independent reviewer invoked; no implementation candidate exists to approve. No Claude review. System-configured fallback availability is not evidence of execution.

## Verified observations

Read-only checkout `/Users/agentsattari/code/worktrees/form-runtime-security-20261008T0340`, clean exact SHA `be1f7272c5689d6401194d643fa3eb09a2b0b73b`. Five source/emitted contract assertions PASS; hashes/UTC observation in preflight.json:

- Emitted `r2_buckets` binds ASSETS as R2; static assets has no explicit Fetcher name.
- Worker optimizer calls `env.ASSETS.fetch`, incompatible with that R2 contract.
- Authenticated project asset route independently uses ASSETS.get/put/delete; do not rename or replace this storage binding.
- IMAGES is absent from emitted config. Vinext supports optional transformImage; safe passthrough is a possible repair without buying or enabling Images.
- Fetch-source failure occurs before the transform fallback. Preserve allowed URL/width/content-type/SVG and security-header checks; static Fetcher must not proxy private authenticated asset routes.

Historical exact-source cold Worker receipt (03:52Z) reports static PNG200, valid optimizer500 and externalURL400. Historical same-head web/desktop builds passed at03:48Z. These are reused historical baseline evidence, NOT new tests or repaired behavior. Fresh HTTP/native/platform/deployed evidence is not claimed.

## Resource blocker

At15:49:16Z, filesystem free space was170614784bytes (about163MiB). `df -h` reported160MiB and100%used. Existing emitted web/desktop artifacts alone total95908810bytes; an isolated source checkout, build intermediates and required tests need additional unqualified headroom. No disk-capacity-qualified isolated build can be justified in this run. Did not start writes/builds likely to exhaust disk, modify another worker's checkout, or delete/reclaim private data, worktrees, dependencies or evidence. No branch/commit/push/PR/deploy created. No repair claimed.

## Actual commands/checks

- `python3 engine/company.py recover`: PASS, recovered[].
- `python3 engine/company.py refresh`: PASS.
- `python3 core-product-lab/lab.py next`: selected this queuedP2 task.
- `python3 engine/company.py claim --owner director-form-images-20261008T1549 --id CORE-FORM-WORKER-IMAGE-BINDING-001 --minutes35` (actual argument: `--minutes 35`): claimed.
- `session_status current`: actual OpenAI/Sol director confirmed.
- `git worktree list`, `git status --short`, `git rev-parse HEAD`: source ownership/candidate inspection; clean.
- `cat`/`sed` of worker entry, Vite config, emitted Wrangler config, authenticated asset route and installed Vinext optimizer: binding/fallback inspection.
- `df -h /Users/agentsattari`, `du -sk dist desktop-dist`: disk preflight.
- Python stdlib read-only assertions/hash/disk/source receipt: PASS5/5; `preflight.json`.
- Web/desktop builds, full units and new Worker HTTP/R2 CRUD: NOT RUN in this cycle, blocked by capacity. Independent review: NOT RUN, no patch.

## Exact resume path

Restore sufficient capacity through approved recoverable cleanup or provision a separate authorized build volume; do not delete existing workers/evidence. Then requeue this SAME task via company CLI with disk-resolution evidence (no duplicate bug), claim a fresh lease, create an isolated branch from the latest reviewed Form stack, set a separately named static Fetcher in configuration/entry, and use explicitly supported passthrough if IMAGES is unavailable. Verify actual emitted Worker PNG200 and byte/header semantics, invalid external/scheme-relative URL/width400, SVG policy, missing/nonimage source, original static routing and authenticated R2CRUD. Run web/desktop builds and appropriate tests; separate bounded independent OpenAI review before reviewed push/PR. Exact-head required hosted/downstack/native/source-live gates remain unresolved; no billing retries, gate bypass or deployment. Product remains ALPHA/unqualified and named18 completion remains incomplete.
