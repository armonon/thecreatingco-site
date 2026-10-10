# Native editing workspace 0.2 — migration campaign

Follow-up: [native motion and document schema v3](native-motion.md) supersedes the
keyframe/schema gaps in this historical workspace record.

This is an incremental Apple-native editor, **not** a replacement for the complete
Electron Pro application yet. Browser Lite and existing Pro remain unchanged.
Do not publish this development build as a feature-equivalent Pro release.

## Implemented

- AppKit workspace construction moved out of the editor controller into
  `EditorWorkspace.swift`; commands remain shared by menus, toolbar and shortcuts.
- Searchable Project Media, real composition tabs, per-sequence in-session playhead,
  selection and zoom, matched new compositions and editable sequence settings.
- Drag media/compositions into unlocked timeline tracks; drag clips between tracks;
  edge trim with ghost feedback, frame quantization and optional edge/playhead snap.
  Option temporarily bypasses snapping. Escape cancels an in-progress clip drag.
- Zoom in/out/fit; trim in/out to playhead; slip; duplicate into empty adjacent space;
  explicit **track-local** ripple delete. Overlaps and locked edits are rejected.
- Follow-up: frame-step native roll-out and slide commands through inspector,
  keyboard and context menu, with source-handle checks and fixed outer boundaries.
  See `adobe-workflow-parity.md` for current evidence and limitations.
- Native fit/fill, normalized position, scale, clockwise rotation and flips through
  the same AVFoundation/Core Image compositor in preview and export.
- Splitting preserves the original picture/audio fade envelope, including repeated
  splits inside a fade. Explicit trims instead adjust edge-relative fades.
- Contextual inspector, checked command states, progress indicator, workspace reset,
  split-size persistence, and busy-operation interaction guards.
- A missing required video frame is an export error, not silently substituted black.
- Native schema v2 reads and upgrades v1. New presentation fields round-trip. Older
  native builds reject v2 rather than silently losing transforms/archived originals.
- Native packaging replaces the executable inode, avoiding in-place overwrite of a
  running signed Mach-O. The app is still locally ad-hoc signed, not notarized.

## Project compatibility: precise scope

File > Review Existing Pro Project opens a read-only inventory of a
`.scenepilot.json` cut file, including timeline clips, composition count, local media,
effect/settings/pro-state presence and unrecognized top-level extensions. The canonical
`videoClips` array takes precedence, including when it is empty.

**Import Linked Media Only is not timeline conversion.** It creates a new native
media-bin project, retains the exact original JSON bytes inside `legacyArchive`, and
reports unavailable/unsupported sources. It does not recreate cuts, effects, mixer
routing, titles, masks, animation or automation. It requires an explicit button
selection after the report. The old edit remains in the full Pro application.

File > Recover Original Pro Document writes those exact bytes to a **new** file and
refuses to overwrite an existing destination. Native edits do not change that archive.
Unknown vendor data survives because the archive is never reserialized as legacy JSON.
This is a preservation/rebuild bridge, not a lossless native scene converter.

## Automated validation

- Native test suite: 37 Swift cases, including actual video/audio fixture checks.
- Pixel checks cover fit vs fill, translation/scale, split fades at multiple times,
  track layering and nesting. Export parity covers patterned footage with rotation,
  horizontal flip, scale, translation, exposure, saturation and blur.
- Preview/compressed MP4 comparison uses RGB MAE < 8 at 32×18, one sample time:
  a regression smoke test, **not exhaustive color-management certification**.
- Core tests cover locked edits, invalid/source-exceeding trims, ripple scope, undo,
  snap, v1→v2 upgrade, malformed legacy versions, remote-path rejection, canonical
  clip precedence and byte-exact opaque archival.
- Existing product: 749 JS tests, TypeScript/lint and production web build passed.
  The web build retains its existing large-chunk and route-classification warnings.
- Browser mount/accessibility audit passed the new-project, editing and delivery
  states with zero reported violations; an earlier run timed out starting Vite
  under concurrent build load, and the unchanged audit passed on rerun.

## Direct UI checks so far

- Opened a native v1 project containing real licensed H.264 footage.
- Applied 75% scale and 15° rotation and visually confirmed the result in the viewer.
- Created a matched composition, appended media, switched tabs and verified the
  original playhead, selection and transform controls were restored.
- Dragged a clip's right edge; duration became 1.566667 s on the frame grid.
- Saved v2 to `outputs/release-today/media/Native Workspace 02 QA.scenepilot-native.json`.
- Reviewed actual `clip-red.scenepilot.json`, explicitly imported linked media only,
  and saved `outputs/release-today/Native Archive QA.scenepilot-native.json`.
  A byte comparison confirmed the embedded original exactly matches the source;
  the rebuilt timeline was empty, as promised.
- Dragged the media divider from 240 to 297 points, quit and relaunched the app;
  the 297-point panel width survived. Reset uses the same persisted layout model.
- Bin drag/drop still needs final interaction qualification. Timeline clip dragging
  and edge trimming worked, but bin drags did not complete in the initial UI pass;
  an explicit drop-preparation handler was added and packaged. Later file-picker
  input became unreliable during UI automation, so no final bin-drop pass is claimed.

## Still required before replacing existing Pro

1. Actual versioned scene translation with explicit per-field support and paired
   reference projects. Preserve original bytes and refuse unsupported conversions.
2. Native keyframes/easing, masks/mattes, nested group rendering, titles/shapes,
   LUTs and all advertised effects; visual references across source formats.
3. Roto/model/cache/correction integration and existing automation engines without
   depending on a JavaScript runtime in the native app.
4. Source monitor/in-out/insert-overwrite, roll/slide drag tools, multi-selection, linked audio,
   markers, waveform/mixer/automation, proxy cache and delivery/queue breadth.
5. Replace per-leaf AV tracks and the 256-expanded-clip guard with measured bounded
   decode/cache scheduling. Long 4K timelines and responsiveness qualification.
6. Dock/float/reopen panel infrastructure, comprehensive keyboard/VoiceOver and
   reference screenshots at 1280×800, 1440×900 and 1920×1080.
7. Minimum-macOS/clean-machine/offline/update tests, Developer ID signing and
   notarization. Credentials and additional OS machines are external gates; the
   remaining engineering work above is not blocked by them.

The goal is measured workflow equivalence, not a subjective “10/10” completion claim.
