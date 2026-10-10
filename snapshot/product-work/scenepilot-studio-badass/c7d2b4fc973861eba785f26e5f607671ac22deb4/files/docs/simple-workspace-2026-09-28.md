# Simple workspace redesign

## Scope

The shared React editor used by the browser and Electron renderer now starts
with a quieter, project-first workspace. This is presentation and command routing
work, not a rewrite of the editing/rendering engines or the separate Swift app.
The existing project models, timeline commands, shortcuts, undo history and
export engines remain in place. Signing/notarization work in this checkout was
left untouched. No public deployment or installer replacement was performed.

## Interaction changes

- Simple view exposes Edit, Auto Cut and a More tools menu. Motion, Color, Audio
  and Deliver use their existing workspace handlers. Advanced view shows all
  workspaces and professional controls. Lite restrictions remain enforced.
- File contains project switching, opening, recovery and the export queue.
  Pro's primary Export button opens delivery settings instead of immediately
  queueing a render; Lite keeps its existing Render MP4 action and availability.
- Project creation starts with a name and a start button. All aspect ratios,
  custom sizes, frame rates and resolution controls remain in an expandable
  settings section. Keyboard focus skips its collapsed contents.
- Media defaults to a thumbnail grid. Per-item proxy and bin controls are
  available in Media options, including in grid view.
- The timeline has one compact control strip. Specialized trim tools, markers,
  ranges, snapping, linking and scopes remain reachable through menus.
- Simple view hides unused secondary lanes, never clips. Occupancy is checked
  against the whole document rather than just the visible timeline window.
  The first audio lane remains available as a drop target. Explicitly selected
  tracks remain visible; Add track reveals unused lanes before creating one.
  Add track > Show unused tracks or Advanced view reveals the complete stack.
- Selected overlay/composition-clip properties are grouped into Timing & source,
  Size & fades, and Color & effects. Open-comp and header controls stay available.
- Layout preferences remain separate from project state. Empty-track visibility
  and Simple/Advanced choices round-trip, including Auto Cut and Deliver.

## Verification

- TypeScript and repository-wide ESLint passed (`npm run check`); a final
  TypeScript pass and targeted lint of the redesign files also passed.
- Production build and Electron renderer build passed, including a final rebuild
  after the media-card sizing correction.
- Full Node regression suite: 899/899 passed.
- Entry bundle: 494,009 bytes / 500,000-byte budget; lazy-surface audit passed.
- Automated accessibility checks passed for new-project, Edit and Deliver
  states with no reported violations in the audited rules.
- Browser interaction verified More tools > Motion, composition/main switching,
  add-track visibility, undo, nesting a built-in composition, hiding unused
  lanes while keeping its occupied lane visible, Simple/Advanced switching,
  keyboard playhead stepping, and Export opening delivery settings.
- Auto Cut loaded successfully from the simplified navigation and returned to
  Edit with the inserted video/audio intact.
- New-project canvas settings expanded, changed to 24 fps, and retained that
  selection when collapsed. Tab moved from the closed disclosure to Start editing.
- Imported an eight-second synthetic MP4, opened it in Source, inserted its video
  and embedded audio, and stepped the playhead to a visibly rendered frame.
  Expanded media options exposed proxy/bin controls. Fixed thumbnail-card sizing
  so the image, metadata and actions remain in separate rows when expanded.
- Layout visually inspected at 1280x800, 1440x900 and 1920x1080. At 1920px,
  document scroll width equaled viewport width. No browser console errors were
  reported during this interaction pass.

The preview is available at http://127.0.0.1:4074/?edition=pro while the local
development server is running. This pass does not certify every advanced effect,
media format, touch-device workflow or packaged desktop runtime. Those engines
were not changed by this redesign.
