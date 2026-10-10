# Web deployment — 2026-09-21

Published the current `site/` marketing pages and rebuilt Browser Lite bundle to the existing Netlify project `scene-pilot`.

- Production: https://scene-pilot.netlify.app/
- Editor: https://scene-pilot.netlify.app/app/
- Final deployment: `6ab1e959b04b12d884ab813f`
- Immutable deployment: https://6ab1e959b04b12d884ab813f--scene-pilot.netlify.app/
- Source: working tree based on `27b4f0f`, branch `feature/complete-effects-gallery`; this is not a clean tagged source release.

## Validation

- `npm run build:app`: passed.
- TypeScript: passed. ESLint: no errors, one pre-existing/current unused `Move` import warning in `app/page.tsx`.
- Full quick suite: 771 passed, none failed.
- Marketing suite rerun after the edition-copy correction: 12 passed.
- Live editor: setup dialog mounts; closing it opens Browser Lite Auto Edit with its generation controls. Pro-only composition workspace stays disabled in Lite.
- Live marketing: 78 effects/presets displayed; searching `glow` returns six results; selecting Glow loads its real rendered comparison. No console errors observed in these live checks.
- Homepage, app, download page and gallery data returned HTTP 200. Published app HTML and gallery data matched local files; Netlify rewrites relative HTML links during post-processing.
- Corrected the Lite edition card: core motion/effects, with layered compositions explicitly requiring Desktop Pro.

## Not included / still missing

No desktop installer was rebuilt, uploaded or replaced. Electron Pro needs a refreshed package to distribute the new composition-document workflow. The separate AppKit native preview still lacks Auto Cut and full legacy/effect parity; this web publication does not change that.

Independent per-composition frame rates remain unsupported. OS-file dragging onto New Composition still needs manual acceptance (project-media dragging is verified). Files must be imported before dropping into an existing composition viewer.

Public desktop release gates remain: Developer ID signing/notarization, clean-machine/oldest-supported-OS and update/rollback tests, realistic long-project qualification, and candidate-bound perceptual reviews. See `release-handoff.md`, `release-followup-0.1.16.md` and `native-editorial-isolation.md` for exact scope and limitations. This deployment is an early-access web update, not professional parity certification or approval of a new desktop release.
