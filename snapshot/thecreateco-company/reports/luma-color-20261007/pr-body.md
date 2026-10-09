## Summary

Stacked on #6; no merge/deployment or required-check bypass.

- Preserve exact full-resolution 8-bit import/edit samples instead of rendering their quantized linear rgba8 tile derivative. High-depth, tile-only and proxy masters keep the precision path; GPU direct-upload selection follows the same rule.
- Refresh the bitmap on explicit conversion to 8-bit, including clear sparse tiles; preserve Undo/Redo.
- Fix actual browser-save deadlock: the busy overlay covered required download confirmation, and the global save keyboard guard swallowed Tab/Enter/Escape. The dialog is reachable now while editing/reentrant saves remain blocked.
- Add pixel regressions and a real browser PNG/archive/keyboard qualification harness. No mocked save/export and no relaxed color threshold.

## Evidence on clean d4e722330e65a260badc475f53a7a176ccfe7e57

- Node 22.23.2: types, strict lint, full lint, all three build targets pass.
- `npm test`: rendered HTML tests pass; 1,393 engine tests pass, 10 explicitly skipped, zero failures.
- Production `npm audit --omit=dev`: zero findings.
- Real Chrome 154: 15 checks pass, including actual PNG import/download twice, save/download/confirm/close/reopen/export for 2048×1536 gradient, opaque embedded ICC and transparent/partial-alpha PNGs. RGB/alpha error is 0 throughout; fixed gate remains RGB≤2/alpha=0.
- Actual keyboard Tab/Shift+Tab/Enter decline+retry, Escape decline, pointer confirmation pass. Baselines reproduced RGB7, pointer interception and blocked Tab before fixes.
- Independent OpenAI review approved source selection, explicit conversion and confirmation guards after regressions addressed review findings.

Reproducible commands and scope are in `docs/release/raster-color-qualification.md`. Detailed local evidence is retained under company `reports/luma-color-20261007/`.

## Unverified / release gates

This is a tested source repair, not complete product qualification. Native Rust/Tauri/OS dialogs, GPU execution, other browser/platform matrices, broader editing golden workflow and deployed-source provenance remain unverified. Hosted billing/check outage remains external; no workflow rerun requested. Keep PR open until mandatory gates are satisfied.
