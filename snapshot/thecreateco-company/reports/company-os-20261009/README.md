# Autonomous Company OS implementation — 2026-10-08/09

Owner request: Armon's full 68-section brief and explicit “implement it”.
Canonical policy: ../../OPERATING_POLICY.md. Original attachment is retained as
../../AUTONOMOUS_COMPANY_OS_USER_BRIEF.txt. Company SQLite queue remains authoritative.
This is an incremental integration, not a replacement company/marketing database.

## Implemented

- Runtime default and all six configured agent routes now OpenAI GPT-6 Luna, no
  inherited Anthropic fallback. Model allowlist is OpenAI-only and admits Sol/Astra.
  Company director/weekly strategy explicitly Sol; routine lab/marketing/reporting
  Luna. Dormant provider credentials/history/catalog preserved, not active routes.
- Marketing active provider adapter/chains OpenAI-only. Routine creative plans
  cannot self-promote to Astra. Missing model prices now null, never known zero.
- One severity-first P0–P6 queue, transactional per-product exclusion, product and
  task holds enforced, existing claims/history preserved. Capsule budget fields
  validated, one identical failure retry, economy preflight before eligible claims.
- Reused failed legacy autonomy schedule as no-model collection/recovery/anomaly/
  dashboard tick; it no longer competes for product priorities. Radar loops defer
  company work to company queue. Daily random-app generator disabled, history kept.
- Idempotent cost ledger from sanitized scheduled-run receipts and marketing calls;
  source-specific totals, cache accounting, evidence coverage, null billed costs.
  Configurable day/week/agent/product/task/Astra budgets; all limits unset rather
  than fabricated. Explicit economy defers low-value work, not critical work.
  Deterministic anomalies create deduplicated optimization tasks via existing CLI.
- Existing one operations-supervisor extended with cached cost/coverage, no new
  observer fleet. Daily CEO schedule added; existing hourly/critical/weekly retained.
- Evidence dashboard OS_DASHBOARD.md/json, initial public-site/repo/source audit,
  one deliberate Astra brief, independent Sol selection, one bounded Luna ENCORE
  capsule WAITING on existing qualification tasks. No product or customer result
  claimed from a creative brief. Structured cycle evidence: data/astra-cycles.json.

## Scheduling and ownership

- Sol director: `2069305d-6f38-41ba-b31c-a0fdbfdc7ea4`, minute10 hourly.
- No-model controller: `2ca9d380-38ab-44bc-9d94-41f01374b11a`, minute22 hourly.
- Luna flagship cycle: `b98880fe-a5a5-410f-a7ca-7366239125d8`, minute40 every2hours.
- Luna supervisor: `8e672418-022e-4294-a77e-eb9fcaef28e8`, minute7 hourly.
- No-model critical watch: `8e440556-6ef7-4099-aa9c-93a4175cc61a`, every5minutes.
- Luna daily CEO: `387166db-ad22-42de-8884-51c97a9d0a6e`,18:05 Pacific,#4geeks.
- Sol company weekly: `4a64dc91-9804-48aa-81b8-59cbc9b2cc6f`,Monday08:20 Pacific.
Existing company progress destination/quiet-hour policies and department gates remain.

Pause new company/lab work with `thecreateco-company/PAUSE`; this does not disable
critical monitoring/reporting. Stop a particular schedule using
`openclaw automations disable ID`. Re-enable with `enable ID` after its cause is fixed.
No restart, credentials rotation, production deletion, merge or deployment performed.

## Execution evidence and limits

Director commissioning genuinely completed on OpenAI GPT-6.1 Sol, actual run
`583ddb29-6f39-455c-89d4-1fd3949a43fb`; task OS-SCHEDULER-PROOF-20261009 COMPLETE.
See scheduled-proof.md and director-live-run.json:22 queue tests at that time,
config validation, six route checks, fresh disk observation, persisted metric.
Subsequent regression additions are recorded separately; do not rewrite old counts.

Telemetry live repeat preserved171 distinct records:149 model-bearing scheduled
runs +22 marketing calls. No source truncation. These are NOT171 global model
calls. Scheduled counts can aggregate calls and overlap marketing; billed costs,
interactive/native-child per-call costs and attribution remain unknown.
Budget caps are configurable but unset; telemetry/governor is not a billing limit.

Initial audit tested public HTTP/markup and local/source metadata, not every full
product workflow. All four flagship full golden workflows remain unqualified.
Fresh capacity ~63GiB removes the historical storage shortage observation, not
any exact-source test/release gate. Mandatory hosted CI and platform/source-live
qualification remain with their existing owners. No automatic scope reopening.

Independent scoped review caught/fixed automatic Astra promotion and unknown-cost
zero handling. See independent-review.md for probes, final approvals and exclusions.
Future daily/weekly schedules are configured, not claimed already executed.
See controller-live-run.json for the separate deterministic controller proof once
recorded; latest final-verification.json captures exact final local check results.

## Final completion

Both formerly disabled controllers are enabled and genuinely succeeded: Sol director
proof above, and no-model controller manual run at07:03:17Z (2.960s, all five steps
PASS, no model/provider usage field). Controller generated the dashboard and live
HTTP200 probe.

Final verification: **89 tests PASS** (company24, telemetry16, OS-cycle7, anomaly3,
marketing26, supervisor13), plus OpenClaw config validation. Independent scoped
OpenAI review approved routing/queue and corrected cost handling.

Fresh storage evidence justified requeuing FOUR existing tasks, preserving attempt
counts and IDs: CORE-STEM-ARCHIVE-WEBKIT-001, CORE-SP-PERF-001,
CORE-LUMA-ADJUSTMENT-VARIANTS-001, CORE-FORM-WORKER-IMAGE-BINDING-001. Their first
action is unchanged exact-source preflight, not a claim of passed product gates.
No new duplicate repair tasks or releases were created. See resumed-existing-tasks.json.
