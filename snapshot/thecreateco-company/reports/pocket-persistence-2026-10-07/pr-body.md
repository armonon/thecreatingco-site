## Pocket data-preservation repair

Pocket is the one-bar beat sketchpad, not Pocket Studio. No excluded tool or Key & BPM source changed.

- Refuse a 41st new named save without removing any earlier beat. Explicit same-name updates remain possible.
- Reject unreadable and semantically malformed stored v1 data before save/delete/autosave. Complete unversioned v1 shape is the only legacy allowance; no normalization-based erasure or ambiguous normalized names.
- Preserve untouched and additional stored fields. Keep unsupported/corrupt bytes intact.
- Show draft/library/deletion errors while retaining in-memory work; add actual raw-data recovery download, accurately distinguished from editable pattern import.
- Add meaningful pure/UI regressions and real built-browser qualification harness/docs.

## Evidence

Node22: 246 test files / 2,255 tests pass; focused38 pass; typecheck, production build and zero-warning Pocket/harness lint pass.

Real local Chromium: edit/save/actual page close/reopen, real synthesis, downloadable non-silent stereo24-bit WAV with independently parsed exact loop duration, 41st-save rejection retaining prior bytes, syntactically/semantically damaged storage preservation, and raw backup download. Five scoped checks pass; phone390px no overflow. No physical capture. Unit quota failure is fault injection, not physical disk exhaustion.

Separate independent OpenAI review identified an initial semantic-draft data-loss edge; repaired with complete-shape validation and added regressions. Second review: no remaining blockers.

## Release limits

Stacked onto existing security PR28 (`core-lab/stemdeck-security-20261007`,1569ef3). This does not qualify/merge prior stack or authorize a whole-site deployment. Not deployed. Full supported-browser/mobile/storage-pressure qualification remains; no cloud sync, portable editable-pattern interchange, undo/redo or chaining claimed. Existing PR/CI gates remain required.
