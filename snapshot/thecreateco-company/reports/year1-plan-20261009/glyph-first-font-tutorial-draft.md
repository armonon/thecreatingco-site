# Draft: Make a tiny custom font from four drawn letters

**Internal content draft — not published.** This walkthrough uses one real Glyph
Studio alpha fixture and a narrow destination-app check; it is not a customer
story, general compatibility claim or release certification.

## Draw a small original mark

Start with a short wordmark or monogram made from letters you draw yourself. The
verified example used four hand-drawn glyphs — **A, V, H and o** — then adjusted
spacing and a kerning pair. It is a useful first test because you can see whether
the output still looks like your artwork in more than one arrangement.

> **Set expectations:** Glyph Studio is a public alpha. This example covers a
> small Basic Latin fixture; accented characters, ligatures, every glyph and
> professional foundry workflows are not established by this test.

## Keep an editable copy

Save the project before exporting. In the recorded browser run, the project was
saved, the tab closed, the autosaved state restored, the portable project reopened,
and the drawing edited with undo/redo before export. Keep a separate project
backup: browser storage is not permanent storage.

## Export the format you need

The fixture produced TTF, OTF and an SVG glyph sheet from the same original
lettering. You can compare the font files in a destination workflow and use the
SVG when you need outlined artwork rather than an editable font.

![Actual sample rendered from the exported OTF using Inkscape 1.4.2's command-line interface. This is generated output, not a manual GUI capture.](../glyph-destination-20261007/otf/specimen.png)

The test reopened a saved SVG that retained editable text and the selected font;
it also generated an outlined SVG and reopened that output. Those are separate
outputs: outlined paths do not preserve editable text.

## What was and wasn’t checked

The actual exported TTF and OTF were loaded by **Inkscape 1.4.2's command-line
interface** using an isolated font configuration. It exported PNG/PDF and an
outlined SVG; the saved editable SVG was opened in another invocation. Raster
comparison for this exact fixture matched the reference ink within the test's
one-pixel tolerance. This verifies a narrow command-line path only. It does not
show a person installing a font through the desktop UI, and it does not establish
compatibility with Figma, Adobe apps, Canva, another operating system, or every
glyph.


## Try the workflow and report friction

Open the [Glyph Studio browser alpha](https://glyph-studio-610.netlify.app/studio),
make a short original sample, save a project backup, reopen it, and export the
format you need. Tell us which step was unclear or which glyph/destination you
need next. Do not use valuable work as the only copy.

**Before publication:** capture a fresh source-matched browser walkthrough with
consent, verify all screenshots against the current live build, and keep the
Inkscape limitation visible. Do not add customer quotes, platform logos, pricing,
or compatibility claims without new evidence and the existing publication
approval.

## Internal evidence

- [Creator validation protocol and draft shot list](../glyph-destination-20261007/creator-validation-pack.md)
- [Glyph destination review](../glyph-destination-20261007/independent-review.md)
- [Exact artifact hashes](../glyph-destination-20261007/artifact-sha256.json)
- Current images: `../glyph-destination-20261007/otf/specimen.png` and
  `../glyph-destination-20261007/otf/editable-reopened.png`.
