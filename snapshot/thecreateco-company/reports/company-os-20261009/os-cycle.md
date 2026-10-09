# Deterministic company OS cycle helper

Added `engine/os_cycle.py` with `tick`, `dashboard`, and `daily` commands. It uses only Python standard-library code, invokes no model, sends no messages, and does not edit queue/product databases directly. The queue engine remains authoritative.

## Commands

Run from the company root:

```sh
python3 engine/os_cycle.py tick
python3 engine/os_cycle.py dashboard
python3 engine/os_cycle.py daily
```

`tick` exits early when either company or Core Product Lab `PAUSE` exists. An OS-cycle `flock` lock prevents overlapping ticks; overlap returns `overlap_skipped`. In order, it invokes existing `company.py recover`, `company.py refresh`, bounded `telemetry.py collect`, `anomalies.py` sync only after successful collection, and `core-product-lab/lab.py refresh`; then it probes only configured HTTPS critical URLs and atomically writes generated `OS_DASHBOARD.json` and `OS_DASHBOARD.md`. Any telemetry/anomaly/lab failure is reported as `partial` and the CLI exits nonzero; company recover/refresh failure is `failed`. Telemetry collection failure is recorded and does not erase an older cost snapshot.

`dashboard` renders the generated dashboard from current exports and the existing `data/cost-snapshot.json`; it does not collect telemetry or probe the network. `daily` reads the cached queue/context/dashboard and prints a concise 24-hour rollup; it does not mutate state. Context is read from the company database in read-only mode when available because `data/context.json` is initialization input, not ongoing truth.

## Data safeguards

- Uses canonical `company.eligible_tasks(tasks, products)` for next-task severity, dependency, active-product-exclusivity and product/task execution-hold rules; does not override shared queue order.
- Product readiness, maturity, quality, golden-workflow state and next milestones are copied from current product records, with `HEALTH.md` fallback. Null scores and unknown metrics remain null/unknown.
- Revenue retains its source/period/observation metadata. No estimate or dashboard score is substituted.
- Supervisor data is read-only and aggregated to status counts/latest report time; task text and heartbeat details are not copied. Marketing tasks are omitted from named daily completions, and contact-shaped fields are redacted from dashboard task summaries.
- Cost snapshot is passed through without inventing a schema; known daily list-estimate/billed fields are shown only if present. Astra ledger/value fields are surfaced only when the telemetry snapshot contains them.
- Deliberate Astra cycle records in `data/astra-cycles.json` are shown separately from historical Astra telemetry and retain unknown usage/value fields as unknown.
- Website checks are bounded GETs to up to five configured HTTPS critical URLs. They record response status/time only, never body content. A successful homepage response is not a conversion or workflow qualification.

## Verification

`python3 engine/test_os_cycle.py` covers pause, overlap, null health/revenue preservation, Astra snapshot passthrough, contact exclusion, queue non-mutation, no blocked-task success claim, canonical task eligibility, and the bounded tick command sequence. No build or product work is performed by these checks.
