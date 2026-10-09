# Independent code review — TTF maker metadata correction

Reviewed 2026-10-07 PDT in a separate OpenAI reviewer context. Worktree: `/Users/agentsattari/code/worktrees/glyph-ttf-metadata-20261007`; inspected base HEAD and origin/main both `0feefc7785d356f1862f23a96162bfd69f4d872e`.

## Result: PASS for this narrow patch

No blocking findings in the reviewed two-file diff:

- `src/engine/font-export.ts`: replace the maker credit's em dash with an ASCII hyphen and explain why the Macintosh record must remain ASCII.
- `tests/glyph-geometry.test.ts`: independently parse a built TTF with opentype.js; check expected attribution on both Macintosh and Windows platforms, absence of control characters in the fixture's name strings, and equal platform name records.

The source writes Macintosh name bytes using `charCodeAt(0) & 127`. An em dash therefore becomes U+0014, matching the independently observed exported artifact and the before-fix regression. Replacing this one fixed string with ASCII is a proportionate repair for the current name schema: family/style validation in `glyph-model.ts` is already ASCII-only. This does not claim general MacRoman or Unicode-name support.

The regression is meaningful: it tests a serialized font through a separate parser, and `metadata-regression-before.log` shows the baseline failing on the exact corrupted control character. It is not only a check of the implementation's constant. The fix changes metadata only; it does not modify glyph geometry, kerning, licensing terms, price, or saved project schema.

## Verification receipts inspected

- Fresh dependency-install receipt retained by parent.
- Baseline targeted regression: failed as expected, U+0014 versus hyphen.
- Updated `npm test`: **46/46 tests passed**, five files.
- `npm run lint`: exit 0.
- `npm run build`: exit 0; chunk-size and deprecated `inlineDynamicImports` warnings remain in the log, not hidden.
- `git diff --check`: exit 0.

The reviewer inspected logs and the exact diff; no redundant full test rerun was performed. The local checks are appropriate to this limited metadata correction.

## Boundaries and remaining gates

- This is independent code-review approval of the inspected patch, **not authorization to merge/deploy past required CI or release gates**. Preserve PR/check requirements and any current CI-outage policy.
- The already captured native destination fixtures predate this repair. Do not present them as fresh live verification of the repaired build; retain old/new provenance if deployment occurs later.
- The patch does not resolve OTF blank licensing records, cross-format version/weight/PostScript-name differences, or general rights/ownership questions. These are separate from the corrupted TTF maker credit.
- Maker attribution remains the same substantive attribution with punctuation normalized; it is not a newly granted commercial license.
- P08 remains partial/NEEDS_REVIEW with untested Brand Kit and embedded-app scope explicitly retained. No Figma/Adobe/manual GUI/system-install claim is added.

No reviewer code edits, queue changes, push, merge, deployment, or customer contact were performed.
