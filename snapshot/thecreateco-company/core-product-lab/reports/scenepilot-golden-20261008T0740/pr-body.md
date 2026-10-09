## Scoped workflow repair

Browser Lite's upward-opening timeline Add track menu was clipped by the timeline panel, letting the inspector intercept ordinary Video track clicks. Preserve the existing Pro selector specificity while applying the identical overflow/stacking rule to Lite. No capability changes.

Add a localhost-only Chromium regression with real synthetic video import, center hit-testing, ordinary clicks, Add/Undo/Redo counts, two viewport sizes, renderer error collection and source/CSS/fixture fingerprints.

## Local evidence

- Baseline ordinary Lite pointer action failed with inspector interception; logs/screenshots retained in dated Core Lab evidence.
- Fixed normal pointer/Undo/Redo checks pass at 1440×1100 and 1140×900.
- Node22 production build + 1095/1095 unit tests pass; types/lint and focused30 tests pass.
- Rebuilt development Electron: six import/native output/save/cold-open/audio-presence/UI-export checks pass.
- Independent OpenAI reviewer found no blocking issue in the scoped two-file fix; no release approval implied.
- Separately, three schema-authored12s composite golden subsets preserve full project fields through save/undo/coldreopen and export360frames/H264/stereo48k. Independent regional/spectral checks remain sampled, not complete audiovisual parity.

## Gates and scope

Stacked on PR94. Do not merge unreviewed/unqualified downstack work. Mandatory hosted checks remain required; no CI billing retries, merge, deployment or release in this job. Browser Lite full golden, native OS chooser, signed packaged/cleaninstall/platform, exact alpha/font/audio parity and perceptual qualification remain incomplete.
