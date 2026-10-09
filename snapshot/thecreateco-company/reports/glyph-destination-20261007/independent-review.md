# Independent review — Glyph destination application evidence

Reviewed 2026-10-07 PDT by a separate OpenAI reviewer context under the parent P08 lease. Read-only product review; no product edits, external contact, queue mutations, or full product test reruns.

## Decision

**Narrow pass:** the supplied four-glyph TTF and OTF exports were loaded and rendered as text by **Inkscape 1.4.2 on macOS through its command-line interface**, with isolated per-process font configuration. The artifacts support rendering the authored outlines, exporting PNG/PDF and outlined SVG, and reopening/rasterizing that outlined SVG with the same ink mask. This is genuine destination-application evidence beyond our own editor/browser render.

This does **not** establish general font compatibility, manual GUI installation/use, native editable text save/reopen, compatibility in Figma/Adobe/Canva, whole-alphabet/font-production readiness, or Brand Kit results. It is also not customer validation or willingness-to-pay evidence.

## Evidence inspected

- `capture-fonts.mjs`, `capture.log`, portable `.glyph.json`, TTF/OTF exports, exported glyph-sheet SVG, and `export-metadata.json`.
- `native-commands.json`; both per-format `fonts.conf`, `specimen.svg`, `reference.svg`, `outlined.svg`, generated PNGs and PDF font declarations.
- `compare-native.mjs` and `pixel-comparison.json`.
- Visually inspected the TTF native render and missing-font negative-control image. The distinct authored strokes are plainly different from the fallback font.

### Why the no-fallback claim is supported for this fixture

- The fixture uses a distinctive family and four original pointer-drawn characters: A, V, H, o (plus spaces). The captured fonts contain those shapes.
- Independently checked that each font copied into its process font directory is byte-identical to the captured export. SHA-256: TTF `f537b4ed9be90d9fd427a9ea1d26ca7ae6808d968e7fb1287877b8772acb38f6`; OTF `34271674c16b90dd43c5769eb2d3f973211b86bacb3f426dac184725a717982d`.
- The comparator measures **foreground ink**, symmetrically, with a one-pixel tolerance, not mostly empty-page agreement. Native text and independently parsed font-outline references have 100% tolerant ink agreement for both formats; exact mask differences are two pixels for TTF and one for OTF.
- The missing-font controls have only approximately 21.6% TTF / 21.0% OTF tolerant agreement. Thus a fallback render does not pass the same comparison.
- The native PDFs declare the expected generated subset names and embedded font streams: TTF `/FontFile2`, OTF `/FontFile3` with Type1C. This supports font embedding in the produced PDFs; opening/rasterizing the PDF in a separate reader was not established by the reviewed evidence.
- Each outlined SVG contains two path elements and no text elements. Re-rendering it produces an exact matching thresholded ink mask. This demonstrates **outlined artwork** reopening, not recovery of editable font text.

No claim should extend the no-fallback result to characters absent from the fixture or fonts other than these exact exports.

## Concrete issues / corrections

1. **Misleading capture-script header (reporting issue, not a render failure).** At review time `capture-fonts.mjs` still described the inherited “Export for Figma” raster comparison and a kerning-off negative check; that shortened script does not execute those checks. The actual independent native comparisons live in `compare-native.mjs`. Correct the header so neither Figma execution nor an unexecuted check is implied.
2. **Font metadata discrepancy (product issue).** TTF Macintosh copyright decodes to `Made with Glyph Studio U+0014 thecreateco`, while its Windows record has the intended em dash. TTF and OTF also have differing version/PostScript-name/weight defaults. These did not prevent this fixture from rendering but should be recorded and addressed by the product owner before presenting professional font metadata as complete.
3. **Licensing metadata is not a rights grant.** OTF license/license URL records are blank; TTF carries maker attribution but no reviewed license record. `OS/2.fsType = 0` describes embedding permissions and is not proof of commercial ownership/licensing of source artwork. The original drawn fixture avoids importing somebody else's font, but the result cannot establish blanket legal rights for arbitrary user input or every exported font. Do not infer that thecreateco owns a user's original glyphs from the current manufacturer/designer records.
4. **Reproducibility/provenance gap.** The reviewed command receipt records the application and process-font approach, but not each command's actual environment; no native-fixture generator was present when first reviewed. Preserve the generation script and explicit `FONTCONFIG_FILE`/binary version in the receipt. The remote URL/time establishes a live-site capture, not an immutable deploy/source identity by itself. Link the deployment receipt/hash if a source-to-live parity claim is needed.
5. **Expected warnings are retained.** Native commands return zero but emit `Failed to initialize CVDisplayLink!`. Successful raster artifacts establish this did not block the tested CLI path; do not erase warnings or extrapolate to manual-display behavior.

## P08 closure semantics

P08's title includes **Glyph generated fonts and Brand Kit exports**. This evidence can close a narrowly specified Glyph/Inkscape sub-check, but must not silently close the entire task while Brand Kit remains untested. Use the queue's existing remaining-scope mechanism or explicitly preserve/transfer that remaining work with evidence and ownership before any administrative closure. Do not mark Brand Kit, embedded Luma Glyph, manual GUI, Figma, Adobe, or OS font installation as passed.

This narrow destination result also does not close `PROGRAM18-GLYPH-001` or the complete release matrix. Existing required CI/review/authorization gates remain unchanged. The parent should record a partial P08 result if no truthful full-scope closure is available.

## Review limitations

The reviewer inspected and cross-checked supplied artifacts, not a fresh full application run. An attempted local PIL comparison was unavailable and Python's XML extension failed to load; neither is presented as a product failure. Binary copy/hash checks, direct SVG/PDF inspection, visual review, and review of the browser-canvas comparator completed. Reported quantitative raster scores are from the inspected parent-generated comparison receipt, not an independently repeated full rendering run.

## Addendum — 2026-10-07 PDT, after native editable-text and provenance additions

The following later artifacts were inspected. This addendum supersedes only the corresponding limitations above; the original review is retained as a record of the earlier evidence state.

1. **Editable SVG text save/reopen is now evidenced.** Additional Inkscape CLI commands save each specimen as `editable-saved.svg` without converting text to paths, then start another invocation to render that saved file. I inspected both saved files: each retains two `<text>` elements, the expected font family, and the exact strings `AVHo oHVA AV` and `A V H o`. The updated comparator parses the SVG with DOMParser, asserts those exact text strings, and compares the reopened native raster. `pixel-comparison.json` records zero exact thresholded-ink-mask differences for both TTF and OTF. Thus the previous “outlined artwork only” boundary can be expanded to **CLI SVG save/reopen preserving editable text and its rendered appearance for this fixture**. This does not demonstrate manual GUI editing after reopen or portability to a machine without the font.
2. **The capture header reporting issue is resolved.** The revised header correctly says it captures live UI exports and delegates native comparisons to `compare-native.mjs`; it no longer claims an executed Figma or inherited raster check.
3. **Native reproduction details are retained.** `generate-specimens.mjs` reconstructs text/reference fixtures from the captured fonts, and `reproduce-native.py` specifies the Inkscape executable, font copies/configuration, commands, missing-font control, and comparison. `native-commands.json` now includes per-command `FONTCONFIG_FILE` overrides, including the separate control configuration. These resolve the missing fixture-generator/environment-documentation gap for this local setup; dependencies remain absolute local paths, not a portable installation package.
4. **Narrow live-runtime provenance is added.** `live-runtime-parity.json` records fresh index, runtime JS and CSS hashes matching the earlier release manifest. I independently checked that all three expected hashes appear in `glyph-completion-20261007/release-manifest.json`, whose source is `a3e50fa6d5fabdf499fd1592085c54d9710e42dc`. This supports runtime parity with the previously recorded release, **not a fresh complete provider manifest or deployment query**; the addendum does not claim that every hosted file was reverified.
5. **The narrow metadata repair is separately reviewed.** Commit `129c7aa` contains the same two-file ASCII attribution/regression patch reviewed in `metadata-code-review.md`. The compatibility fixtures still represent the pre-repair live export. The repaired source must not be described as deployed merely because the commit exists.

No new blocking finding in these additions. Manual macOS font installation, manual GUI behavior, Figma/Adobe/Canva compatibility, untested character coverage, Brand Kit/embedded Glyph, broad license rights, customer demand, and full release readiness remain unverified. P08 must continue to retain its outstanding scope explicitly.
