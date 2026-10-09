# Company implementation — 2026-10-07

## Delivered foundation

The company director now sits above the existing marketing department. It uses
one durable SQLite source of truth with COMPANY_STATE.md, PRODUCT_REGISTRY.json
and TASK_QUEUE.json exports. Marketing receives compact company context and its
existing scheduled batch refreshes the company dashboard; CRM and send controls
are unchanged.

Initial local-source inventory: 44 entries (13 standalone families, 27 modules,
4 infrastructure entries). This is an inventory, not a claim that 44 products
are production-qualified. Ten historically public-alpha families, source-only
prototypes and the native audio suite have different evidence and release states.
See initial-portfolio-audit.md and per-entry sources for exact limitations.

Initial backlog: 45 scored decision candidates — 10 product, 10 website/growth,
10 marketing, 5 operations, 10 ideas. Ideas are WAITING for validation. Scores
are estimates, never measured ROI. No numerical company health score, traffic,
downloads, signup, retention or revenue metrics were invented.

## Model proof

`openclaw infer model run --model openai/gpt-6.1-sol --prompt
'Reply only COMPANY_DIRECTOR_OK' --thinking low --json` succeeded on 2026-10-07,
provider=openai, model=gpt-6.1-sol, transport=local, output COMPANY_DIRECTOR_OK.
Official model reference fetched: https://developers.openai.com/api/docs/models/gpt-6.1-sol
This proves that local inference route, not every department/model combination.
Scheduled director execution has a separate verification receipt below when run.

## Schedules (America/Los_Angeles)

- Hourly, minute 10: company director, `2069305d-6f38-41ba-b31c-a0fdbfdc7ea4`.
- Monday 08:20: weekly CEO review, `4a64dc91-9804-48aa-81b8-59cbc9b2cc6f`.
- First of month 08:30: portfolio review, `97cc83fa-1512-4b26-8bc3-0f80052740cc`.

All were created enabled, isolated, GPT-6.1 Sol with GPT-6 Sol fallback, delivery
mode none. Company jobs write local reports and do not send messages or deploy.
Schedules alone are not evidence that their work has run successfully.
PAUSE stops future company cycles. Disable IDs using `openclaw cron disable ID`.
Existing marketing launchd worker at :40 and pre-existing daily/inbox jobs remain.

## Verification status

- Marketing: 20 tests passed, including the new bounded-company-context and
  missing-company-file behavior tests; existing routing/contact/recovery passed.
- Company: initial 14 tests passed; independent review then required fixes to
  reinitialization, product validation, historical observation retention and
  recent-results display. Final results are appended after those fixes.
- Corrected test invocation is `python3 engine/test_company.py`; an earlier
  unittest directory-discovery attempt failed because tests are a single file,
  not an `engine/tests` package. It did not exercise or modify production state.

## Known limits / next work

Audit primarily inspected dated local artifacts, not every live product flow.
The current company bottleneck is an operational assessment, not measured funnel
drop-off. Netlify Web Analytics is documented enabled, but its actual KPI values
have not been retrieved. Marketing outcomes have no recorded values in the
initial read-only snapshot. Luma release/source drift and Librarian's reader
failure need fresh verification. Preserve the prior music-work hold.

No product deployment, external outreach, paid spend or GitHub push was performed
by this implementation. Source code and files are local in the workspace.

## Final foundation verification

2026-10-07T23:43:16+00:00: 19 company tests passed after review fixes. Marketing 20 tests passed. Shell syntax and git diff whitespace checks passed. All three job definitions re-read: enabled, GPT-6.1 Sol, no delivery. Reinitialization preserves current state; quality/metric updates require evidence; observation history is retained.

## Automation-model correction

2026-10-07T23:44:43.711805+00:00: First two scheduled probes failed preflight because GPT-6.1 Sol was absent from agents.defaults.modelPolicy.allow. Direct inference had succeeded but did not exercise that guard. Added only openai/gpt-6.1-sol via validated OpenClaw config CLI (dry-run then compare-and-set), preserving other entries and default model. Hot reload, no restart or credential change. An initial config dry-run used incompatible conditional-expectation flags and was rejected without writing; corrected before applying. Third scheduled probe is the actual execution check.

First scheduled execution progressed beyond model preflight: W06 was claimed RUNNING at 2026-10-07T23:44:29+00:00 by director-20261007T2344-W06. Its result is not assumed complete. Canonical task-product references verified and lease tokens absent from exports.

## Successful scheduled end-to-end proof

Third run completed successfully: GPT-6.1 Sol / OpenAI, 152419 ms, no delivery. W06 claimed, verified seven public release/page fetches, checked Reclaim DMG bytes/checksum, corrected internal download/analytics claims, updated the product registry and finished COMPLETE with a dated report. Company 19 and marketing 20 checks passed in that cycle. See reports/2026-10-07-W06/report.md and automation/first-run-receipt.json. Numeric analytics and native application qualification remain unknown.
