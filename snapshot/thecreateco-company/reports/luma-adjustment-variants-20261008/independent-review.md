# Independent review — 2026-10-08

Task: CORE-LUMA-ADJUSTMENT-VARIANTS-001. Reviewer: independent OpenAI/Sol context; no Claude fallback. Candidate worktree: `/Users/agentsattari/code/company-worktrees/luma-adjustment-variants-20261008`. Base: `d18aef51086b50708cb9cb3a33fddc21d792dc58`.

## Verdict

Approve the narrow normal-only renderer fix, conditional on passing revised scoped tests with exact backdrop alpha and documented precision tolerance. This is not approval of styled/non-normal adjustment behavior, product completion, release, or deployment.

Inspected `app/engine/renderer.ts` and `tests/adjustment-variants-alpha.test.ts`. The opaque adjusted-RGB scratch followed by raster/vector masks and source-atop avoids counting backdrop alpha twice. Source `s.b`, target `s.layerBuf`, and destination composite are distinct. Master/fill/pass opacity is multiplied once. The existing unmasked full-strength copy path is retained. Transparent destination pixels cannot acquire coverage through source-atop. No source edits or pushes were made by this reviewer.

## Actual inspection and reproduction commands

Run in the candidate worktree:

```sh
git diff -- app/engine/renderer.ts
cat tests/adjustment-variants-alpha.test.ts
sed -n '1020,1300p' app/engine/renderer.ts
sed -n '155,185p' app/engine/renderer.ts
sed -n '485,555p' app/engine/renderer.ts
sed -n '570,725p' app/engine/renderer.ts
cat tests/canvas-harness.ts
/opt/homebrew/opt/node@22/bin/node --import tsx /Users/agentsattari/thecreateco-company/reports/luma-adjustment-variants-20261008/independent-exhaustive-probe.mjs
```

The exhaustive probe was originally executed as inline Node/tsx code and is persisted alongside this review in equivalent reusable form. It renders all 256 grayscale values at all 255 nonzero alpha values under an invert adjustment with alpha-128 mask, separately at master opacity .25, .5, and 1: 65,280 pixels per run, 195,840 total observations. All three RGB channels are identical by construction, not independent color-space samples.

| Master opacity | Exact alpha failures | Proposed straight-RGB tolerance failures | Maximum premultiplied byte error | Errors above 2 premultiplied bytes |
| --- | ---: | ---: | ---: | ---: |
| .25 | 0 | 38 | 1.7014994232987353 | 0 |
| .5 | 0 | 6 | 1.583391003460212 | 0 |
| 1 | 0 | 0 | 1.350865051903116 | 0 |

`ceil(255/(2*alphaByte))+1` accommodates the original fixed fixtures but is not a universal analytical bound through this pipeline's repeated canvas quantization. Example: alpha140, original220, master opacity.25, mask128 produced199 against ideal196.78431372549022, exceeding proposed straight tolerance2. Compare RGB in premultiplied units, `abs(actual - expected) * alphaByte / 255 <= 2`, while asserting exact alpha. This is a documented multi-stage precision allowance supported by the probe, not a mathematical proof for every backend/input/adjustment.

## Remaining scope and limitations

- Candidate applies only to neutral BlendIf, one enabled source-over pass, no enabled layer styles. Styled, non-normal, multi-pass, and non-neutral BlendIf paths remain unchanged/unqualified.
- Adjustment clipping, knockout, and per-channel restrictions were not handled by compositeAdjustment before this patch and remain unestablished. Do not imply this change validates them.
- Existing mask projection functions are reused. The new fixed regression fixtures cover raster masks, not an independent vector-mask/pass-opacity golden test.
- An additional frame-sized pixel read/write is introduced outside the retained fast path. Performance was not benchmarked.
- Reviewer probes used the existing Node22 / @napi-rs/canvas harness. No fresh production build or browser qualification was performed by this reviewer. Parent-reported disk/sparse-checkout limitations are not evidence of browser behavior.

Next action: run revised scoped tests and parent-owned broader engine/browser checks; commit/push only through normal project gates, keeping residual qualification scope explicit.
