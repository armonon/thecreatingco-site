# Direct timeline scrubbing

## Root cause

The sequence and composition playheads were decorative elements with
`pointer-events: none`. The sequence ruler accepted dragging, but the composition
ruler did not. Dragging the visible playhead could not initiate a seek.

## Fix

- Both timelines now have a 15px-wide draggable playhead hit area covering the cap,
  time label and vertical line, with a resize cursor and keyboard focus indicator.
- Ruler and playhead dragging share one pointer controller. It pauses transport,
  captures the pointer, maps against the actual ruler geometry, snaps to frames,
  and clamps to the sequence/comp duration.
- Move events coalesce to one preview request per animation frame. Pointer release
  flushes its exact final position; cancellation/capture loss flushes the latest
  real position and cannot jump to a synthetic cancellation coordinate.
- Secondary buttons and unrelated pointers do not affect the gesture. Unmount
  cancels queued preview requests and releases capture.
- Focus the playhead and use Left/Right for one frame, Shift+Left/Right for ten,
  Home/End for the sequence boundaries.
- Composition ruler and playhead now account for the track-order-controls column
  as well as responsive label widths, matching the clip area.

## Verification

- Six focused tests passed (scrub math/lifecycle plus program transport).
- Full regression: 889/890 passed. The unrelated marketing-gallery freshness test
  failed because its stored compositor source hash differs from the current
  `lib/compositor.ts`; this scrubbing change does not edit that renderer or gallery.
- Targeted lint and desktop renderer build passed.
- Direct browser drag on the main sequence moved 0s to 15.433333s; the main
  transport independently displayed 00:00:15:13 at 30 fps.
- Further browser interaction stalled and the browser-control connection timed
  out. The composition drag and outside-timeline drag are not claimed as visually
  verified; pointer release/cancellation/capture are covered by the unit harness.
- Project-wide TypeScript still reports the unrelated null curve-LUT type error
  in the existing `scripts/certify-engine-parity-pro.ts`.

The source and local preview at `http://127.0.0.1:4072/?edition=pro` contain this fix.
The older 4016 preview URL was unreachable during inspection. The installed app,
notarized DMG, and public deployment were not updated by this change.

## Isolated Git checkpoint

The UI and scrub changes were isolated from concurrent native/render-analysis
work on `fix/editor-ui-and-playhead`, based on `10fd49d`. In that clean source
snapshot, `npm run check`, `npm run build`, and all 889 regression tests passed.
The bundle audit passed at 492,725 bytes against the 500,000-byte entry budget.
The type and gallery failures above describe the shared working folder, not this
isolated checkpoint. No unrelated in-progress changes or installers are included.
