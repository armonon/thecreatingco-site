## Changes
- Restore mandatory standalone Luma/Form mesh contract validation using real Form source pinned to reviewed commit b5abdd1, with repository/path/hash provenance. Missing, corrupted or mismatched fixture fails; explicit `LUMA_FORM_CONTRACT_SOURCE` also checks an actual current checkout and never silently skips missing source.
- Use unoptimized Next Image for the browser-local upscale preview, preserving dimensions and local data URL; no global lint suppression.

## Verification
- Node22 clean npm ci, tsc, zero-warning app/tests ESLint: pass.
- npm test: build + rendered4 pass; 1,374 engine tests pass, 10 explicitly skipped, zero failed.
- Contract tests against pinned actual Form and explicit current Form checkout: 6/6 pass; mismatch/missing source negative cases included.
- Netlify/Next and desktop bundle builds pass.
- Separate OpenAI review verified actual Form source byte equality and narrow repair; no blocking findings.

## Scope / release status
Stacked onto security PR5 (`fix/luma-production-security-20261007`), not an independent qualification of the older PR stack. No merge/deployment or gate bypass. GitHub Actions has an existing account payments/spending execution blocker; restore normal checks before landing.
Full golden workflow/native/deployed qualification remains incomplete. Separate retained synthetic browser evidence observes original imported bitmap versus CPU PNG export RGB discrepancy (max7, alpha exact) and a save-download harness timeout; these are follow-ups, not passes. The exploratory harness is not included in this PR.
