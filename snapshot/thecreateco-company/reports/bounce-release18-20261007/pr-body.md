## Change
Capture queue, title and EQ as one library snapshot before asynchronous file reads. Track metadata edits and truthfully warn when newer work remains unsaved. No user files, app identity or native code changed. Regenerated the content-addressed PWA service worker.

## Evidence
- Baseline real-browser test reproduced mixed snapshot metadata and false fully-saved status.
- Actual media playback/reorder, IndexedDB restore, portable reopen and independent archive byte hashes pass.
- Malformed archive preserves queue; edit-during-save regression passes.
- Actual Chromium quota rejection preserves saved library and unsaved queue.
- Chromium, Firefox and WebKit host-browser workflow checks; original musical studies decode and play.
- PWA offline/cache exclusion/update cycle passes.
- Independent OpenAI review passed source, regression harness and qualification docs.

## Boundaries
Alpha, not stable certification. Native/physical devices, full codec corpus, maximum-size stress and assistive-technology qualification remain. Firefox/WebKit quota denial is explicitly unverified. Local exact-head final records are retained in company reports/bounce-release18-20261007. No deployment implied by this PR.
