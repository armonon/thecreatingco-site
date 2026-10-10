# ScenePilot 0.1.16 release campaign

Created: 2026-09-20 PDT

## Verdict

Current status: **internal beta / QA candidate only**. Public release approval is blocked until the external distribution and human acceptance gates below are completed against the exact tested artifact.

## Candidate identity

- Repository: `armonon/scenepilot-studio-badass`
- PR: `https://github.com/armonon/scenepilot-studio-badass/pull/79`
- Candidate branch: `fix/release-today-hardening`
- Base candidate commit: `4f2445cbbedda8ebb8635a12fa2e9929064cd87f`
- Package version: `0.1.16`
- Historical candidate source SHA-256: `a9a71785f94d2e979202f84ff3e09e49dac4ac24bae7d33a5041c5571a838040`
- Current campaign source SHA-256: `9c1babeb9716c8fce7d40cb3cbfe6ffb8ee1dd596e1027bf6b645b3b36550b1c`
- Historical DMG: `release/ScenePilot-0.1.16-arm64.dmg`
- Historical DMG SHA-256: `90f18ab1b88ae050f23751dbaa9df2d0b26ae8caf45a78707b34ec94be0fbead`
- Historical evidence: `outputs/release-today/final-followup/qualification-report.json`, `outputs/release-today/final-package-report.json`
- Current DMG: `release/ScenePilot-0.1.16-arm64.dmg`
- Current DMG SHA-256: `22d54896f23ff862a26956eb8957cead9fcace291fd81f67988b640dceedcb7d`
- Current package report: `outputs/release-now/package-report.json`
- Current qualification report: `outputs/qualification/release-now-stable-20260921T050508Z/qualification-report.json`
- Remote release status: no `v0.1.16` GitHub release exists in `armonon/scenepilot-studio-badass` as of this campaign start.

Local note: the historical `/Users/lillypad/Downloads/scenepilot-studio-0.1.6` checkout is not present on this host. The active local checkout is `/Users/agentsattari/code/sattari/scenepilot-studio-badass`. `gh pr checkout 79` initially applied the PR tree while leaving `HEAD` on `main`; after verifying `git diff` and `git diff --cached` against `origin/fix/release-today-hardening` were empty, the local branch was normalized to `fix/release-today-hardening`.

## Prioritized tasks

1. Preserve and normalize the candidate checkout.
   - Acceptance: worktree matches `4f2445c` plus only this campaign document or intentional follow-up commits; no existing work is reset or discarded.
   - Status: complete for local baseline.
   - Evidence: `git status --short --branch` shows `fix/release-today-hardening` with this document as the only local addition.

2. Re-establish baseline automation on this host.
   - Acceptance: dependency install, `npm run check`, `node --experimental-strip-types --test tests/*.test.mjs`, `npm run build`, `npm run qa:product -- --full`, and `node scripts/certify-package.mjs` are run or precisely blocked with logs.
   - Status: complete for automated gates. Installed keg-only Homebrew Node `v22.23.2`, ran `npm ci` successfully, and reran the full campaign with frozen source.
   - Evidence: `npm ci` added 764 packages with zero vulnerabilities; `npm run check` passed; `npm run build` passed; `npm run test:quick` passed 747/747 after the production build existed; `npm run qa:product -- --full` passed 18 automated gates with 0 failures and 10 perceptual gates pending.

3. Verify packaged Desktop Pro, not just source builds.
   - Acceptance: exact app artifact is source-bound by `scripts/certify-package.mjs`, launches, imports media, saves, quits, reopens, exports, and its output is independently decoded.
   - Status: partially complete for this host. The exact local DMG was rebuilt, package-certified, and launch-smoked for 15 seconds without immediate crash. Full clean-machine import/save/reopen/export remains external.
   - Evidence: `release/ScenePilot-0.1.16-arm64.dmg`; `outputs/release-now/package-report.json`; `outputs/release-now/packaged-launch-smoke.log`; DMG SHA-256 `22d54896f23ff862a26956eb8957cead9fcace291fd81f67988b640dceedcb7d`.

4. Complete three real-project workflows.
   - Acceptance: music edit, dialogue edit, and layered composition each complete import -> edit -> save -> quit -> reopen -> export -> independent output inspection using permission-cleared real media.
   - Status: pending. Existing evidence includes short public/person-footage and generated checks, but not all required 60-90 second music, dialogue, and composition acceptance criteria.
   - Evidence: source hashes, project files, screenshots, export probes, alpha-pixel decode where applicable.

5. Exercise failure and recovery.
   - Acceptance: missing/moved media, relink, export cancel/retry, repeated exports, interrupted save, disk-journal recovery, invalid project files, unsupported codecs, long-session behavior, realistic 4K workload, and isolated disk-pressure behavior are tested without risking the system disk or unrelated apps.
   - Status: automated failure/recovery gates passed on the current source. Manual clean-machine recovery remains external.
   - Evidence: `outputs/qualification/release-now-stable-20260921T050508Z/evidence/release-stress-report.json`, disk-pressure gate logs, linked-media gate logs.

6. Fix only reproduced release-blocking defects.
   - Acceptance: every meaningful defect has reproduction steps, root cause, smallest complete fix, regression test, rebuilt artifact workflow validation, evidence, and a commit.
   - Status: one infrastructure fix applied: Netlify git deploys now use `site/` as the build root, avoiding root desktop/editor dependency installation for static deploy previews.
   - Evidence: `netlify.toml`; automated app qualification passed after the change.

7. Prepare distribution handoff.
   - Acceptance: version consistency, bundled native tools/models, license notices, checksums, release notes, known limitations, support/recovery instructions, upgrade and rollback procedure are source-bound to the tested artifact.
   - Status: partially documented in `docs/release-handoff.md`; external gates remain. The release workflow is configured to fail closed because `docs/release-review.json` is absent until a completed review is supplied.
   - Evidence: package report, release notes, owner-approved license/distribution checklist, `.github/workflows/release-macos.yml`.

8. Resolve hosted PR checks.
   - Acceptance: PR #79 status checks are green or each failure has an owner-approved waiver with logs and impact.
   - Status: local fix prepared but not pushed. Existing hosted checks still show the old failed Netlify deploy preview; Netlify deploy API/logs require credentials not available in this session.
   - Evidence: `gh pr checks 79 --repo armonon/scenepilot-studio-badass`; deploy id `6aaff0408449150008a076d4`; `netlify.toml`.

## External requirements

- Developer ID Application signing certificate and notarization credentials configured securely by the owner.
- Clean macOS 13 Apple Silicon machine and current macOS machine, with no development repo/toolchain dependency.
- Standard non-admin user install path with normal Gatekeeper protections.
- Permission-cleared production-like music, dialogue, and composition/roto media.
- Named human reviewer completion of the ten perceptual acceptance gates with candidate-bound evidence.
- Owner approval before publishing, tagging, merging deployment-triggering changes, purchasing services, accepting licenses, or changing security settings.

## Current known blockers

- No Developer ID/notarized public artifact has been verified.
- No clean-machine/offline/upgrade/rollback matrix has been completed for this host session.
- Ten perceptual acceptance gates remain unsigned.
- PR #79 hosted status is still red until the Netlify config fix is pushed and a new deploy preview runs, or Netlify logs prove another cause.
- No `v0.1.16` GitHub Release exists yet. Do not create a public release until signing/notarization, clean-machine, and human-review gates pass.

## Evidence ledger

| Evidence | Status | Path or command |
| --- | --- | --- |
| Candidate PR state | verified | `gh pr view 79 --repo armonon/scenepilot-studio-badass` |
| Source digest | verified | `node -e "import('./scripts/release-evidence.mjs').then(async m => console.log(await m.releaseSourceDigest(process.cwd())))"` |
| Historical follow-up | read | `docs/release-followup-0.1.16.md` |
| Handoff | read | `docs/release-handoff.md` |
| Qualification process | read | `docs/release-qualification.md`, `scripts/certify-product.mjs` |
| Manual QA checklist | read | `docs/manual-qa-checklist.md` |
| Package certification script | read | `scripts/certify-package.mjs` |
| Current package artifact | built | `release/ScenePilot-0.1.16-arm64.dmg` |
| Clean dependency install | passed | Node `v22.23.2`, npm `10.9.8`, `npm ci` -> 764 packages, 0 vulnerabilities |
| Dependency-free regression subset | passed | `node --experimental-strip-types --test tests/release-evidence.test.mjs tests/qualification-process.test.mjs tests/render-media.test.mjs tests/release-persistence.test.mjs` -> 13 pass |
| Full regression suite | passed | `npm run build && npm run test:quick` -> 747 pass |
| Full automated qualification | pending human review | `outputs/qualification/release-now-stable-20260921T050508Z/qualification-report.json` -> 18 automated pass, 0 failed, 10 perceptual pending |
| Package certification | passed for internal artifact | `outputs/release-now/package-report.json`; Developer ID/Gatekeeper false |
| Packaged launch smoke | passed | `outputs/release-now/packaged-launch-smoke.log`; app stayed alive for 15s |
| Public signing guard | blocked by design | `node scripts/require-release-signing.mjs` -> missing Developer ID Application identity |
| PR hosted checks | failed | `gh pr checks 79 --repo armonon/scenepilot-studio-badass`; Netlify deploy `6aaff0408449150008a076d4` |
| Netlify deploy logs | blocked | Netlify API returned HTTP 401 for unauthenticated deploy lookup |
| Remote 0.1.16 release | absent | `gh release view v0.1.16 --repo armonon/scenepilot-studio-badass` -> `release not found` |
| Release workflow review gate | fail-closed by design | `.github/workflows/release-macos.yml` expects `docs/release-review.json`; file is absent |
