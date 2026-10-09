# Glyph destination-app qualification and metadata repair

2026-10-07 Pacific. User: Armon, #millions message 1557627172842119253 (“keep going”). Parent task P08; owner revenue-glyph-destination-20261007. Narrow standalone result; Brand Kit and embedded Luma Glyph remain untested.

## What was accomplished

- Captured four original pointer-drawn letters (A, V, H, o), kerning and a portable project from the public standalone Glyph editor. Actual save→tab close→autosave restore→portable reopen→edit/undo/redo→TTF/OTF/SVG download passed. This new capture retained the real output files needed for destination testing; unchanged broad recovery/accessibility suites were not repeated.
- Inkscape 1.4.2 on macOS loaded the actual TTF and OTF through isolated process-level font configuration. Both rendered the authored shapes as text, exported PNG/PDF and outlined SVG, then reopened outlined output with identical thresholded ink masks.
- Native editable SVG save/reopen also retained the two exact text strings, custom font family and identical raster ink masks. This is command-line application execution, not a manual GUI or system-font-install test.
- Native text rendering versus independently parsed font-outline references had 100% symmetric one-pixel-tolerant foreground-ink agreement on this fixture. Missing-font negative controls scored only ~21%; they do not pass the comparator. These are fixture comparisons, not product quality or customer metrics.
- Independent reviewer confirmed matching captured/font-directory hashes and expected embedded PDF font streams; independently opening PDF in another reader remains untested.
- The actual downloaded SVG glyph sheet also imported/rendered through Inkscape.

## Exact scope and provenance

Native fixtures are from the **pre-repair public source** a3e50fa6d5fabdf499fd1592085c54d9710e42dc, merged main 0feefc7785d356f1862f23a96162bfd69f4d872e. Fresh live index/runtime JS/CSS hashes match the prior release manifest. Historical published deploy: 6ac702c6402f6654a7134732. This is a narrow current runtime parity check, not a new complete provider/deploy query.

No Figma, Adobe, Canva, physical mobile, Windows/Linux, manual font installation or manual GUI proof is inferred. No fallback-free claim for undrawn characters. No broad font-production or full release readiness. Existing free functionality stays free.

## Discovered defect and repair

The exported TTF Macintosh name record masked an em dash into U+0014, while Windows metadata kept the punctuation. It did not prevent this fixture rendering. Fixed in isolated worktree /Users/agentsattari/code/worktrees/glyph-ttf-metadata-20261007, branch fix/glyph-ttf-name-metadata-20261007, commit **129c7aa0ce1f5f8e437e606b1fd278ee1d9c67a0**.

The maker credit now uses an ASCII hyphen, consistent with the already-validated ASCII family/style names. Added a parsed-font regression checking readable, matching Macintosh/Windows records. It failed against unchanged main before the repair. Fresh npm ci, **46/46 tests**, lint, production build and diff-check pass. Separate OpenAI review found no blocking issue. PR: https://github.com/armonon/glyph-studio/pull/3 . Verified MERGED at 2026-10-08T05:44:46Z as 55d0bcc3c5ab4734dbf7ec8368d2eb39ae6cbcd3; branch had no required checks/rules and no bypass was used. No configured remote checks is not a hosted CI pass. See pr-final.json / merge-result.json; no deployment was performed by this work.

No licensing grant, author-ownership claim, geometry/kerning change or paid feature was introduced. Existing OTF/TTF metadata differences outside the corruption remain documented. Blank license records and fsType=0 are not evidence of rights over arbitrary artwork. Original test strokes avoid third-party font reuse; this does not settle every user's licensing situation.

## Evidence and reproducibility

- capture-fonts.mjs / capture.log / export-metadata.json: actual public UI capture and independently parsed exports.
- Glyph-Proof-Oct-Seven.glyph.json, GlyphProofOctSeven-Regular.ttf/.otf and glyph-sheet SVG: retained original inputs/outputs.
- generate-specimens.mjs, reproduce-native.py: exact native fixture generation and execution approach. Absolute local dependencies recorded; not advertised as a portable installer.
- native-commands.json: 17 successful Inkscape commands with explicit font-config overrides; warnings retained.
- compare-native.mjs / pixel-comparison.json: independent outline comparison, missing-font control, outlined and editable reopen.
- live-runtime-parity.json: fresh public runtime hashes against prior manifest.
- independent-review.md and metadata-code-review.md: independent OpenAI reviews and subsequent evidence addendum.
- metadata-regression-before.log, metadata-checks.json and associated test/build logs: fail-before/pass-after repair.

## Environment limitations encountered

Peekaboo 3.0.0-beta4 cannot decode the selected OpenClaw Bridge handshake (permission-tag protocol mismatch). The selected socket/provider was not replaced or bypassed. Used the installed Inkscape command-line interface instead; no UI-access success claimed. Inkscape emits a CVDisplayLink warning while producing verified CLI output.

System Python's XML extension fails to load due to libexpat symbol mismatch. The native SVG outputs were instead parsed/checked through browser DOMParser in the evidence comparator; no system Python changes. Initial XML-validation attempt did not complete; it is not counted as a passing test. Memory recall was stale due to an expired embedding-provider credential; current files and direct outputs supplied evidence instead.

## Commercial handoff — not customer validation

creator-validation-pack.md contains the truthful offer draft, five-person qualification/session protocol, observation fields, stop rules and M03 tutorial shot list. outcome-template.json contains only null placeholders, explicitly NOT observations. No messages sent, participants recruited, interviews, sales, new prices or paid launch.

Reuse W03/E02 for five actual creator journeys under existing Growth consent/send gates, and M03 for the reviewed factual demonstration. The narrowly required destination proof is now available; broad Brand Kit/embedded/physical-platform work remains P08 / PROGRAM18-GLYPH-001 scope, not a condition that every unrelated app finish before a research test. Do not convert command-line proof into a claim of frictionless manual installation.

## Queue disposition

P08 receives a partial NEEDS_REVIEW checkpoint, not COMPLETE: standalone native proof and metadata repair are delivered; Brand Kit/embedded scope and remaining platform/manual checks are explicitly retained. W03/M03 may prepare the narrow, disclosed Glyph research/demo using this independently reviewed evidence without pretending P08's entire scope passed. Paid software readiness remains unchanged.
