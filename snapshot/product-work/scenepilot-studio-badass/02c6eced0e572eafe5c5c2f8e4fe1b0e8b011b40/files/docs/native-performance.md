# Native responsiveness and efficiency

2026-09-21. AppKit migration-preview optimization; not a browser or Electron performance claim.

## Changes

- **Time-scoped decode instructions.** Cut boundaries produce contiguous native
  composition instructions. Each asks AVFoundation only for active video sources.
  Half-open cut boundaries, empty black intervals, nested groups, alpha/luma
  providers, inversion and audio retain their existing behavior. The renderer is
  still shared by AVPlayer and MP4 export.
- **Smaller frame graphs.** Inactive scene branches are pruned once while building
  instructions rather than compositing transparent placeholders each frame.
  Retained pruned storage is capped at 32,768 nodes per sequence. When exhausted,
  instructions share the original tree while retaining their reduced decode sets.
  The existing 256-expanded-media and nesting limits are not increased.
- **Latest-target seeking.** One exact AVPlayer seek in flight and one replaceable
  pending target. The timeline/inspector update immediately. Old player-item
  completions are ignored; stale observer callbacks cannot move a paused scrub
  playhead backward. Preview-build completion uses the current requested playhead,
  not the position captured before the build started.
- **Fewer rebuilds.** A cancelable 40 ms debounce collapses rapid document edits
  before opening decoders. Track locks, names and unused library imports do not
  rebuild playback. All reachable scene/effect/audio/timing changes invalidate
  preview inputs. Explicit relink, retry and document open still force rebuilding;
  there is no persistent media-content cache hiding same-path replacements.
- **Timeline drawing and input.** Moving the playhead invalidates narrow old/new
  strips; offscreen clips/rows and out-of-range ruler ticks are not painted. Ruler
  dragging now continuously seeks, pauses playback, and submits the final mouse-up
  target. Accessible clip/track/key selection also gives the timeline keyboard
  focus rather than leaving arrows in the media search field.

## Measurements and validation

`npm run native:test` includes a 128-sequential-clip comparison against the old
full-tree frame setup. It reports median CPU Core Image graph construction time
over 31 iterations; this excludes actual decoding and GPU rasterization. Requested
video-track count is reduced from **128 to 1** for that fixture. This is not an
overall playback-speed multiplier or a 4K/8K performance guarantee.

Local debug-build measurement: **0.3621 ms → 0.0099 ms** median frame-graph
construction for the 128-clip fixture (about 36× less CPU setup time in that test).
No hard elapsed-time assertion is used because host contention varies.

A 10,001-target seek burst is reduced to two submissions when the first completion
is held, with the last requested destination preserved. Additional tests cover
reset/duplicate/stale completions, preview invalidation, storage-budget fallback,
exact optimized/reference pixels, and native MP4 decoding at cuts and empty gaps.

For GUI qualification, run `node scripts/create-native-performance-qa.mjs` after
the native tests, then open `outputs/native-macos/performance-ui.scenepilot-native.json`
in the rebuilt app. This is generated test media, not a user project. Fit the
timeline, scrub rapidly, verify the final frame/time, test play/pause and track
lock without preview rebuilding. The separate animated-mask fixture checks that
mask-key navigation still works.

Validation recorded: **97 native tests, 768 JavaScript tests, TypeScript/lint,
web production build and native packaged build passed**. A direct GUI smoke
opened the generated 64-cut sequence, reached native-preview-ready, showed decoded
footage and accepted timeline seeks. The Mac then locked before final ruler-drag,
accessible keyboard-focus and partial-redraw checks on the final build. Those
hands-on checks remain pending; the passing automated suite does not substitute
for that UI gate. No public deployment was performed.

## Next performance gates

Measure seek-to-visible-frame p50/p95 and dropped frames with representative 4K
codecs, long multicam sequences and nested animated masks on declared hardware.
Qualify memory/thermal soak, fresh-install media access, bounded proxy decoding,
and waveform/thumbnail background work before calling this production-grade.
No reduced-quality preview mode or approximate export pixels were introduced.
