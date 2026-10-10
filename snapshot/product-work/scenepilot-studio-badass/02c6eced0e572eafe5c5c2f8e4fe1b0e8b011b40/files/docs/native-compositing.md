# Native composition groups, masks and mattes

AppKit migration-preview increment, 2026-09-21. This extends the independent native
application, not Browser Lite or the existing Electron Pro renderer. It is not an
After Effects parity claim.

Follow-up: [Bezier masks, shape animation and group fades](native-animated-masks-and-fades.md)
adds those three capabilities in native document v5. The v4 contract and results
below describe the preceding increment; its corresponding unsupported items are
superseded by that follow-up.

## What the renderer does

- Nested compositions combine their children on a transparent intermediate image.
  Group transform, animated opacity, exposure, saturation and blur operate on that
  combined image. Two overlapping opaque children at group opacity 0.5 produce
  alpha 0.5, not the incorrect per-child result of 0.75.
- Rectangle/ellipse shape masks have normalized center and size, inversion, and
  0–200 pixel Gaussian feathering. They are in the composition's canvas space,
  with positive Y down. Shape coverage is applied after source fit/fill, before
  placement and effects. It therefore moves with the clip, and blur also softens
  its edge. A group's shape mask cuts its already combined children.
- Track mattes reference a video clip or composition **in the same sequence** by
  stable clip ID, independently of track order. The provider's fully rendered
  pixels (its effects, motion, mask, opacity and any own matte) supply coverage.
  Alpha mode uses actual alpha. Luma mode uses linear Rec.709 luminance multiplied
  by provider alpha, clamped to 0–1. Both support inversion.
- Matte coverage is evaluated in the parent's sequence space, after the target's
  placement and effects. The final master is composited over black; intermediate
  groups remain transparent. MP4 does not gain alpha export from this change.
- A provider referenced by an enabled-track consumer is hidden from the picture,
  but its audio is unchanged.
  Set its audio gain to zero when it should be silent. Multiple consumers share
  the provider's frame-local evaluation. References remain scoped to each reused
  composition instance; child clocks respect nesting, speed and source-in.
- An inactive or disabled provider supplies zero coverage. An inverted matte then
  supplies full coverage. A required active media frame that cannot be decoded is
  an error, not silently substituted with black.

## Native controls and safe editing

Select a video clip or composition instance. Scroll the Clip Inspector to
**Masks & Mattes** and **Mask Geometry**. Choose a shape, enter its geometry or
feather, and press Return. Select a sibling in **Matte Source**, then Alpha/Luma.
The Compositing menu and clip context menu expose the same shape/channel/invert/
remove commands. Invert buttons show checked state. Existing transform, motion
keys and picture controls now work on composition instances.

Changes are validated, saved and undoable. Locked tracks cannot be edited. The
source picker excludes audio, self-references and dependency cycles. Malformed
references, missing providers, cycles and chains longer than 32 clips refuse.
Deleting or splitting a referenced provider is blocked: remove its links first,
or split its media inside a composition. Splitting a consumer preserves its links,
mask and animation clock on both halves. Track reordering does not change links.

Native document **v4** carries these settings and upgrades v1–v3 on read. Older
native readers reject v4 rather than silently discarding masks and mattes.
Source files and legacy Pro documents are not rewritten by conversion.

## Deliberate limits

- One rectangle/ellipse mask per clip, not freehand/Bezier masks, multiple mask
  Boolean operations, animated mask paths, brush refinement or semantic roto.
- Existing five-channel motion can move/scale/rotate a masked group. Mask geometry,
  grading and blur do not have independent keyframe channels yet.
- Group audio fades remain explicitly rejected and disabled. Use audio fades
  inside the composition; animate group opacity for a picture-only fade. No
  per-child approximation of a nonlinear nested audio envelope was introduced.
- Matching nested dimensions, SDR output, 256 expanded media clips, 10,000
  composition nodes, and existing native codec/rate limits still apply.
- No public deployment, Developer ID signing, notarization or Electron replacement.

## Reproducible qualification

`npm run native:test` generates synthetic H.264/AAC sources and exercises the
native Core Image/AVFoundation path. New tests cover group overlap alpha, nested
opacity, shape geometry/feather/inversion, moving masks, actual pixel alpha/luma,
transparent luma, missing/inverted providers, dependency chains, shared providers,
save/undo, invalid inputs and protected provider edits. Real media tests compare
split/trim and reused groups at different speeds, then independently decode an
exported MP4 at five times (mean byte error under 8/255 including codec loss).

`node scripts/create-native-compositing-qa.mjs` creates a separate synthetic native
UI project under `outputs/native-macos`. It never opens a user project. Build with
`npm run native:build`, open that fixture, and test the group on the Composition
track against the generated source on the Matte source track. Confirm mask edits,
matte selection/channel/inversion, undo/redo, locking, save/reopen and preview.

Ad-hoc rebuilds may invalidate macOS's previous Downloads-folder permission for
the app. Do not bypass TCC or change privacy permissions automatically. The user
must explicitly approve access; terminal renderer tests do not certify the GUI's
file-access path. Stable signing and clean-machine qualification remain release
requirements.

### Recorded result — 2026-09-21

- **75 native tests passed, no skips**, with generated media enabled. The exported
  `outputs/native-macos/compositing-master.mp4` was independently decoded and
  compared with the shared native preview renderer at five times.
- **768 JavaScript tests passed**, plus `npm run check` (TypeScript + lint), native
  release build, ad-hoc signature verification and no-web-runtime dependency check.
- Actual AppKit interaction: selected the composition instance, assigned its matte
  source, switched Alpha → Luma, inverted and undid inversion, added a rectangle
  mask, set width to 50% and feather to 12 px, and observed the resulting picture.
  Locking disabled the controls; undo restored availability. Save/reopen retained
  the source, Luma channel, shape and numeric values. Provider context menus showed
  Delete/Ripple Delete/Split disabled. No privacy settings were changed.
- Direct visual inspection used the available approximately 1188×768 native window.
  Existing layout tests cover the required viewport matrix; new screenshot
  baselines at all three larger sizes were **not** captured. Long-project latency,
  memory and cross-device GPU qualification remain open, not inferred from these
  short functional tests.
- One test build was invalidated by a source edit during compilation and rerun
  cleanly. The successful full native run took 546 seconds on this heavily loaded
  machine; this is not a usable performance benchmark.
