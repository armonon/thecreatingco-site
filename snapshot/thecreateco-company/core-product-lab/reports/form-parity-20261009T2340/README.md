# Form host/source parity qualification — 2026-10-09

Task P06; owner core-lab-20261009T2340-parity. Status BLOCKED.

## Measured findings
- Isolated clean detached source b5f8b08832dc7961b097ce2ae7a0c29db2fc0055 (PR9).
- Review GET /studio, /manifest.webmanifest, /sw.js: all HTTP200. HTML and fetched JavaScript SHA256 preserved. Bundle has Cast/Open Cast/Blender markers; Room Studio/room-studio markers absent. Marker absence is not proof of complete feature absence, and HTTP200 is not browser workflow qualification.
- Canonical form-3d-studio.armonon.chatgpt.site and public form.thecreatingco.com: /studio, /manifest.webmanifest and /sw.js all HTTP403 from this environment. No bypass/repeated retry. Canonical features and deployed source identity remain UNKNOWN.
- Source PR9 includes Cast UI but no app/room-* files. Primary wave5/form-room checkout remains dirty with other worker Room files; not staged, copied or modified. Room roadmap is not a delivered feature claim.
- PR6 d24f5d76b4fd0e99c43e1cb8e5e2d9b63db6665e is parallel to the PR9 stack. Its ASCII-STL repair is absent from PR9. Synthetic 20mm cube: text import 12 triangles/8000mm³; byte import on PR9 silently produces 26 triangles. Existing PR6 byte import produces 12 triangles/8000mm³. Reused existing repair/task; no duplicate task or blind cherry-pick.
- Cast/mesh closed-form and roundtrip tests: 52/52 PASS; desktop frontend production build PASS. Initial missing-three dependency failure retained separately, then resolved by linking the already installed exact-source dependency directory. No install/spending approval inferred.

## Scope and release boundaries
This is deterministic source/HTTP/geometry qualification, not full UI golden dogfood, visual/UX review, native packaging qualification or hosted CI success. Synthetic geometry tests and branch comparison do not establish full save/close/reopen/export or human usability. No source changes, code commit, push, PR update, merge, deploy, rollback or messages. No push was needed. Existing pushed PR SHAs remain remote metadata observations only, not this job's handoff.

## Resume condition
Provide an authorized readable canonical artifact or supported browser/session that can access canonical /studio without bypassing access controls, with deployed revision/manifest identity. Compare real Cast/Blender/Locker/PWA workflows on both exact artifacts. Reconcile PR6 through existing normal stack/review/CI gates; preserve dirty Room owner work. Do not publish review artifacts to the canonical host until provenance and parity are qualified.

## Execution evidence
See host-receipts.json, bundle-markers.json, open-prs.json, environment.json, geometry-tests.log, cast-tests.log, desktop-build.log, ascii-byte-repro.json and ascii-fixed-branch-repro.json. Model: OpenAI GPT-6.1 Sol director; deterministic execution. No Luna/Astra/independent reviewer invoked; no fallback. Cost usage unknown; preflight advisory continue with unset limits, not spending approval.
