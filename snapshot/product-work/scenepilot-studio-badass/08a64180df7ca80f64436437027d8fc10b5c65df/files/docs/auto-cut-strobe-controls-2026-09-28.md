# Auto Cut and independent strobe tempo

The shared React browser/Electron editor now exposes light patterns and a custom
tempo slider directly in Auto Cut. Song sync remains the default for existing
projects. Custom tempo is 30–240 BPM with 0.1 BPM steps and does not modify the
song beat map, cut positions or audio playback speed.

Patterns retain their divisions (every beat, every four beats, double time,
offbeats and bar bursts). Custom mode uses a deterministic clock starting at
sequence zero and excludes the sequence end. It does not add song-drop bursts.
Detected drum hits still use the existing transient detector; selecting them
returns to song timing. Choosing Custom BPM from drum mode selects Every beat.
The existing rate limiter is applied after scheduling, so rapid patterns can
produce fewer flashes than requested. It is not a photosensitivity certification.

Both settings are included in undo snapshots, autosave dependencies and the
project/cut-file effect settings. Older documents default to song timing/120 BPM.
Preview and export consume the same already-existing `strobeSetting.times` path.
No renderer or audio engine was replaced.

Auto Cut now has a clear add-media/generate-draft action near the top, expandable
fine-tuning rules, a quieter Simple appearance and a preview that stays visible
while scrolling controls on desktop. Existing advanced light controls remain.
The app-shell skill informed reusing existing command callbacks and persisted
effect state rather than introducing disconnected controls.

Verification:

- Focused timing/persistence/control tests: 26 passed.
- Auto-edit/project-store integration tests: 34 passed. Full regression suite:
  902/902 passed. Repository TypeScript/lint and browser/Electron builds passed.
  Final entry bundle audit: 494,777 bytes within the 500,000-byte budget.
- Browser: slider adjustment changed the scheduled flash count; undo restored
  120 from 120.1 BPM and redo restored 120.1; song sync retained the project's
  120 BPM while custom lighting was changed to 240 BPM.
- Saved the test project, reloaded, reopened it from File and confirmed custom
  timing/240 BPM were restored, with the rate limiter still enabled.
- Visually checked at 1280×800, 1440×900 and 1920×1080; no console errors during
  the interaction pass. Temporary viewport overrides were reset.

This change is local source/renderer work, not a public deployment or a newly
signed/notarized desktop installer. A new end-to-end media export was not run in
this UI pass; scheduler behavior and the shared preview/export wiring were tested.
