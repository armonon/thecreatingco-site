# Native Bezier masks, shape animation and group fades

AppKit migration-preview follow-up, 2026-09-21. Supersedes the three unsupported
items in `native-compositing.md`; does not claim complete After Effects parity.

## Bezier masks

Choose **Bezier Mask** or **Edit Bezier Path…** in the Clip Inspector or
Compositing menu. The path editor is explicitly **mask-local space**, not an
overlay on the source video. Drag anchors and their incoming/outgoing handles.
Option-drag an anchor pulls its outgoing handle; Shift–Option pulls incoming.
Arrow keys nudge the selected control by 0.1%; Shift nudges 1%.

Split Segment adds a vertex using De Casteljau subdivision without changing the
curve. Delete Vertex removes the selected vertex, keeping at least three. Apply
commits the draft as one undoable edit; Cancel discards only that draft. Rectangle
conversion retains its corners; ellipse conversion uses four cubic arcs.

Closed paths have 3–128 vertices and independent cubic handles. Coordinates are
normalized inside the mask's center/width/height rectangle, with positive Y down.
Even-odd filling supports self-intersections. Native Core Graphics rasterizes
coverage, then the existing shared Core Image path applies feather and inversion.
Off-canvas padding preserves feather edges. A render-queue-confined LRU retains
up to 16 static path rasters, bounded to 32 MiB of underlying grayscale coverage;
animated paths exceeding that budget render without entering the cache.

## Shape animation

Add a mask key at the playhead (**Command–Option–M**), seek, then edit mask
geometry, feather or the Bezier path. Subsequent edits auto-key. Previous/Next Key
navigates visible keys; Remove Key removes the current key; Bake Current Mask
holds the evaluated shape and removes animation. Linear, Smooth and Hold are
available in the inspector. Inversion switches discretely at a key.

Interpolation covers center, size, feather, anchors and both handles. Key shapes
must have the same type and vertex count; bake before changing topology. The path
editor disables add/delete vertices while a mask is animated. Up to 1024 keys,
frame-quantized creation, finite values and strict key ordering are validated.
The mask animation clock is independent of source time, survives split/head trim
and adjacent edits, and respects parent time mapping in reused nested comps.

Native document **v5** persists paths and animation, upgrades v1–v4 on read, and
is deliberately rejected by older readers. Removing a mask removes its animation
in the same transaction. Locked clips cannot be edited.

## Group fades and native audio

Composition instances now expose the existing Fade In/Out fields. These fade the
combined picture once and multiply the audio envelopes of all enabled descendants.
Nested source-in, speed and split-preserved fade windows are mapped into root
sequence time before mixing. Picture opacity keys remain picture-only.

Audio stays in AVFoundation's native mixer, shared by playback and export. Since
AVAudioMix stores linear ramps, products of overlapping fades are partitioned at
every knee and subdivided using the second-derivative interpolation-error bound
`max|f''| × interval² / 8`. The planner's absolute gain error is at most `1e-5`
before Float/timebase conversion. This is a bounded approximation, not a claim of
bit-exact nonlinear DSP. One linear fade remains a single exact ramp per segment.
Limits of 100,000 ramps per source and 250,000 per built sequence fail explicitly
rather than allocating unbounded automation.

A decoded-PCM split test caught an AVFoundation initial-gain defect: a new source
track could emit a brief full-volume burst before its first ramp. Each track now
seeds its initial gain at time zero. The regression compares split and unsplit
audio, as well as the direct parent × child envelope.

## Qualification and remaining boundaries

`npm run native:test` exercises generated H.264/AAC media, independent mask-pixel
comparisons, temporal nesting, decoded mixed PCM, and an independently decoded
MP4 containing animated paths and nested audio fades. The output is
`outputs/native-macos/animated-mask-fades-master.mp4`.

`node scripts/create-native-mask-animation-qa.mjs` generates a separate native UI
fixture. Build with `npm run native:build`, open the fixture, test path draft
Apply/Cancel, key creation/seek/edit/bake/undo, group fade fields, lock behavior,
and save/reopen. No user project is rewritten by the fixture generator.

Validation on this machine: **87 native tests and 768 JavaScript tests passed**;
TypeScript/lint, the web production build and the native packaged build passed. Direct AppKit testing
confirmed anchor/handle dragging, shape-preserving subdivision, Cancel, one-step
undo, key creation at 0 s, geometry/path auto-key at 1 s, midpoint interpolation,
Previous/Next Key, Smooth easing, Bake/undo, animated-topology protection, locked
controls, editable group fades, and save/reopen of v5 keys and fade values.
The viewer displayed the keyed shape at 1 s and the interpolated, faded shape at
0.5 s. The generated media initially stalled in AVFoundation file opening;
selecting that same file with Project Media's normal Relink picker restored the
preview. No privacy settings were changed. Fresh-install media access remains a
release qualification item; this pass does not claim that stall is eliminated.

Still outside this increment: multiple-mask Boolean stacks, pen drawing directly
over footage, independently animated vertex topology, roto/refine brushes,
mask-key dragging/retiming in the timeline, and group audio effects beyond fades
and gain. Long-project GPU/CPU/memory and cross-device qualification remain open.
This is a locally signed native preview, not a notarized public release.
