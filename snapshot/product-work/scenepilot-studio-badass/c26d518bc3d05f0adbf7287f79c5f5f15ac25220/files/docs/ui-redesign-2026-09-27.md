# Essentials workspace redesign

## Intent and scope

Make everyday editing approachable without replacing the editing engine or reducing
access to advanced tools. This is a source/UI update, not a shipped installer.
The notarized 0.1.16 DMG and draft release were not modified.

The `photoshop-class-app-shell` skill guided this change: workspace preferences
remain separate from project edits, commands keep their existing handlers, and
the existing contextual inspector remains the authoritative property editor.
No floating/docking system or new rendering capability is claimed.

## What changed

- Essentials is the default. Full controls expands the advanced timeline actions
  and clip-inspector sections. The choice is saved per workspace, with safe
  migration of existing version-1 preferences.
- In Edit, the inspector appears for the current selection instead of occupying
  an empty column. Other workspaces retain their required inspectors. Explicitly
  hiding the inspector remains respected; automatic visibility never overwrites
  that saved preference.
- Primary tools have readable names: Selection, Razor, Fade and Hand. More tools
  retains Rate Stretch, Slip, Slide, Roll and Zoom, including existing shortcuts.
  The menu label reflects the active advanced tool.
- Track creation, clip actions, ranges/markers and scopes have compact disclosures.
  Menus close on outside click; Escape closes them and restores trigger focus.
- Source-clip properties are grouped into Timing & source, Advanced trimming,
  Transform, Time remap, Clip color, Effects and Animation. Transform starts open.
- Media filters and creator packs are collapsible. Media, Comps, Effects and Text
  use readable labels. The composition drop/create target and document tabs remain.
- Duplicate Auto Cut buttons were removed; one labeled workspace entry remains.
  File actions are grouped; save, undo/redo, command search and delivery stay visible.
- Empty section lanes disappear in Essentials; the timeline gets more default
  space. Panel resizing, focus modes and layout reset remain available.

## Verification

- Production build passed. Editor entry: 492,873 bytes against a 500,000-byte budget
  in the audited build. Required lazy-loaded surfaces remain present.
- Desktop renderer build passed (no installer rebuilt or notarized).
- Full regression suite: 884 tests passed. Follow-up rendered-HTML, input-routing,
  accessibility and workspace-layout checks: 17 passed.
- Added tests for inspector visibility, respecting saved hidden panels,
  legacy preference migration and Full controls persistence.
- Targeted ESLint checks passed for all changed TypeScript/TSX/test surfaces;
  whitespace validation passed for the edited files.
- Browser smoke at 1440×900, 1280×800 and 1920×1080: empty workspace, imported and
  selected media, composition workspace, and menu/inspector states inspected.
- Imported an 8-second synthetic audiovisual MP4; opened Source and inserted it
  with linked audio. Selected clip opened the inspector. Added a Monochrome effect
  through the folded Effects section and confirmed the stack count/control appeared.
  This is a wiring check, not pixel-parity certification.
- Verified Slip activates from More tools, Escape dismisses its menu, Add track
  increments the track count, Full controls persists after reload, keyboard panel
  resize increments width, and viewer focus restores the normal layout.
- Verified composition tabs, custom-composition dialog (cancelled without creation),
  main-sequence return and the effects-library tab. No browser console errors observed.
- Found and fixed the timeline ancestor clipping the new menus during interaction
  testing; verified the menu button became the pointer hit target before activation.

## Outstanding gates / limits

- Repository-wide type checking and lint are not green: the separately existing,
  untracked `scripts/certify-engine-parity-pro.ts` passes null curve LUT data to a
  type requiring undefined and contains seven explicit-any lint errors. An unused
  variable warning also exists in `scripts/engine-parity-cases.mjs`. These unrelated
  in-progress scripts were not edited by this redesign.
- During playback under heavy concurrent local CPU load, some browser-control
  calls timed out. K successfully stopped transport. This is not a sustained
  playback-performance qualification or a claim that playback is release-ready.
- No export, render parity, signed-package, screen-reader or multi-machine
  qualification is claimed by this UI pass. Auto Cut and deep Motion/Color/Audio
  workspaces retain their existing feature panels; this pass primarily simplifies
  the shared shell and Edit workflow.
- A new signed/notarized installer is required to distribute this redesign.

Local review server: `http://127.0.0.1:4072/?edition=pro`.
