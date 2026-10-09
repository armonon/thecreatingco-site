# ScenePilot real desktop workflow findings

Base: `528899c8e69628738c861ede8937c0860a2292e6`. Repair: `ac75a2b` (full hash in exact-head/receipt.json). Actual Electron 43.7.9 on macOS arm64; development renderer, not packaged/signature qualification.

## Confirmed defects and repairs

1. Media cards measured 197.5px high but grid rows advanced only 47.66px. Adjacent cards intercepted ordinary clicks and double-clicks. `grid-overlap-baseline.json` and `02-import-ready.png` preserve baseline. Disabling content containment alone did not fix track shrink. Final repair uses max-content grid rows and disables list-sized offscreen containment only on adaptive grid cards. Rebuilt app (no diagnostic CSS) passes normal double-click → Source → Insert. List view remains unchanged. Large-bin performance remains UNVERIFIED.
2. Native export fallback used unsupported `app.getPath("movies")`; actual Electron call throws. Repaired to supported `videos`. Real native preload/IPC/FFmpeg path now reaches destination selection and produces an independently probed 320×180 H.264 file, 30 frames / 1 second. The test supplies only OS dialog choice; the encoder and disk writes are real.

## Verification subset

- Five actual generated files import with correct metadata (fixture SHA/probe manifest retained).
- Actual UI Save writes project JSON with five assets and one inserted 12-second clip.
- `scripts/certify-media-grid.mjs` provides repeatable focused verification, timestamps, source identity, bounds, screenshot and FFprobe receipt.
- Independent OpenAI review: no blocking finding; explicitly preserve large-bin performance and full golden workflow as unverified. Suggested stronger codec/clip-count assertions were added.
- Desktop renderer build, types/lint and 1,091 unit tests passed on candidate. Exact committed-head receipt is tracked separately under `exact-head/`.

## Open gates / honest limits

Initial hybrid UI export reached CHOOSE DESTINATION at 0%, not encoded success. Peekaboo local Screen Recording/Accessibility were already granted, but capture returned "Window 804 is not on any available display" and targeted focus did not complete within a bounded attempt. No provider/permission changes were made. Cancel active export returned app state to CANCELED; owned test app was then closed. Native Save dialog interaction remains UNVERIFIED.

Native IPC export above is not the complete UI edit/export golden workflow. Full trim/split/title/animation/color/audio/fades, close/reopen fidelity, relink, independent visual/audio comparisons, repeated Lite and Pro runs, supported-device behavior and signed packages remain IN PROGRESS/UNVERIFIED. No product-complete claim, no merge/deployment.

Harness-only launch error: app.setPath("movies") was also corrected to videos in the isolated test launcher; this is separate from the confirmed product fallback defect. Failed Python fixture-generation environments and initial diagnostic-only attempts remain as historical evidence; no global tools changed.

## Follow-up: cold Open routing (ef02607)

A fresh process/profile using the in-app File → Open project command displayed “No saved ScenePilot project was found in this browser” after a successful disk Save. The native menu/shortcut had a separate disk path, but the in-app control was wired to IndexedDB. Fixed restore routing to mirror Save for Desktop Pro; browser editions retain their library behavior. Actual fresh-process/fresh-profile test now opens the saved disk file and re-saves matching project, duration, tracks, clip IDs/timing, settings, compositions, titles and media identities. Native dialog choices remain harnessed. Independent review: `reopen-independent-review.md`. Exact committed-head types/lint,1091 tests and extended real-file regression pass in `exact-reopen-head/receipt.json`. Pushed to existing PR93, not merged/deployed.

Further real editing on this candidate: one12-second clip → split at6 →2clips →Undo1 →Redo2 passed through actual UI. Snapshot12-split-undo-redo retains result. This is not the complete golden edit recipe.


## Neutral reference checkpoint 2026-10-08T03:54:43.614520+00:00
Real UI Reset all in Grade set neutral look, followed by real 13-second mixed-video/audio export to OPFS disk. Three original fixed-tolerance RGB comparisons pass (1.216,1.238,1.202 <=6/255). Cinematic comparison failure retained; no threshold relaxed. Native Save records neutral project. Full golden recipe still unverified.
