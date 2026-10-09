# Company state / queue engine

Python 3 standard library only. The database `engine/company.sqlite3` is authoritative;
`COMPANY_STATE.md`, `PRODUCT_REGISTRY.json`, and `TASK_QUEUE.json` at the company root
are atomic, generated snapshots. Do not edit these exports as inputs.

Run from the company directory (or add `--root /absolute/company/path` **before** the command):

```sh
python3 engine/company.py init
python3 engine/company.py status
python3 engine/company.py refresh
python3 engine/company.py claim --owner company-director --minutes 45
python3 engine/company.py heartbeat TASK-ID --owner company-director --token TOKEN
python3 engine/company.py finish TASK-ID --owner company-director --token TOKEN \
  --status COMPLETE --result 'Checks passed; details in evidence' \
  --evidence evidence/TASK-ID.md --next-action 'Measure impact'
python3 engine/company.py recover
python3 engine/company.py enqueue --file /path/new-task.json
python3 engine/company.py revise --file /path/task-revision.json --reason "Validation evidence reviewed"
python3 engine/company.py update-context --file /path/context-patch.json
python3 engine/company.py update-products --file /path/product-patches.json
python3 engine/test_company.py
```

The claim response contains a generated `lease_token`: pass that exact token to
heartbeat/finish. Tokens are omitted from snapshots and events. Claims and event
appends are SQLite transactions. Concurrent claims cannot acquire the same task.
An expired lease cannot heartbeat or finish, even if its old owner name is reused.
Recovery returns expired tasks to QUEUED; attempt three exhausts the budget and
becomes BLOCKED. Explicit FAILED results use the same bounded retry rule.

Finish statuses: COMPLETE, NEEDS_REVIEW, BLOCKED, FAILED. COMPLETE and NEEDS_REVIEW
require an existing **nonempty evidence file** (relative paths resolve under the
company root). This is an evidence-presence gate, not an independent proof that
the work succeeded. The director/reviewer must inspect evidence. Never mark a
failed/unverified check as completed merely because a report exists.

Only QUEUED tasks whose dependencies are all COMPLETE can be claimed. WAITING
ideas never automatically start. `revise` accepts a JSON patch with `task_id` and
editable planning fields plus a required `--reason` retained in the audit log;
use an explicit status QUEUED after validation/review.
It cannot revise running/completed work, reset attempts, or bypass the exhausted
retry budget. Create a reviewed follow-up task for a materially changed approach.
Example: `{"task_id":"IDEA-001","status":"QUEUED","next_action":"Build validated prototype"}`.
After NEEDS_REVIEW, queue the task with review instructions/evidence, or create an
independent dependent review task; reviewed completion still requires a live claim.

## Inputs and truthfulness

`init` reads `data/products.json` (list), `data/candidates.json` (list), and
`data/context.json` (object). It validates all inputs before transactional changes.
It adds previously unseen products/tasks and initializes context only when no
context exists. **Rerunning init never overwrites existing products, context,
task progress, claims, or audit history.** Omitting a product does not delete it.
Use `revise` to change existing task plans. `refresh` only regenerates snapshots
from persisted state. Seed edits to existing products/context are intentionally
ignored on subsequent init; apply deliberate live changes with
`update-context --file patch.json` for ongoing metrics/strategy, and
`update-products --file patches.json` for product changes. Context updates shallow
merge keys, and merge metrics by metric name; products merge fields by product_id
and preserve unmodified fields. Product input may be one object or a list.
Measured metric updates require source, period, and observed_at; null is permitted
without pretending measurement occurred. Neither command changes task progress.
Example context patch: `{"biggest_bottleneck":"Activation is unmeasured","metrics":{"activations":{"value":null,"source":null,"period":null,"observed_at":null}}}`.
Example product patch: `{"product_id":"autopitch","maturity":"BETA","quality_scores":null}`.

Product JSON fields are preserved, including null scores. Product updates validate
the **complete merged portfolio before any write**. Maturity must be null or one
of IDEA, RESEARCH, PROTOTYPE, ALPHA, BETA, RELEASE_CANDIDATE, PRODUCTION, MATURE,
MAINTENANCE, PAUSED, RETIRED. Kind must be standalone, module, or infrastructure.
Every nonnull `parent_product_id` must exist and the parent graph must be acyclic.
Quality scores/dimensions must be null or 1–10; measured quality requires nonempty
`evidence_sources`, `observed_at`, and `quality_evidence` (a source or field mapping).
A nonnull `active_users` must be a nonnegative integer with `user_metrics_evidence`
containing `source`, `period`, and `observed_at`; measured zero still needs evidence.
Context/product audit events retain the patch and complete before/after values,
so earlier observations remain inspectable after updates.

Task inputs need
`task_id` and `title`; optional fields include `category`, `workstream`, `product`,
`campaign`, `model`, `dependencies`, `scores`, `expected_value`, and `next_action`.
Scores must be null or 0–10. Missing values stay unknown. Priority is an **estimate**:
`impact * user_value * confidence / (effort + risk + 1)`. Unknown components give
null priority. All dependency IDs must exist and cycles are rejected. Significant
new candidates should be supplied with source evidence and estimates, not facts.

Flagship tasks may additionally use `severity` (null or P0–P6), `area`,
`test_requirements`, and `source_evidence`. These planning fields can be revised
with an audit reason while work is not running/completed. Revision never bypasses
leases or retries. `core-product-lab/lab.py next` applies severity-first selection
for the four flagships; the company numeric priority remains a planning estimate.

Context supports `company`, `metrics`, `goals`, `biggest_bottleneck`,
`next_strategic_move`, `blockers`, and `marketing_db`. Each metric should contain
`value`, `source`, `period`, `observed_at`; use null when not measured. The engine
never substitutes campaign counts for company visitors, downloads, or signups,
and does not invent a health score. A supplied `health.score` (0–10) requires
`health.source`, `observed_at`, `rubric`, and `coverage`; otherwise health remains
unknown. Seeds retain their source annotations;
snapshots include the load/observation timestamps.

Marketing SQLite uses `mode=ro` and `query_only`. Reads are limited to aggregate
queue status counts, permitted campaign metadata, aggregate recorded outcome
columns and aggregate model usage. No lead/contact/message tables are read.
Missing outcomes remain null with a recorded-value count, not fabricated zero.
Marketing totals are all-recorded totals with their own timestamp range, not a
claim about this week's company funnel.

## Operational behavior

Each export uses temporary-file + fsync + replace. Export writers are serialized,
but the three files are not one multi-file transaction: consumers needing a
transactional snapshot must read SQLite. If a process dies after database commit
but before exports complete, `refresh` repairs the snapshots. Never infer worker
liveness solely from a cached Markdown file; the queue lease is authoritative.
SQLite WAL supports concurrent readers; transactions wait up to 30 seconds for
another writer. `status` refreshes snapshots but does not itself recover leases;
run `recover` at the start of each director cycle (claim also recovers expired leases).
No publishing, deployment, external messaging, model invocation, or scheduling is
performed by this engine. Routing, policy, and actual work belong to the director.

## Autonomous OS amendment (2026-10-08)

Claims and displayed priorities now use P0–P6 severity before numeric estimates.
The transaction excludes a product while another RUNNING task owns it. Optional
token_budget/tool_budget/context_token_budget positive integer capsule fields are
validated and revisable with audit reasons; leases and attempts are preserved.
An identical FAILED result permits only one automatic retry; the second identical
failure blocks for bounded Sol root-cause review. Generic interrupted-lease recovery
still has the existing three-claim ceiling; this is not a model retry allowance.
Model attempts obey OPERATING_POLICY and the invoked worker/provider caps.
