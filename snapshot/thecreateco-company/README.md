# thecreateco company director

**Start here:** [COMPANY_STATE.md](COMPANY_STATE.md). It is generated, compact and
shared across the company director and the existing marketing department.

- [PRODUCT_REGISTRY.json](PRODUCT_REGISTRY.json): products/modules/infrastructure,
  maturity, sources, quality gaps and next milestones. Unknown scores stay null.
- [TASK_QUEUE.json](TASK_QUEUE.json): durable, scored candidates, ownership,
  dependencies, results, evidence and next actions.
- [DIRECTIVE.md](DIRECTIVE.md): company-level operating model and autonomy limits.
- [engine/README.md](engine/README.md): queue/lease/recovery and update commands.
- [reports/initial-portfolio-audit.md](reports/initial-portfolio-audit.md): dated
  local-source audit; it is not proof every product was tested live.
- [data/model-routing.json](data/model-routing.json): director/departments and budgets.
- [USER_BRIEF.txt](USER_BRIEF.txt): original requested design brief.

## Persistence and updates

SQLite `engine/company.sqlite3` is authoritative. JSON/Markdown exports use atomic
replacement. A claimed task gets an owner and unexported fencing token; an expired
worker cannot finish a reclaimed task. Recovering does not restart the company or
repeat completed tasks. Repeated failures exhaust a bounded attempt budget.

Run `python3 engine/company.py refresh` to render current state. See engine help
for context/product updates; do not edit generated exports by hand. Seed files
are initial input; do not blindly regenerate/reimport them over live decisions.
Health and adoption metrics remain unknown until measured with source and period.

## Scheduling

OpenClaw runs an hourly bounded GPT-6.1 Sol director cycle plus weekly CEO and
monthly portfolio reviews. Exact IDs, timing and verification are recorded in
`reports/implementation-verification.md` and `automation/jobs.json` after setup.
These jobs write local results; they do not send posts/emails or deploy products.
Place `PAUSE` in this folder to stop future company cycles; remove it to resume.
It does not cancel already-running work or pause the separate marketing worker.

The existing marketing launchd worker remains at minute :40. Its prompts receive
company context; each scheduled batch refreshes company state. Its existing CRM,
opt-out, review, model routing and contact controls remain in place. Its older
daily and inbox OpenClaw jobs retain their existing scope, not new authority.

## Initial priorities

The initial 45 candidates include 10 product, 10 website/growth, 10 marketing,
5 operations, and 10 idea-validation items. Scores are explicit estimates, not
measured ROI. Ideas start WAITING, not queued for development. Prioritize reliable
release/source evidence, factual product claims and measurement before broadening
acquisition. Preserve known per-product execution holds.

## Verification / rollback

`python3 engine/test_company.py` exercises queue recovery and
evidence controls without provider calls. Marketing retains its separate tests.
Disable the new job IDs with `openclaw cron disable ID` to stop scheduling.
The marketing changes are a company-context prompt block, directive pointer,
post-tick refresh and corrected scheduler documentation; no CRM migration was
performed. Keep the SQLite DB plus reports if reverting the integration.
