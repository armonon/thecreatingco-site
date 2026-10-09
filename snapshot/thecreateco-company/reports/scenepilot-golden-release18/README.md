# ScenePilot workflow repair checkpoint

Exact reviewed source: `a47417bc4b3390bc30697cc2b7d3d573ad14e4d6`. [PR93](https://github.com/armonon/scenepilot-studio-badass/pull/93) OPEN; no merge/deployment.

## Repairs

1. Media-grid card overlap prevented ordinary clip selection/insertion.
2. First native export used invalid Electron Movies path instead of Videos.
3. Desktop in-app Open read browser storage while Save wrote disk documents.
4. Silent video insertion created phantom embedded audio and blocked export.

## Executed local evidence

`exact-audio-head/receipt.json`: exact-head Node22 types/lint,1093 unit tests,desktop renderer build and six focused actual Electron workflow checks PASS. `workflow/result.json` includes real five-file import, normal insertion, native IPC/FFmpeg output, project Save→fresh process/profile Open→resave identity comparison, silent/AV audio-presence behavior and actual UI13-second1080p/30fps H264 export with audio. Destination is a real OPFS disk handle; OS dialog choice is harnessed, not verified. FFprobe and nonzero decoded PCM support output claims. File hashes are in artifact-sha256.json.

## Not passed / remaining

The initial raw-source frame comparison FAILED its neutral-image expectation because the project has the cinematic preset enabled. Retained reference-frames.json and frame images; neutral-look UI rerender PASSED all three unchanged coarse RGB comparisons (MAE 1.216, 1.238, 1.202 / 255 against fixed tolerance 6). See exact-audio-head/neutral-reference-frames.json, neutral-project.scenepilot.json and neutral-ui-master.mp4. This is frame identity/timing evidence, not full visual-fidelity qualification. Complete title/animation/color/audio/relink/repeated Lite/packaged Pro golden recipe remains unqualified. Native dialog interaction unavailable in this host session, signed/device coverage and large-bin performance unverified. Residual tooling advisories and mandatory/downstack release gates remain.

No existing saved audio clips were silently removed. Old projects with phantom audio need an explicit removal of the nonexistent clip after backup; no automatic migration claimed. The authored split/music intermediate is preserved as golden-midpoint.scenepilot.json, including the reproducible pre-fix failure.

See FINDINGS.md, fixture manifest, independent reviews and successive immutable exact-head directories for history. This checkpoint is not product completion.
