## Repair
- Prevent media-grid tracks shrinking below real card height, so neighboring cards no longer intercept normal pointer actions. List-view containment is unchanged.
- Use Electron's supported `videos` path for first native export destination instead of invalid `movies`.
- Route the desktop in-app Open control to disk documents, matching Save; browser library routing stays intact.
- Probe actual audio-track presence at import/reopen; known silent video no longer creates phantom audio clips. Failed probes stay unknown, and existing saved audio clips are untouched.
- Add repeatable real Electron media-grid/native IPC/file-save witness and scoped QA documentation.

## Local evidence
Exact head: `a47417bc4b3390bc30697cc2b7d3d573ad14e4d6`, 2026-10-08 UTC.
- `npm run desktop:renderer`: passed (identical production source before commit).
- `npm run check`: passed at exact head.
- `npm run test:quick`: 1,093 passed at exact head.
- `node scripts/certify-media-grid.mjs <fixtures> <evidence>`: passed at exact head; actual five-file import, non-overlapping cards, normal source insertion, real project JSON write, native FFmpeg output independently probed as H.264 / 320×180 / 30 frames / one second, and actual cold-process/fresh-profile disk reopen followed by exact re-saved clip/settings/media identity comparison.
- Additional actual UI mixed silent/AV timeline export passed: 13 seconds, H.264 1920×1080/30 fps, real disk output and nonzero decoded program audio. The parity renderer used a real OPFS file handle; only chooser selection was harnessed.
- Independent OpenAI review: approved scoped repair; stronger codec/clip-count assertions included.

## Release boundaries
Stacked on PR #92; do not merge/deploy while mandatory checks or downstack gates remain unresolved. Local verification is not hosted CI success. No workflow retries requested.
Native OS dialog choices are supplied by the witness: dialog interaction remains UNVERIFIED. Full golden project save/reopen fidelity beyond this one-clip fixture, visual/audio comparisons, large-bin performance, Lite/browser/device coverage and signed packaging remain unverified. The pre-existing residual tooling advisory set from PR #92 is not claimed resolved here.

Raw-source frame comparison on the cinematic-look fixture failed its neutral-image expectation; saved state confirms the cinematic preset. Neutral-look reference verification remains open; no visual-fidelity pass claimed. Existing projects with old phantom audio require explicit removal of the nonexistent audio clip after a backup; no automatic migration/drop is performed.
