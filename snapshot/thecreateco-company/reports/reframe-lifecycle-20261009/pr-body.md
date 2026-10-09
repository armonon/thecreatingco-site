## Scope
PROGRAM18-REFRAME-LIFECYCLE-001: scoped additive Reframe repair on `wave4/scenepilot-suite` (fb42d12). Do not merge an unqualified parent stack or publish the incomplete site tree wholesale.

- Latest-only async analysis and cancellable preview loads; preserve pins/letterbox on face-toggle/model failure.
- Editable versioned session save/import, SHA-256 media relink, strict schema checks, documented reopen workflow.
- Fence stale render results/progress; clear invalidated exports; record actual source dimensions.

## Local evidence
Candidate 08a64180df7ca80f64436437027d8fc10b5c65df. Luna implementation, independent Sol inspection/browser qualification.
- 26 focused tests; TypeScript; targeted ESLint; tools build; diff check: PASS.
- Built Chromium: first-load decoded preview; overlapping selections; failed face model + toggle pin/letterbox preservation; wrong-hash rejection; export invalidation/retry: PASS.
- Actual save/close/new page/identical renamed media/relink restored settings, targets, pins and letterbox; video export: PASS.
- Independent ffprobe/full ffmpeg decode confirms H.2641080x1080. Four moving-red-subject decoded frames match independent crop/letterbox references (RGB MAE<0.43/255; centroid deltas<1px).

## Gates and limitations
No merge/deployment/release. Mandatory hosted/stack/review gates remain. Chromium synthetic local coverage is not real-footage tracking quality, phone hardware, other browsers or source/live parity. Existing fixture named reframe-smoke.mp4 is actually constant black/gray; meaningful moving-subject qualification used a newly generated local synthetic clip instead. Interrupted dependency restore and HMR test are retained as failed evidence; sole exact-lock restore and stable built reruns pass.

Local evidence: /Users/agentsattari/thecreateco-company/reports/reframe-lifecycle-20261009/README.md
