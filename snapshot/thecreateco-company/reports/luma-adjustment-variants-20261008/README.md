# Luma adjustment variants — recovery checkpoint 2026-10-08

Task CORE-LUMA-ADJUSTMENT-VARIANTS-001; owner director-20261008T1441-luma.
Director actual OpenAI GPT-6.1 Sol; no fallback. Expired lease recovered then claimed
through company CLI. One bounded flagship task; no marketing work or messages.

## Recovery and scope

Prior abandoned checkout retained uncommitted renderer/tests plus public/reference
symlinks showing hundreds of deletions. Never committed those deletions or modified
that checkout. New isolated branch fix/luma-adjustment-checkpoint-20261008T1441
starts at PR8 d18aef51086b50708cb9cb3a33fddc21d792dc58; copied only reviewed renderer
patch, tests and browser renderer harness. Added precise scoped qualification docs.
Normal neutral-BlendIf, one source-over pass, no enabled effects: adjusted opaque RGB
masked then source-atop preserves original coverage. Full-strength fast path retained.

## Actual commands and outcomes

Company startup: `python3 engine/company.py recover`, `refresh`,
`python3 core-product-lab/lab.py next`, claim with unique owner/id and heartbeat.
Required docs read; release matrix is at root RELEASE_MATRIX.md, not release-program/.

In new checkout (Node22 /opt/homebrew/opt/node@22/bin/node):

- `node --import tsx --test tests/*.test.ts`: initial sparse attempt failed25,
  cancelled1,passed1410,skipped10 due absent font/reference assets and resulting
  text geometry differences; no universal regression claimed. Restored tracked
  public/fonts, public/licenses and visual reference fixtures using sparse-checkout;
  rerun **1436 passed,10 skipped,0failed,0cancelled**. Log recovery-engine-restored.log.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit0.
- Scoped strict lint including build harness first failed solely ignored-file warning;
  source-only strict lint and full `node node_modules/eslint/bin/eslint.js .
  --ignore-pattern dist --ignore-pattern .next --max-warnings 0` both exit0.
- `node_modules/.bin/esbuild build/qualify-adjustment-variants.ts --bundle
  --platform=browser --format=iife --global-name=LumaVariants
  --outfile=.../recovery-browser-bundle.js`: exit0. First erroneous attempt invoking
  the native esbuild binary through Node failed SyntaxError; corrected command above.
- `node reports/luma-adjustment-variants-20261008/recovery-run-browser.mjs` from
  company root: Chromium153.0.8010.12,Firefox155.0,WebKit26.6 each24/24;0pageerrors.
  Actual Canvas renderer tests, NOT full application UI or save/reopen checks.
- `node --import tsx .../independent-exhaustive-probe.mjs`: exit0,195840 grayscale
  observations; no alpha failures or >2 premultiplied byte RGB failures.
- `git diff --check`: exit0. Source SHA256 receipt records tested precommit files.
- `gh pr view 8 ...`: OPEN,exact d18aef5,base fix/luma-cpu-export-color-20261007.

## Storage and unverified work

Initial free disk180MiB. A new no-checkout sparse setup accidentally included
tracked live-static large artifacts and failed ENOSPC; removed only this run's
reconstructible partial live-static copies, excluding live-static explicitly.
No prior product assets, user data or other worker output removed. Checkout then
recovered successfully; tracked full public assets remain in Git, not deleted.
Free disk144MiB after restoring required unit fixtures. Full application builds,
rendered-page tests, native tests/packages, performance and exact-head full local
release gates NOT RUN here: insufficient storage budget, not a fabricated pass.
Old PR8 build/native/security receipts are historical, not this candidate's receipts.

Styled, non-normal, multi-pass and non-neutral BlendIf variants unchanged and
unqualified. Clipping/knockout/per-channel, full UI/save/reopen/export, physical
platform, hosted mandatory CI and source/live provenance remain unresolved.
No product completion, merge, deployment or billing retry. No metrics invented.

## Next action

Restore sufficient workspace capacity without deleting user work; qualify exact
candidate production/native build gates and independently test styled/non-normal/
multi-pass/BlendIf alpha semantics. Preserve stacked PR8 and earlier normal gates.
Task remains incomplete with a durable source/evidence checkpoint.

## Reviewed publication / final checkpoint

Independent native OpenAI reviewer approved fourfiles and reran32focusedtests PASS;
see recovery-independent-review.md. Director session_status confirmed
openai/gpt-6.1-sol; no fallback used. Commit8c15f8537c1176b7d4c0076182b7501c92f714b5
is clean, pushed, PR9 OPEN on PR8: https://github.com/armonon/luma-studio/pull/9.
`git add` named only4files, `git commit`, `git push -u origin` and `gh pr create`
with bodyfile all succeeded. No merge/deploy.

Fresh mandatory Actions37795215877 failed all3jobs with0steps. Read-only
`gh api .../actions/runs/37795215877/jobs` and verify check-run annotations
confirm failed account payments/spending limit; no rerun initiated. Evidence:
recovery-pr-state.json,recovery-ci-jobs.json,recovery-ci-annotations.json.
Task checkpoint BLOCKED for insufficient disk for exact-head complete build gates
and hosted mandatory CI unavailable; remaining styled/non-normal scope incomplete.
Product remains ALPHA/unqualified. Next cycle must resume exact-source checkpoint,
not start over or treat prior-head build/native evidence as current.
