# Bug scan fixes — 2026-09-28

Scope: the five findings from the current-code scan. Existing unrelated working-tree changes were preserved. No deployment, packaged installer, signing, or notarization was performed.

## Fixed

1. Composition Fit viewport: explicitly stretch the flex children rather than inheriting grid centering. The measured viewport no longer collapses to one pixel.
2. Overlapping media imports: asset state now has a synchronous event-time reference. Every asset mutation updates it; asynchronous import completion merges/relinks/deduplicates against that reference instead of its initiating render's array. Regression coverage includes reversed completion order, an intervening favorite edit, and duplicate imports.
3. Pending transport starts: request generations invalidate audio preparation after Stop, a second Play, document-context cleanup, or unmount. Preparation errors are reported without starting playback.
4. Track ordering: Raise/Lower rejects both a locked selected track and a locked adjacent target, before checkpointing or changing the stack.
5. Export dependencies: hidden/non-solo placements and disabled composition layers are excluded; nested composition tracks honor visibility/solo. Picture dependencies are collected independently of audio, which comes from the actual program schedule. Active matte/effect/plate dependencies remain included. Master and composition preparation tests reach the worker boundary without resolving disabled linked media.

## Validation

- Full test suite: 929 passed, zero failed.
- TypeScript and full ESLint check passed. Removed one unused test-only lint suppression reported by that run and linted the changed test again.
- Web production build and desktop renderer production build passed. Existing chunk-size/dynamic-import warnings remain.
- `git diff --check` passed.
- Browser: clean composition mount, visible title after scrubbing, Fit sizing at 1280×800, 1440×900 and 1920×1080, numeric zoom, and per-composition zoom restoration. Viewport override restored afterward. Clean final browser page logged no errors.
- One development hot-reload warning occurred while editing an effect dependency array; the clean-page check had no such warning.

These checks qualify the five fixes, not every possible product behavior. Export tests validate preparation and the worker handoff; they are not a new real-media encoding or packaged-macOS qualification campaign. Existing user tabs and unsaved projects were not reloaded.
