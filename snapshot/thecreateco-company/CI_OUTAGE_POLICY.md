# Development during GitHub Actions outage — owner amendment, 2026-10-07

Source: Armon's current #4geeks instruction, “JoeyAPP — CONTINUE AUTONOMOUS
DEVELOPMENT DURING GITHUB CI OUTAGE”. This policy supplements the named18 scope;
it does not discard any included product, excluded-product protection or work.

## Immediate priorities and work

Prioritize outstanding ScenePilot PR90, StemDeck PR28, Form PR3 and Luma PR5,
including reviewed follow-up branches that repair their workflows/security.
Finish safe in-flight data-loss checkpoints; continue other independent active
applications when one dependency is blocked. Do not halt development for hosted CI.

Run appropriate local typechecks, lint, unit tests, production builds, security
audits and relevant integration tests. Preserve exact candidate commit, dirty-tree
status/source hashes where relevant, commands, timestamps, exit codes and actual
logs/artifacts. Record skipped/untested platforms distinctly. Reuse valid exact-
source evidence; do not spend tokens or compute on unchanged redundant scans/tests.

Commit and push reviewable feature branches when GitHub is available. If network
access fails, retain local commits and reconcile remote refs before safely retrying
synchronization. Keep PRs open until all mandatory release gates are satisfied.
Armon's 2026-10-09 cross-thread update makes push the default end-of-checkpoint
handoff for every agent-owned review branch, not an approval wait. Use the shared
`/Users/agentsattari/git-handoff/push_branch.py` with the exact tested SHA;
record its verified remote result or the exact push blocker. Never stage unrelated
or untracked files merely to satisfy this handoff.

## Non-negotiable release distinction

Local verification is not GitHub Actions success. A successful independent local
runner does not satisfy a required GitHub status context automatically. Never
fabricate checks, weaken branch protection, bypass review/CI gates, or remove tests.
**Do not merge, deploy or release with unresolved mandatory checks.** Preserve
previously published artifacts; this policy does not require rollback of verified
releases already published. Product completion remains separate from task completion.

Do not repeatedly retry billing-blocked GitHub workflows. Wait for concrete evidence
that account access has changed before one bounded verification attempt. Actual code
or timing failures are not billing failures; diagnose them without weakening limits.
No purchases, billing changes, credential changes or runner registrations inferred.

## Local CI / runner investigation

Audit existing toolchains and project-required versions first. Investigate a safely
isolated self-hosted Actions runner versus the existing independent local CI path.
Prefer existing deterministic gate commands and a reusable source-stamped artifact
receipt over redundant model-driven checks. Do not register a runner, broaden token
permissions, expose this workstation to untrusted PR code, or alter protected checks
as part of feasibility research. Prepare concrete next steps and access requirements.

## Persistence and reports

Use the existing company engine/leases, registry and release matrix. Keep development
blockers separate from release blockers. Continue concise progress reports every
30 minutes in the configured 08:20–22:50 America/Los_Angeles window, via the existing
reporter; no duplicate controller or schedule. Report actual local/pushed/merged/
deployed states, exact verification and genuinely unresolved dependencies.
