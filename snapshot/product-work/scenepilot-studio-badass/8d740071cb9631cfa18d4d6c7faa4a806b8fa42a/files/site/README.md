# ScenePilot marketing site

Self-contained static marketing and download pages. No build step, runtime
dependencies, analytics, source-media uploads or external fonts.

## Files

- `index.html`: product-led homepage, workflow tour, Look Lab, pacing demo,
  Desktop Pro features, editions and FAQ.
- `download.html`: matching early-access download and installation page.
- `studio-site.css` / `studio-site.js`: shared responsive visual system and
  progressive interactions.
- `assets/*-20260911.jpg`: credited source photography and real product captures.
- `tools/`: built output of the film tools (alpha) — AutoCut, Captions, Board, Grade.
  Source lives in `/tools` + `lib/`; rebuild with `npm run build:tools`
  (`npm run dev:tools` for HMR at http://localhost:5174/tools/).
- `app/`: existing Browser Lite static SPA output. **Not rebuilt or changed by
  the marketing refresh.**
- `styles.css` / `app.js`: retained legacy assets, no longer used by these pages.
- Root `netlify.toml`: existing Netlify deployment contract; publish `site`,
  no build command. No hosting-provider migration.

## Design and interaction

The September refresh follows the Sites skill’s existing-project and
preview-first workflow. The direction is an editorial, dark creative studio:
large typography, lavender actions, a lime desktop section and photographic
breathing room. Positioning includes editors, directors, musicians and visual
artists, without claiming full Adobe-suite equivalence.

- Keyboard tabs: Left/Right/Home/End; selected tabs use roving tabindex.
- Authentic editor captures open in a native modal dialog with Escape and focus
  restoration. No reconstructed or invented editor UI.
- Effects gallery: 78 actual ScenePilot effects and presets, with searchable
  families, thumbnail selection and a draggable/keyboard
  before/after split. Original / Compare / Result modes share the same source.
  Static pre-rendered frames, not live processing or native Pro parity certification.
  Image loading is race-safe and preserves the last successful render on failure.
- Pacing: deterministic 4/8/16-shot examples across eight 4/4 bars. Tempo adjusts
  the silent playhead. Play/pause/resume, offscreen/background pause, and
  reduced-motion one-bar stepping. No audio or flashing strobe.
- Native details/summary FAQ; mobile menu with Escape.
- No-JavaScript visitors retain the site, edition links and all workflow copy.

## Media provenance

**Alpine source image**: “A mountain range seen from above,” Johannes Mändle.
https://unsplash.com/photos/a-mountain-range-seen-from-above-vXptr31LtuM
The source page identifies this as free to use under the Unsplash License.
Retrieved September 11, 2026 from:
https://images.unsplash.com/photo-1666697582458-906ba96b725a?fm=jpg&fit=crop&w=1920&q=85
Visible attribution is provided below the hero. The image is a source photograph,
not a claim of a ScenePilot-generated image.

**Product screenshots**: captured directly from the running ScenePilot
development build based on main `5780453`, at 1280×720. The screenshot API returns
JPEG bytes, which are stored with matching `.jpg` extensions.

- `studio-edit-20260911.jpg`: imported alpine still in Master Sequence, with
  a nested Title Impact composition.
- `studio-motion-20260911.jpg`: built-in Neon Orbit composition and track stack.
- `studio-effects-20260911.jpg`: actual FX browser, rendered sample audition,
  imported image layer and composition controls.

Only a disposable local demo project was used; no customer media is included.
Captures are explicitly development-build views. They do not certify the current
public installer. Existing social metadata images are preserved.

**Effects gallery**: generated from the credited alpine photograph with the actual
`effectPreviewPlan` + `computeFramePlan` + `paintFramePlan` pipeline and WebGL
grade pass used by the editor. No independently reimplemented CSS effect is used
on the website. All 27 clip effects and the preset families listed below have
rendered samples. Only the chosen full-size pair loads on selection. Film grain
is sampled at t=1s; the gallery never auto-animates.

Regenerate with `node scripts/build-marketing-effects.mjs`. The generated
`assets/effects-gallery/provenance.json` records the engine revision, source hash,
sample time, dimensions and asset checksums. `gallery-data.js` contains the actual
recipe parameters and works offline via script loading (no file-URL fetch needed).
The renderer helper runs offscreen solely to produce assets; no Electron or editor
bundle is shipped to the marketing page. Original/noir comparison remains visible
when JavaScript is disabled. Failed data loading disables the gallery controls.

## Download safety and release behavior

The static download link opens the public releases page:
https://github.com/armonon/scenepilot-releases/releases/latest

One optional read-only GitHub API request resolves an explicitly named ARM64,
AArch64 or Apple Silicon DMG. The resolved URL must be HTTPS GitHub in this same
repository’s release-download path. A malformed response, unknown architecture,
timeout, API error or unavailable asset preserves the releases-page fallback.
No signing or notarization claim is inferred from a filename or API response.

## Local preview and checks

```sh
python3 -m http.server 4000 --bind 127.0.0.1 --directory site
node --check site/studio-site.js
node --experimental-strip-types --test tests/marketing-site.test.mjs
npm run check
```

Open http://127.0.0.1:4000/. Both pages also work as local files; the optional
release lookup may depend on network/browser policy.

Regression tests cover product positioning, IDs and local asset/link targets,
tab/panel wiring, real JPEG assets, script syntax and scoped release lookup.
Manual browser checks cover tabs and keyboard navigation, modal open/Escape,
color choice and intensity, comparison slider, pacing counts and playback,
mobile menu, image loading, horizontal overflow and the download fallback.

## Complete effect-library gallery

`#playground` is a searchable catalog generated from the product registries by
`scripts/marketing-effect-catalog.ts`. It includes all 27 clip-effect types,
9 recipe stacks, 4 film grades, 7 transitions, 6 strobe presets, 3 camera punches,
3 shakes, 5 stutters, 4 speed ramps, 4 echoes and 6 text animators (78 entries).
Off/none/clean controls are represented by the original comparison, not counted
as effects. Arbitrary custom graphs, imported LUTs and user compositions are not
claimed to have exhaustive previews.

Regenerate with `node scripts/build-marketing-effects.mjs`. This runs the real
`effectPreviewPlan` / `computeFramePlan` / `paintFramePlan` paths, plus the actual
WebGL grade shader in Chromium. It fails rather than substituting a CSS
look when WebGL is unavailable. Provenance includes engine-source and JPEG hashes.

Still entries have 25/60/100 percent strengths. Temporal entries have 61 manually
scrubbable paired frames; no strobe autoplay. A generated moving test card makes
source-time remapping visible; demonstration beat/onset grids are explicitly not
claimed to be analysis of music. Echo histories are rendered sequentially at 30 fps.
Isolated photo tiles show alpha-sensitive effects against a checkerboard.

Only the chosen comparison pair loads at full size; thumbnails are lazy-loaded.
Identical frames share an asset URL. A 48-entry decoded-image LRU cache and bounded
neighbor prefetch keep reverse scrubbing responsive without loading the entire
library. Pointer updates coalesce to one request per display frame. All temporal
samples are spaced uniformly in time; the comparison divider uses 0.1% increments.
Both images decode before switching. Stale requests and failed pair loads preserve
the previous comparison and controls. With JavaScript unavailable, the original
Noir before/after image remains visible. Catalog/hash tests catch missing entries
and assets that need regeneration after engine changes.

## Publication

This refresh does **not** deploy or modify the installed desktop app. Review it
locally before publishing. The existing Netlify Git-connected branch can deploy
on push/merge; publishing must be intentional. Keep the current host and routes
(`/`, `download.html`, `app/`) intact.
