# Community × Bounce integration checkpoint

Observed: 2026-10-10 09:12 PT  
Status: BLOCKED on canonical Community/NOW source and approved nonproduction identities; this is a design/queue checkpoint, not a product implementation.

## Result

- Wrote `INTEGRATION_BRIEF.md` with the first user-facing slice, Bounce/local-audio privacy boundary, native share vs. API publishing distinction, profile/embed direction, acceptance gates and current provider documentation references.
- Added durable company task `COMMUNITY-BOUNCE-SOCIAL-001`, status `BLOCKED`, dependency `NOW-PLATFORM-SOURCE-001`, provisional score 40.5 (an estimate, not a measured product KPI).
- No Community/Bounce code, provider credentials, social account, production media or deploy was changed. No post was published.
- No product source branch was created or pushed because there is no canonical Community source in this workspace and no product code changed.
- Central company/operations mirror: the first publish attempt from the original checkout was blocked by pre-existing unrelated untracked `.snapshot-1o1y1_q9/`, which was left untouched. A clean isolated checkout then ran the standard screened snapshot publisher. `company/operations` was pushed and verified at `71b73ce2f8f3c290f155e38fd0ea6a568824294f`; the snapshot contains this brief, checkpoint report, and `COMMUNITY-BOUNCE-SOCIAL-001` in the queue export. No product code branch was created or pushed because Community source is unavailable.

## Boundary evidence

- `reports/now-platform-20261009/PLATFORM_BOUNDARY.md`: Community is a separate hosted service; canonical source/proxy deploy and nonproduction identities are not identified; production profile image upload returned 502 and did not persist.
- Product registry: Community source repo/local path are null and release qualification is blocked on source/deploy provenance + authorized test environment.
- `code/wave4/bounce/README.md`: Bounce is a separate local-file music player; no Community integration is documented.
- `INTEGRATION_BRIEF.md` links current official Instagram and X provider references. Facebook Page publishing permissions/access were not verified and are explicitly not promised.

## Deterministic checks

`python3 engine/company.py recover` — PASS; no expired leases recovered.  
`python3 engine/company.py refresh` — PASS; generated state refreshed.  
`python3 engine/company.py enqueue --file <temporary JSON>` — PASS; task `COMMUNITY-BOUNCE-SOCIAL-001` stored as BLOCKED with source task dependency.  
`python3 engine/company.py status` — PASS; compact state refreshed. A deterministic SQLite/export check confirmed the task is `BLOCKED`, depends on `NOW-PLATFORM-SOURCE-001`, and appears in `TASK_QUEUE.json`.

Product builds/tests were not run because no product source changed.

## Resume condition

Identify the canonical Community/NOW source repository, exact deployment/proxy provenance and authorized nonproduction test identities. Then inspect current auth/media APIs and start with music-card + Bounce metadata/deep-link + native-share fallback. Keep external provider publishing a separate, gated increment.
