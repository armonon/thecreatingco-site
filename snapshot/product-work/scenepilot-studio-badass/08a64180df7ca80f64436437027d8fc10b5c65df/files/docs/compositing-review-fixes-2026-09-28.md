# Compositing review follow-through

## Scope

Fixes to the local React/Electron-renderer composition workspace. No deployment,
installer rebuild, notarization, or changes to signing configuration. Existing
uncommitted work is preserved.

## Correctness

- Transform graph edits, keyframe insertion/removal, easing/spatial edits, presets,
  and layer deletion respect both layer and containing-track locks. Locked
  inspector fields and graph points visibly disable editing.
- One source-local/composition-time conversion handles delayed layers, source
  trims, and playback rate. Graph positioning, labels, seeking, pointer edits,
  motion-path selection and keyframe insertion use it. Graph arrow nudges move
  one project frame, with the rate conversion applied to stored keyframes.
- Keyframes cannot be inserted outside the visible layer span. Adjacent keys at
  high frame rates no longer overwrite one another due to a fixed 25 ms epsilon.
- Composition settings use the same validation as creation (0.05 seconds–24
  hours; even dimensions 16–7680). Numeric drafts commit on blur/Enter; invalid
  drafts explain the error, Escape restores the current value. Shortening a comp
  clamps the playhead but preserves layers for later extension.

## Workspace

- Canvas-first default composition layout (existing saved layouts preserved).
  Layout → Reset workspace applies the new defaults to an existing preference.
- Fit/25/50/100/200% viewing with scrollable large canvases, measured Fit scale,
  and separate zoom/scroll state while switching between composition tabs.
  These are view zooms; preview raster resolution remains governed by the existing
  preview renderer, not a promise of full-resolution pixel inspection.
- Graph editor is opt-in, supports a single keyframe, and explains empty states.
- Timeline zoom up to 16×; adaptive ticks bound the DOM cost of long compositions.
- Grouped inspector sections keep advanced functionality accessible. Audio layers
  don't display empty visual sections. Subject isolation is separately disclosed.
- Roto journey banner appears only while a subject tool is active on media.
- Switching compositions preserves the selected Project Media/Effects tab.
- Direct files dropped on the viewer or a track go through the existing importer.
  Completion rechecks current track compatibility/locks and checkpoints current
  edit history, rather than replacing a stale composition snapshot. Imported
  assets remain available in Project Media if the target becomes unavailable.

## Verification

- New pure-engine regressions: offset/rate round trips, keyframe bounds, locks,
  bounded rulers, settings limits, media placement and unavailable destinations.
- Component regressions: disabled graph/inspector, mapped graph labels and pointer
  edits, frame-sized keyboard edits, hidden-by-default graph, zoom controls and
  empty-viewer drop guidance.
- Production web build + full suite: **916/916 passed**. Desktop renderer build
  passed; existing large-chunk warnings remain. The latest focused component and
  engine rerun passed **15/15**. Local preview on port 4074 returned HTTP 200.
- `npm run check` completed successfully (TypeScript and full-repository ESLint).
  Two lint errors in the new test harness were corrected; its lint recheck and
  six component tests then passed. `git diff --check` is clean.
- A first overlapping
  build/test attempt encountered an unavailable server manifest while the build
  replaced output; the final campaign runs build before tests.

## Explicit remaining qualification / scope limits

No fresh interactive browser screenshots, Finder drop test, or packaged-macOS
export qualification is claimed for this pass. Check 1280×800, 1440×900 and
1920×1080: title/media/audio comps, lock/unlock, delayed and retimed animation,
Fit/100% scrolling, tab switching, 60-second settings, drag files, undo and redo.

The mask inspector still authors rectangle/ellipse masks and references existing
alpha/luma mattes/subject isolation. A new freeform Bezier mask pen is a separate
feature, not implemented or implied by these repairs.
