# Context menus

The shared web/Electron editor now routes secondary clicks through one contextual
menu surface. Targets carry explicit kind/ID metadata; the clicked item is selected
without seeking. Input fields retain their normal text-editing context menu.

- Picture clips: properties, split at the existing playhead, effects browser, Glow,
  fades, copy, Pro nesting, and delete.
- Audio clips: properties, fades, adjacent crossfade, and delete.
- Video/audio tracks: add, lock/unlock, visibility/mute, reorder, and remove empty
  tracks. Audio tracks additionally offer solo.
- Project media: source monitor, favorites, video proxy controls, and the existing
  confirmed project-removal workflow. Original files are never deleted.
- Composition layers: effects, keyframes, duplicate, enable/disable, lock, delete.
- Composition tracks: add, lock, enable/disable, reorder, remove empty tracks.
- Sequence background: add tracks, matched Pro composition, marker, undo/redo.

Arrow keys and Home/End navigate enabled actions. Enter/Space activate; Escape/Tab
close. Shift+F10 or the context-menu key opens the menu for a focused target. Menus
clamp to the viewport and dismiss on outside pointer input, external scroll, resize,
or window blur. Secondary pointer-down cannot begin timeline editing gestures.

Delete from menus, inspector, and keyboard uses the same action owner, with undo
checkpoints and linked-audio/locked-track checks. Video state remains in the canonical
`videoClips` store through its existing lane-scoped setters.

The native AppKit preview has real NSMenu menus on the timeline and Project Media.
They select the clicked clip/track/row and dispatch through the existing Command
registry, enabled/checked state, undo and document transaction code. Native menus
only expose operations implemented in the native preview; no unported effects are
advertised there.

Validation: 20 focused context-menu, selection and video-track regression tests
passed. The subsequent parity increment passed all 768 JavaScript tests and
TypeScript, plus the production Electron renderer build. The native release build,
local ad-hoc signing, and runtime dependency checks passed; the rebuilt preview is
at `release/ScenePilot Native.app`.
Direct native UI checks verified a clip context-menu rolling edit, undo and locked
controls. The web track context menu opened and added V4, with zero captured console
errors. Exhaustive menu/viewport coverage is still pending. This change has not been
deployed to the public website or packaged as an Electron release.
