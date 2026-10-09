## Scope
Correct stale Form workspace routing and persistence documentation only. Model/Fabric/Animation share a versioned `.form` container and project-level save/history session; native/browser recovery channels remain separate. Distinguishes direct navigation from reviewed mesh-snapshot transfer.

## Independent review
Separate OpenAI GPT-6.1 Sol reviewer approved the final narrow diff. Its initial routing finding (marketing `app/page.tsx` is not the editor) was corrected to `app/studio/page.tsx` and re-reviewed.

## Evidence / limits
Company task CORE-FORM-AUD-WF-002; dated evidence under `thecreateco-company/reports/form-handoff-20261008T1210/`.
Baseline exact parent be1f727: desktop frontend build, 42 focused persistence/history/animation tests, and 4 existing CAD/Fabric/handoff integration tests pass. Current real-built Chromium end-to-end audit evidence is recorded separately; no native or release certification is implied.

This is stacked on PR7 (`qa/form-runtime-security-20261008T0340`). Preserve all prerequisite reviews/checks. PR7 mandatory hosted web/native checks fail and desktop artifact is skipped at observation; no workflow retries, merge, deployment or release is authorized by this documentation update.
