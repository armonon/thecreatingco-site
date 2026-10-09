# Company OS telemetry/governor — 2026-10-09

## Implemented

- `engine/telemetry.py`: deterministic, no-model collector; WAL SQLite ledger at
  `engine/telemetry.sqlite3`; atomic `data/cost-snapshot.json`; cached read-only
  snapshot API; advisory task preflight; append-only evidence-backed downstream
  value records. Does not mutate company queue, message users, or change routing.
- `data/cost-policy.json`: calendar-day/Monday-week budgets for all usage,
  agent/product/task/Astra scopes. Supported metrics: source list estimate,
  explicitly exposed billed USD, total tokens, receipt records. Every default
  cap is **null**; no model prices or monetary ceilings were invented.
- Economy mode is configured or triggered by an exceeded configured cap. It
  advises deferral only for explicitly `low_value=true` work, never unknown value.
  `critical=true` or P0/P1 overrides deferral. Critical work is never stopped.
- Anomalies: repeated failures, missing Astra escalation reasons, configured
  budget exceedances. Queue creation belongs to the company integration, not
  this separate ledger. No unexplained price/spend spike thresholds invented.
- Operations Supervisor reads the existing sanitized snapshot only; no duplicate
  collector. Scheduled receipts are labeled receipts, not model-call counts;
  missing tokens print unknown with known-receipt coverage.

## Sources and privacy

1. OpenClaw `cron list` agent mapping and paginated `cron runs --all --sort desc`.
   Default 200/page, at most 10 pages; hard bounds 200/page and 20 pages. Only
   model-bearing/usage-bearing receipts enter the AI ledger. Exec-only receipts
   are not counted as model calls. Only allowlisted model/usage/status/timestamp,
   safe IDs/reason codes persist; summaries, errors, diagnostics, prompts and
   delivery/contact data do not. Each scheduled run can contain many model calls.
2. Marketing `model_calls`, opened read-only with `query_only=ON`. Explicit safe
   SELECT of id, ts, day, model, provider, task_id, reasoning, ok, input/output/
   cache tokens, est_cost, latency_ms, tokens_estimated. No `leads`, CRM, messages,
   results/prompt contents or prompt-size columns are read. Default last35 days,
   hard bounded366 days and10,000 calls; source status flags truncation.

Unknown remains null; measured zero remains zero. Marketing `est_cost` is only
a source-reported estimate, **not billed spend** or independently verified list
pricing. The source can estimate tokens; legacy missing-price/failed-call zeros
are normalized to null unless a successful call has explicitly non-estimated
zero input/output/cache tokens. Per-record `estimate_basis` records that decision.
No prices are inferred from model names.

OpenClaw exposes `cache_read_tokens` and some explicit `total_tokens` totals;
those totals include separate cache reads in observed receipts. Preserve source
totals and cache counts; do not subtract caches from input indiscriminately.
Derived totals are marked `derived_input_plus_output`; explicit totals are marked
`source_reported_total`. Scheduled latency is end-to-end run duration, not pure
inference latency. Cross-source overlap is unreconciled, so combined receipt sums
must not be presented as total company spend or billed charges.

## Live proof

- First collection at `2026-10-09T06:53:03.686239+00:00`: 392 visible cron receipts,
  149 model-bearing scheduled records, 22 marketing per-call records.
- Repeat at `2026-10-09T06:55:04.054857+00:00`: 393 visible cron receipts, still
  **171 ledger rows /171 distinct IDs**, same149+22 source split. Extra exec-only
  receipt did not inflate AI calls. Both sources available, neither truncated.
- Repeat weekly observed receipt totals: cached tokens88,226,862, known167/171
  rows; source/derived total tokens95,799,284, known168/171 rows. These are
  source-accounting receipt sums, not billed input or verified per-call totals.
- Weekly marketing source estimate `$0.3640798`, known22/171 receipt rows;
  billed USD **null**, known0/171. Never report that partial estimate as total AI
  spend. Historical models remain factual records, not new routing assignments.
- Astra40 scheduled receipt records; downstream value unknown40; no automatic
  ROI inferred from `status=ok`. Today's repeated-failure anomaly14 receipts.
- Live preflight for a critical low-value Astra candidate: `continue`, normal
  advisory mode, critical override true, escalation reason unrecorded. This
  deterministic check invoked no model. Evidence: `telemetry-preflight.json`.
- A debugging probe requesting500 cron rows was rejected by the gateway's
  max200 constraint. Corrected collector's hard clamp to200; tested it. This was
  an API-parameter failure, not a model/collection billing event.

Snapshots: `telemetry-live-first.json`, `telemetry-live-repeat.json`. The latter
is the refined cache-preserving source proof. Source freshness is explicit.

## Verification

- `python3 engine/test_telemetry.py` — **16 tests PASS**, local. Log:
  `telemetry-tests.log`. Covers null/zero, cost basis, idempotence, source
  allowlisting, separate cache reads, critical overrides, task attribution,
  calendar/DST windows, bounded/truncated cron reads, failure anomalies, source
  outages, safe marketing per-call selection, invalid caps, missing snapshots,
  and evidence-backed Astra downstream value.
- In `/Users/agentsattari/thecreateco-marketing/engine`:
  `python3 -m unittest tests.test_engine tests.test_company_context
  tests.test_price_evidence` — **26 tests PASS**, local, including existing24
  plus2 focused missing-rate/configured-zero regressions. Log:
  `marketing-price-tests.log`.
- In `/Users/agentsattari/operations-supervisor`:
  `python3 -m unittest discover -s tests` — **13 tests PASS**, local. Log:
  `supervisor-tests.log`. Includes source estimate/not-billed reporting and
  unknown scheduled tokens/not-fake-call-count coverage.

No release, external messaging, provider-model request, pricing change or
automation mutation was performed by this telemetry task.

## Independent-review correction

Independent Sol review identified that legacy marketing `price()` returned0 for
unknown model rates, including the current GPT-6.1 Sol route. A source caveat was
insufficient because telemetry counted that zero as known. Corrected:

- Company collector treats ambiguous zero as null. Successful non-estimated
  zero-token evidence still preserves genuine zero; failed or estimated-token
  zero does not. A regression covers all four cases and known-row denominators.
- Marketing `mktg/providers.py` now returns `None` for a missing price instead of0.
  `model_calls.est_cost` permits SQL NULL; sole caller `record_call` and existing
  SQL aggregation paths tolerate it. No rate was added/changed. Historical rows
  are still normalized by the collector, not rewritten in the marketing DB.
- Bounded live refresh at `2026-10-09T07:00:30.722028+00:00` preserved171 distinct
  ledger rows. Its22 historical marketing rows all have positive estimates, so
  the weekly observed estimate remains `$0.3640798` /22 known rows; billed null.
  Evidence: `telemetry-live-reviewed.json`. Missing-price cases are covered by
  controlled no-network fixtures, not falsely claimed present in these22 rows.
- Existing marketing summary functions still use legacy COALESCE aggregation;
  this task does not present those outputs as complete company spend. Company
  telemetry retains its own explicit known-row coverage and null handling.

## Integration/API

```python
import telemetry
snapshot = telemetry.compact_snapshot(company_root)  # cached, read-only
advice = telemetry.preflight(company_root, {
    "task_id": "TASK-ID", "owner": "worker-id", "product": "product-id",
    "model": "gpt-6.1-sol", "low_value": False, "critical": False,
    "severity": "P2"
})
```

`decision` is `continue` or `defer_low_value`; `advisory_only` is always true.
Legacy/synthetic company roots without cost policy should treat this integration
as unavailable/advisory, not reject otherwise safe queue claims.

CLI: `python3 engine/telemetry.py collect`, `snapshot`,
`preflight --task-file task.json`, and
`record-value RECEIPT-ID --classification positive|neutral|negative|unknown
--evidence relative/company-file.md`. Outcomes require an existing evidence
file and known receipt; revisions append history, refreshes preserve outcomes.

## Remaining coverage gaps

Native-child/interactive per-call usage is not exposed by the cron receipt API.
No raw session transcripts were read to manufacture it. Scheduled model
receipts often lack task/product, reasoning, escalation reason, pure inference
latency and billed cost. Marketing calls lack product/escalation/value fields.
No source exposed complete reconciled billing, so every billed total stays null.
Task/product budget attribution remains partial when sources omit those IDs.
Downstream value must be recorded after actual evidenced outcomes, not predicted.
