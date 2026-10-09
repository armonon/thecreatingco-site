## Summary

Stacked above #7. Three reproduced layered-workflow repairs, independently reviewed with OpenAI:

- Notify UI subscribers for each live opacity/fill-opacity preview without creating extra Undo entries.
- Restore precision surface assets through a bounded stream; correctly account for serial scratch while retaining each independent mutable tile/reference and the unchanged 512 MiB admission ceiling. A real 2048px group/ungroup project previously refused to save despite fitting the actual decoded layout.
- Full-strength normal unmasked/unstyled adjustments replace the adjusted backdrop instead of source-over painting it twice. Real golden output previously increased alpha by up to 60 levels. Tone and curves regressions cover partial alpha. Masked, partial-opacity, styled and non-normal variants are explicitly not qualified by this change.

Adds source-identified real-browser layered qualification and scoped reproduction/limitations documentation.

## Verification

Exact clean source d18aef5; final receipts are maintained in the company report `reports/luma-golden-20261007/`.

- Node 22.23.2: 1,404 engine tests passed, 10 skipped; four rendered HTML checks passed.
- Types, strict and full lint, Vinext/Netlify/desktop builds passed; production npm audit has zero findings.
- Real Chrome 154: 13 layered UI checks passed, including import/group/move/mask/visibility/reorder/tone/history, actual Save/download/verification/Close/Reopen, invalid archive rejection and continued editing.
- Independent fixture composition tolerance remains RGB 2 / alpha 0. Before/reopened and mask Undo/Redo output comparisons are exact.
- Existing isolated Rust 1.99 toolchain: nine native imaging-core and 28 native-bridge tests passed after generating the desktop bundle. This is not packaged runtime qualification.

## Release boundaries

No merge or deployment. Mandatory hosted checks, source/live provenance, full native/platform behavior and the documented remaining golden cases are unresolved. No billing retries or branch-protection bypass. A passing local subset is not product completion. See `docs/release/layered-golden-qualification.md` for remaining scope.
