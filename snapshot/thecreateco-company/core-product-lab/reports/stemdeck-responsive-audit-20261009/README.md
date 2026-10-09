# StemDeck responsive performance workspace audit — 2026-10-09

## Change under review

CSS-only change in `src/styles-studio-session.css`: title/tempo/key metadata use explicit grid rows at narrower laptop/zoom widths, live controls stack at phone widths, and the status notice returns to shell flow so it cannot cover mixer/fader controls. No audio-engine, persistence, or session behavior changed. The patch was isolated from an unrelated legacy site stack onto branch `core-lab/stemdeck-responsive-20261009`, based exactly on PR #28 head `1569ef377f6d3e079936116b1d8e5c4fe7586f48`.

## Evidence

Loaded the existing synthetic four-deck session fixture `four-deck.sattari` (20 embedded audio assets; SHA-256 `594b1e4d38e5cf4e8de561057a212553b2931d48f24dddbeba0da94c4b051871`) in Google Chrome 154.0.8037.99 at 1440×900, 960×900, and 390×900.

- Screenshots: `1440-perform.png`, `960-perform.png`, `390-perform.png`.
- Measured geometry and captured page-error status: `geometry.json`.
- Document width matched each viewport (no horizontal page overflow); all A/B/C/D scene tabs and Auto mix remained available.
- Full fixture deck title was visible at every width (measured title width: 153px at 1440; 131px at 960 and 390, with scroll width equal to client width).
- The status notice is relative-positioned in shell flow. At 390px it begins above the workspace, while deck controls remain within the workspace's scrollable content instead of being covered by the notice.
- Keyboard check at 960px reached a visible Arrange button.
- Post-patch browser page errors: none.

Before the patch, the manual baseline found the deck title compressed to 9px at 960px and 62px at 390px; at 390px the absolute status bar overlapped 26px vertically with the fader/mix region. Patch verification uses the same synthetic fixture.

## Verification and boundaries

- Exact branch head `d178c70038a0df5249978ea39e5e7f4898d03587`: `npm run build` passed; Vite transformed 3,368 modules, prerendered 81 canonical URLs, and generated the service worker.
- `git diff HEAD^ --check`: passed.
- No full test suite or physical-device/audio qualification was run. Audio playback was muted for the visual inspection; no user media was used.
- The app intentionally focuses two decks at a time; all four deck tabs remain available.
- Independent OpenAI/Sol review found no actionable issue.
- Pushed exact head `d178c70038a0df5249978ea39e5e7f4898d03587`; [draft PR #38](https://github.com/armonon/sattari-custom-site/pull/38) is open on top of PR #28. GitHub reported no checks for this new draft at handoff time. It is not merged or deployed; normal PR/CI/release gates remain in force.
