# Independent Sol review — bounded queue / marketing routing changes

2026-10-09 UTC. Separate reviewer context; no production edits, live queue changes,
external sends, actual model requests or additional agents. Read company engine
diff against reports/company-os-20261009/baseline/engine/company.py and marketing
git diff/current router/providers/engine/config/tests; read OPERATING_POLICY.md
boundaries. Telemetry and os_cycle explicitly excluded while in progress.

## Verdict

**Company queue: APPROVE scoped changes. Marketing routing: CHANGES REQUIRED**
for one concrete Astra escalation blocker below. No other concrete introduced
blocking defect found in reviewed scope. Passing tests do not validate policies
their assertions encode incorrectly.

## Blocking finding — routine plans can summon multiple Astra tasks

Marketing engine/mktg/router.py promotes campaign_concept to astra solely on
importance >=3 and creativity >=3. engine/mktg/engine.py::_spawn_from_plan accepts
those fields from routine next_actions/prioritize model output. There is no
explicit deliberate-invention capsule/cycle authorization check or per-cycle
Astra count on this path. Naming the reason “deliberate” does not enforce it.

Independent deterministic repro in temporary SQLite DB, zero model calls:

1. Enqueue ordinary next_actions with importance 2 and output=json.
2. Supply its result with three uniquely titled campaign_concept entries, each
   importance=3/creativity=3 (no cycle/purpose/invention metadata).
3. Call _spawn_from_plan: **spawned=3**; all three children are role=astra,
   preferred_model=openai/gpt-6-astra. Their payloads contain only empty
   instructions and product:null.

This permits a routine planner to self-authorize repeated expensive creative
work, contrary to deliberate one-brief-per-meaningful-cycle routing. The existing
test that calls such attributes “explicit invention” does not test this boundary.

Required fix: ordinary campaign_concept remains Luna. Astra requires an explicit
validated invention capsule/cycle selected outside model-generated routine plans;
routine _spawn_from_plan must not self-authorize it. Either disable automatic
marketing Astra routing (retain the deliberate company invention lane), or enforce
trusted cycle metadata/count and purpose logging. Add regression proving an
ordinary plan with multiple high-importance/high-creativity concepts cannot route
them to Astra. Do not manufacture a new approval gate for legitimate existing
company invention authorization.

## Verified passes

- `python3 engine/test_company.py` — exit 0; **22 tests PASS** in 0.271 seconds.
  Dependencies, severity-first ordering, single-product exclusion, stale-token
  fencing, recovery/retry budget, revision preservation and evidence-presence
  gates remain covered. Inspection confirms eligibility read and claim write occur
  under BEGIN IMMEDIATE; priority sorting is deterministic, unknown severity last.
- Independent extra temporary-DB concurrency probe: eight distinct tasks sharing
  one product, eight simultaneous claimers — **exactly one RUNNING winner PASS**.
  This tests product exclusivity beyond the same-task race suite.
- `PYTHONPATH=engine python3 -m unittest discover -s engine/tests -v` from
  marketing — exit 0; **24 tests PASS** in 1.073 seconds. Fake adapters only.
- Configured active chains are OpenAI-only; real Anthropic adapter removed.
  Router rejects non-OpenAI selected chains; independent-review/consensus paths
  apply owner OpenAI review policy. Historical Anthropic pricing and fake adapter
  test entries are not active provider calls.
- Successful Luna does not automatically escalate; provider retry budgets tested
  at Luna two attempts / Sol one. Added queue planning fields validate budget
  integers and preserve prior attempt/evidence state through revisions.
- Failed consensus review now checkpoints WAITING with lease released rather than
  escaping provider policy. Normal PR/CI/native/physical/release gates unchanged.

## Source identity reviewed

SHA256 at review checkpoint (subsequent fixes need their own scoped recheck):

```text
company engine/company.py 9d9feea0ce7a976edc8997d60c2e4f6c4f84a30507b284147842416a3d0afdfc
company engine/test_company.py f0ae72d37931086db65a7b70145d2cefed17b5ba8d552c9335eae9848bdeb723
marketing engine/mktg/router.py 4a8237fd015c5b31671d72c56ea72efd6b10be50580ddde35a44ec954574ca45
marketing engine/mktg/providers.py f69a9f0b9df10b8ee3843194990340403fb357cf07f59469cab6e1bfc182c6ad
marketing engine/mktg/engine.py 7d01ade219b895ac41542d56237c426dcb673a3e7ac2f21bc4eca6044b44014b
marketing engine/config/routing.json c20650f3988de4930cdf8a64fcfa564780030b4b7d4d2fc216e43b83bd19f974
marketing engine/tests/test_engine.py d00e5d9ddd0cad93331415ced33b2f372013dd1021d8a205aa0a61f0798e9223
```

## Limitations

No live provider/catalog/fallback invocation, daemon/cron execution, customer
data, physical workflows or CI/release qualification verified. Runtime OpenClaw
global agent routing beyond these marketing adapters is outside this code review.
No judgment on unfinished telemetry.py/os_cycle.py or their budget enforcement.
Tests and race/repro probes use temporary fixtures, not live company/CRM mutations.
No change request based on speculation; only the reproduced Astra path blocks.

## Post-fix bounded recheck — final scoped verdict APPROVE

Parent removed score-driven Astra promotion. Current router demotes an explicit
legacy/config astra role to Luna; campaign_concept is Luna and astra_types is empty.
Deliberate Astra remains in the separate company creative-cycle capsule lane.

Re-executed the identical three-child model-plan repro: spawned=3, all **Luna /
openai/gpt-6-luna**, zero actual model calls. A stale-config probe that maps
campaign_concept directly to astra also demotes to Luna PASS. The blocking finding
above is retained as failure evidence and is **resolved** by this bounded fix.
Marketing suite rerun: **24 tests PASS**, exit 0, 0.987 seconds.

Additional queue delta reviewed: normalized-result FAILED fingerprint blocks on
the second identical failure, preserving attempt ceiling and original failure
evidence. Queue suite now **23 tests PASS**, exit 0, 0.270 seconds, including the
new identical-failure regression. Capsule revision retains custom fingerprint
fields because validation preserves merged task fields.

Cost admission boundary inspected only: invoked when cost-policy.json exists;
P5/P6 marked low_value, P0/P1 not. Independent temporary-DB test with injected
deterministic preflight verifies P6 defer and P0 admit PASS. preflight's shown
critical override preserves P0/P1. This is **not** a full telemetry implementation,
accounting, snapshot, budget-data or os_cycle review; those exclusions remain.

**Final verdict: APPROVE reviewed queue and routine marketing-routing changes.**
No unresolved concrete blocker within that scope. Original review hashes remain
checkpoint receipts, not permission to apply approval to future changed source.
No additional creative review, agents, product implementation or release approval.

## Distinct final telemetry/supervisor review

Scope: engine/telemetry.py; operations-supervisor cached cost integration;
OS helper inspected only for obvious safety, not repeated routing/queue review.

**Telemetry verdict: CHANGES REQUIRED for ambiguous source-cost zero.**
Collector collect_marketing maps est_cost directly to list_estimated_usd and
counts zero as known. Existing marketing provider price() returns 0.0 when no
model rate exists; active gpt-6.1-sol has no configured rate. Thus nonzero-token
Sol calls with unknown price appear as a known zero dollar estimate in totals
and budget observations. A source-level caveat does not satisfy null-preservation.

Independent temporary-source DB repro, no actual model calls: successful
openai/gpt-6.1-sol, input=100/output=20, est_cost=0.0 -> row estimate=0.0,
total=0.0, known_rows=1. Require null for ambiguous missing-price zero unless
the source exposes sufficient provenance to distinguish genuine known zero;
retain raw/source fact separately if needed. Add missing-price-zero regression.
Do not insert invented price data or rewrite historical source rows.

Verified passes / boundaries:

- Telemetry **15 tests PASS** (0.046s); supervisor **13 PASS** (0.019s), both
  exit 0; no live collection or external model inference in reviewer probes.
- Stable source-specific IDs upsert repeated cron/marketing receipts; refresh
  retains independently recorded value evidence. Cross-source overlap is
  explicitly unreconciled with separate source totals; no asserted universal
  deduplication, global call coverage or billed-company-spend claim.
- Scheduled explicit token totals retained; cache reads/writes separate; absent
  source total with ambiguous cache accounting remains null. Cached input is not
  blindly subtracted from totals. Unknown billed cost remains null; partial sums
  expose known-row counts. The source-cost-zero issue above is the exception.
- Null budget caps do not imply authorization or economy. Explicit low-value
  deferral retains critical P0/P1 override; task-attributed budgets exclude other
  tasks. Unreconciled/partial receipt budgets are advisory, not billing enforcement.
- Marketing source is opened mode=ro + query_only with allowlisted model_calls
  columns; no leads/messages/raw summaries pulled into ledger. Cron raw summary
  and diagnostics dropped; identifiers reject email/contact strings.
- Supervisor reads the existing sanitized cached snapshot, creates no duplicate
  collector, reports per-source estimate and overlap caveat, billed unknown.
- OS helper uses PAUSE + nonblocking lock, deterministic company recover/refresh,
  read-only aggregate supervisor access and bounded configured website checks;
  no product implement/claim/release or external message send in tick. No obvious
  safety blocker found. Full helper functional/source identity proof stays with
  parent execution/tests.

Limitations: no live cron coverage, global source-overlap reconciliation, actual
billing, empirical privacy assurance for arbitrary future source schemas, or
ledger collection performance benchmark. Approval cannot imply those occurred.

### Telemetry cost-fix recheck — final scoped verdict APPROVE

Rechecked only the reported ambiguous-zero defect and focused affected suites.
Collector now preserves ambiguous zero as null; only successful, non-estimated
calls with every input/output/cache token field explicitly zero retain known zero.
Missing provider pricing now returns None, with no invented rate or historical
source-row rewrite.

The identical temporary DB repro (Sol 100in/20out/est_cost0) now yields
**row_estimate=null, total=null, known_rows=0 — PASS**, zero model calls.
Telemetry **16 tests PASS** (0.060s); marketing **26 PASS** (1.059s), exit 0.
The telemetry blocker above is **resolved**; no remaining concrete blocker in
the reviewed telemetry/supervisor integration scope. Existing limitations stand.

Final cost-fix source receipts, SHA256:

```text
engine/telemetry.py 54ad9015eec003614da1836fc1a5f1eff8ac5e17806a16b182585a9fd47ba7ff
engine/test_telemetry.py b551b1ded965780c6ab45a10447684bd8108b018560e0a490c20cc5e3239eaa6
```
