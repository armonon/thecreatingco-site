# Luma golden workflow — fixture and qualification spec

Status: specification only; no interactive golden run completed in this audit.
Target workflow: **Import → Edit → Layers/Masks → Save → Reopen → Export**.

## Reproducible fixture

Keep generated inputs and the resulting native project together under a dated,
source-identified run directory (do not commit customer artwork):

- `source.png`: deterministic 2048×1536 sRGB RGBA image generated from fixed
  integer formulas, not random values. Include an opaque gradient, a partially
  transparent antialiased circle, and a 1-pixel checker border so color,
  alpha, edge, and orientation regressions are visible.
- `overlay.png`: deterministic 1024×768 RGBA checker/diagonal pattern with
  transparent corners.
- `expected.json`: dimensions, sRGB profile expectation, fixture SHA-256 values,
  expected layer names/order/visibility/opacity, mask control points, and export
  dimensions. Store no machine-specific absolute paths.
- `golden.luma`: created only by the workflow below; never use a hand-authored
  project as proof that the import path works.
- `export.png`: exported composite and SHA-256, plus pixel-comparison report.

Generate the two PNGs in a Node script using `@napi-rs/canvas`, fixed formulas,
and explicit PNG encoding. Record Node/package versions, script hash, fixture
hashes, OS, browser/WebView version, Luma commit, edition, and viewport.

## Qualification procedure

1. Start from an empty Luma session and import `source.png` through the user-facing
   open/import path. Verify width/height, orientation, transparency and profile.
2. Add `overlay.png` as a separate raster layer. Rename layers `Source` and
   `Overlay`; move Overlay above Source; set opacity to 63%; create a group and
   return the two layers to the documented expected hierarchy.
3. Add a layer mask to `Overlay`. Paint a hard-edged diagonal mask with the
   coordinates/radius in `expected.json`; verify the layer thumbnail and canvas
   show the same result. Hide/show the mask and layer to check non-destructive
   behavior. Apply one reversible tonal adjustment and keep it as an adjustment
   layer.
4. Exercise undo/redo across mask strokes, visibility, order, and adjustment.
   Compare the document state and exported pixels at each branch; require no
   lost or duplicated history nodes after save/reopen.
5. Save as `golden.luma`. Close the document and reopen it through the normal
   picker/native dialog. Compare dimensions, profile, layer/group tree, mask
   pixels, order, opacity, adjustment parameters, dirty/saved state and rendered
   composite with the pre-close state.
6. Export PNG at document dimensions. Compare alpha exactly and RGB against the
   pre-close expected render with a documented tolerance; record maximum and
   mean channel error, changed-pixel count, and export settings. Do not treat the
   editor's own encode→decode round trip alone as independent fidelity evidence.
7. Repeat with: a deliberately corrupted `.luma`, a missing import file, and a
   failed/cancelled export. Verify clear errors, no replacement of the open
   project, no silent state mutation, and successful recovery/continued editing.

## Acceptance record

One JSON receipt per run records each step's pass/fail/untested state, exact
commands, source/fixture hashes, logs, output hashes, duration, and limitations.
The run is not qualified if a step is skipped or a warning implies flattening,
conversion, or unsupported behavior without explicit user acknowledgement. Test
web and packaged desktop separately; this spec does not substitute for physical
tablet, clean-install, large-document, or Photoshop interoperability campaigns.
