# Core Product Lab — adopted 2026-10-07

Owner directive: Armon, Discord #creative-council, message 1557540753880784926;
full supplied brief: USER_BRIEF.txt. Mission: artists trust ScenePilot, Luma, Form
and StemDeck with hours of real work. Deepen these four; do not invent new apps.

## First milestone: four golden workflows

- ScenePilot: Import → Edit → Composite/Animate → Audio → Save → Reopen → Export.
- Luma: Import → Edit → Layers/Masks → Save → Reopen → Export.
- Form: Sketch → Model → Refine → Material → Save → Reopen → Export, with consistent
  reliability in Model, Sketch, Fabric and Animation; unsupported is explicit.
- StemDeck: Load → Analyze → Perform → Capture → Arrange → Save → Reopen → Export.
  Replay/parity is tested between Capture and Arrange; decks/waveforms/stems remain
  the primary performance surface, not secondary panels.

SAVE/CLOSE/REOPEN/COMPARE and undo/redo are mandatory. Preserve assets, timing,
layers, geometry, parameters, automation, effects and metadata. No silent loss.
Prioritize P0 data loss/crash/security, P1 broken core workflow, P2 professional
expectation, P3 substantial UX/performance, P4 depth, P5 polish, P6 nice-to-have.
Within severity use impact/workflow/release value, confidence, effort and risk.
All 0–10 planning estimates are explicitly estimates, not measured product quality.
Do not rotate for fairness; justify prolonged concentration with current evidence.

## Scope and approvals

This explicit four-product development request supersedes the older Wave 5
StemDeck implementation exclusion ONLY for scoped Core Product Lab local product
work. It does not reopen unrelated music, Sattari retail/payment, company or growth
work. License clearance, releases, existing reviews/CI and deployment gates remain.
Luma source/live mismatch must be reconciled; never roll back blindly. Form review
and canonical hosts remain distinct. ScenePilot's incomplete site tree must not be
published wholesale. Stable behavior and user work must be preserved.

Authorized: inspect, build, test, dogfood synthetic projects, fix/refactor safely,
improve UX/performance/docs/error handling/onboarding, implement validated roadmap,
benchmark, create internal tools and prepare reviewable release candidates.
No authorization for production deletion, destructive migrations, payments,
ownership/access, legal licensing decisions, unsupported claims, removal of major
functionality, recording physical inputs, arbitrary public posting or gate bypass.
If a task needs external approval/equipment, prepare the concrete result, record
the blocker, and continue other useful authorized work.

## Durable execution

One shared company queue: workstream CORE_PRODUCT_LAB. Reuse/attach existing
company tasks rather than duplicate the same source-baseline or release work.
Every meaningful task records product/area/type/severity, eight planning estimates,
dependencies, model, test requirements, evidence/result and next action. Use engine
statuses QUEUED/RUNNING/WAITING/BLOCKED/NEEDS_REVIEW/COMPLETE/FAILED; WAITING represents
unapproved backlog. Bugs additionally record repro, expected/actual, root cause,
fix and regression coverage. Technical debt is tagged separately from features.

Recover expired leases, refresh, inspect relevant state, claim one highest-value
eligible task, retrieve minimal code, implement, build/test, dogfood where possible,
save exact results, finish/checkpoint with evidence, update product and company
state, refresh lab views. Heartbeat leases during long work. Never restart roadmap
after a crash. Each scheduled cycle is at most 35 minutes and three bounded workers.
Stop when nothing valuable is authorized; stable code does not need churn.

## Evidence and release readiness

Audit all 15 areas: architecture, tests, test run, build, UI, main workflows, open
bugs, TODOs, release status, performance, save/reopen, undo/redo, import/export,
failure recovery and docs. Produce up to ten evidenced candidates each for bugs,
workflow gaps, UX, performance and professional capabilities. Do not pad to 200
or promote inspection hypotheses to confirmed defects. Deduplicate then execute.

Quality dimensions: functionality, reliability, performance, UX, UI, professional
depth, output, save/recovery, import/export, errors, onboarding, accessibility,
docs, differentiation, release readiness. Use null until dated measured rubric
supports a 1–10 score. Never average away unknowns or treat tests as professional
readiness. Record measured benchmarks with source SHA, fixture hash, environment,
command, units, repetitions, comparison baseline and date. A one-off build time
under parallel audit load is not a product-performance benchmark.

Maintain living product specs: audience, vision, supported/unsupported workflows,
architecture, limitations, milestone, release status, bugs, tests and next work.
Golden fixtures cover media formats/rates, layers/masks, precise geometry, stems
and capture; add stress/corrupt/missing files, repeated save/export/undo, recovery
and large projects. Use real creative tasks when rights and equipment allow.
Do not confuse source-reading, synthetic browser QA, human dogfooding, clean-install
tests, physical device checks, or deployed artifact qualification.

Stages ALPHA → BETA → RELEASE_CANDIDATE → PRODUCTION require actual gates: complete
core workflows, persistence, undo/export, no known data loss, supported performance,
critical tests, error handling, docs, clean install/update and supported environments.
Freeze candidates, fix blockers, and respect existing PR/check/release authority.

## Models and review

Owner amendment 2026-10-07, message 1557556492570464297: all reviews use
ChatGPT/OpenAI. Do not use Claude, Sonnet or Opus for reviews or review fallback.
This supersedes the model-review assignments and Claude quotas in USER_BRIEF.txt.
Luna handles routine engineering/tests/docs; GPT-6.1 Sol directs, designs and reviews,
with GPT-6 Sol fallback. Keep major reviews independent through a separate bounded
reviewer/context. Do not claim a different model or completed review that did not run.
Read data/model-routing.json; record actual provider/model, fallback and evidence.
Routine work → tests → done; important work gets targeted Sol review; major/high-risk
changes get Sol architecture + separate OpenAI critique, Luna support and independent
OpenAI audit when warranted. Never route every trivial change through every role.

## Reviews and ecosystem

Daily: regressions, blocked workflows, measured slowdowns, nearest release, weakest
professional path, work to stop, next priority. Weekly: each product's score or
unknown, readiness, up to five blockers/completed improvements, test results,
benchmark change, regressions, next milestone and justified resource allocation.
Keep redacted feedback, benchmark history and cost observations; no contact data.

Meet established professional conventions without blindly copying. Shared menus,
shortcuts, commands, persistence, import/export and visual language should transfer
knowledge without flattening distinct workflows. Reuse infrastructure only when
it demonstrably helps. Cross-app handoffs follow golden reliability, not precede it.

## Routine autonomy amendment — 2026-10-07 17:56 Pacific

Read /Users/agentsattari/thecreateco-company/AUTONOMY.md. Armon explicitly removed personal review
as a routine gate and requested continued upgrades, Git pushes and frequent
#4geeks reports. Follow normal independent OpenAI review and PR/CI gates; do not
wait for Armon solely to approve routine reviewed work. This later amendment
supersedes older local-only/no-push wording within its stated scope.

## OpenAI-only OS amendment — 2026-10-08

Parent OPERATING_POLICY.md now applies: Luna routine executor, Sol director, Astra
only deliberately briefed invention/WOW. Never use active Anthropic fallbacks.
