# Scheduled commissioning proof — OS-SCHEDULER-PROOF-20261009

Observed: 2026-10-09T06:52:18.299536+00:00
Scheduled job: 2069305d-6f38-41ba-b31c-a0fdbfdc7ea4
Actual run: 583ddb29-6f39-455c-89d4-1fd3949a43fb
Owner: company-director; exact ID claimed through company.py. Lease token not published.

## Actual execution/model
Runtime session_status exposed **openai/gpt-6.1-sol**, execution direct, runtime OpenAI Codex, on 2026-10-09 06:51 UTC. This is real scheduled-run evidence, not inferred from enabled configuration. All work below was deterministic software; no worker/model delegation, Astra, product edits, install, builds, external sends or releases. Source auth/contact details omitted. No PAUSE file present at company or core-product-lab root. Recovery returned no expired leases. OS-INTEGRATION active ownership preserved; no product claimed.

## Checks

- `python3 engine/test_company.py` — exit 0; 2026-10-09T06:51:30.998995+00:00 to 2026-10-09T06:51:31.288050+00:00. Receipt: `queue-tests.json`.
- `openclaw config validate` — exit 0; 2026-10-09T06:51:31.288288+00:00 to 2026-10-09T06:51:34.088077+00:00. Receipt: `config-validate.json`.
- `openclaw agents list --json` — exit 0; 2026-10-09T06:51:34.088495+00:00 to 2026-10-09T06:51:36.385939+00:00. Receipt: `agent-routes.json`.
- `python3 engine/telemetry.py preflight --task-file reports/company-os-20261009/scheduler-proof-task.json` — exit 0; 2026-10-09T06:51:36.386189+00:00 to 2026-10-09T06:51:36.437043+00:00. Receipt: `cost-preflight.json`.

Queue suite: **22 tests PASS**, including concurrent single-winner claims, severity ordering/product exclusivity, stale-owner fencing, recovery/failed retry budgets, dependencies and completion evidence gates. Tests use their own fixtures, not destructive changes to the live queue.
Config validation PASS. Six sanitized agent routes all configured `openai/gpt-6-luna`; historical agent ID `claude` is a name, not provider use. This route listing does not independently expose every fallback chain. Actual scheduler Sol override is verified above; general agent defaults remain Luna.
Cost preflight: continue, advisory-only, critical override. Observations and limits null, coverage partial; no billed cost known and no new spending approved or incurred by a delegated request.

## Fresh storage observation
`Python shutil.disk_usage(/Users/agentsattari/thecreateco-company)` at 2026-10-09T06:51:36.437275+00:00: free **67664506880 bytes (63.02 GiB)**; total 494384795648, used 426720288768 bytes. Exit 0 for receipt-producing Python command. Fresh `host_disk_free_bytes` persisted with source/point-in-time/observed_at through company.py update-context (exit 0).
This replaces a stale capacity observation ONLY. It does not prove product local gates, native workflows, exports, external-volume permissions or release readiness. Existing product disk blockers remain unqualified until exact-source gate rerun. No product task statuses changed.

## Result and next action
Commissioning acceptance checks PASS; COMPLETE applies only to this bounded scheduler proof. Finish using the live owner/token and refresh generated state. Next eligible owner may rerun its exact-source previously capacity-blocked gate; preserve reviews, hosted CI, holds and release qualification. Revenue dashboard refresh is an administrative snapshot, not measured new revenue.
