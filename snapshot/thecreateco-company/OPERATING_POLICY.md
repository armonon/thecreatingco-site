# Autonomous Company OS — adopted 2026-10-08

Owner: Armon, Discord DM, message 1558007032127426633 plus explicit “implement it”.
Full 68-section mandate: AUTONOMOUS_COMPANY_OS_USER_BRIEF.txt. This compact operating
entry point amends, not replaces, DIRECTIVE.md, AUTONOMY.md and CI_OUTAGE_POLICY.md.
Preserve narrower holds, active owners, CRM/opt-outs, independent reviews and exact
PR/CI/release gates. No arbitrary messages/publication or new spending authority.

## Intelligence per dollar

Before every model request ask if reliable deterministic software can do it.
Code handles tests/builds/status/claims/IDs/math/collection/retries/state. Luna
(openai/gpt-6-luna) is the default executor, researcher, draft writer and reporter.
Sol (openai/gpt-6.1-sol) directs priorities/architecture/complex debugging, then
returns after a meaningful batch or blocker. Astra (openai/gpt-6-astra) INVENTS;
never the default builder, monitor, routine reviewer or status writer. OpenAI ONLY,
including fallback chains; preserve historical provider records and credentials.
Astra gets one compact INVENT, BREAKTHROUGH, CROSS-PRODUCT, REVENUE, or LAUNCH brief
per meaningful cycle; at most three ideas, select at most one; one optional WOW
review of the finished artifact. Log purpose, actual usage if available, selected
idea, downstream task IDs, implementation evidence and measured result separately.
A WOW score is explicitly subjective judgment, not measured product health.

Targets, not quotas: 30–50% deterministic operations; model calls 75–90% Luna,
8–20% Sol, 1–3% Astra. Never escalate successful Luna work automatically. Retries:
Luna <=2 attempts, Sol escalation <=1, Astra <=1 per cycle absent new evidence;
identical failure <=1 retry; self review <=1, rewrite <=1, research <=3 rounds.
Preserve failed evidence, checkpoint BLOCKED, continue useful independent work.
Context targets: routine <8K, coding <20K, debug <40K, architecture <60K tokens;
larger needs recorded justification. Stable prefixes, task-specific suffixes.

## One durable queue, one company priority

engine/company.sqlite3 remains authoritative, through engine/company.py only.
Recover leases, read compact COMPANY_STATE.md and core-product-lab/HEALTH.md;
use severity P0 security/data-loss/crash, P1 broken core workflow, P2 professional
gap, P3 performance/UX, P4 depth, P5 polish, P6 nice-to-have. Critical reliability
outranks numeric revenue estimates. Observe active per-product ownership. Queue
meaningful work with objective, impact, effort/risk, dependencies, model tier,
context/token/tool budget, test requirements, evidence, result and next action.
WAITING is a validated-choice hold, never a license to invent busywork. New ideas
must validate pain/demand before substantial building. No automatic new-app lane.

Every worker capsule: task ID, objective, why, product/files, current state,
known failure, constraints, acceptance criteria, token/tool budget, model and owner.
A bounded cycle claims one task, executes/proves/checkpoints, updates state, stops.
Scheduling provides continuity; no unbounded model loop. PAUSE at company/lab
stops new work. Leases and source identity survive process restarts.

## Trust before breadth

ScenePilot: import → organize → edit/animate/color/audio → save/close/reopen/export.
Luma: import → layers/masks/adjust → save/reopen/export.
Form: sketch/model/refine/material → save/reopen/export consistently across modes.
StemDeck (very high priority): load/analyze/stems/perform/capture/replay/arrange →
save/reopen/export. Full real authorized workflows, not isolated UI assertions.
Regular suite gauntlet: Form asset → Luma visuals → StemDeck music → ScenePilot
final piece. Do not hide genuine supported-workflow gaps behind competitor tools.
Log product/workflow/action/expected/actual/severity/time lost/workaround/root cause/
recommended fix/status in evidence. Preserve fixture hashes and source provenance.
Benchmark relevant startup/load/save/reopen/latency/export/memory/CPU/long sessions;
only report measured history. Root cause recurring failures, add regression checks.
Use shared infrastructure only when it helps actual workflows.

## Growth, revenue and judgment

Year-One planning allocation (adopted 2026-10-09): 45% flagship product/reliability,
20% free-web-tool acquisition platform, 15% distribution/marketing/SEO, 10%
ProjectLab/Cross-App foundations, 10% revenue experiments. These are planning
targets, not quotas or claims of measured actual effort. P0/P1 security, data-loss,
crash and core-workflow work may temporarily override them; record the reason and
review allocation monthly against observed bottlenecks.
Website clarity, CTA, downloads, onboarding, mobile, SEO, accessibility, speed,
trust, forms and analytics matter as much as features. Marketing is permanent;
existing department owns campaigns/CRM and authorized publication, not a new engine.
Every experiment: hypothesis/audience/channel/message/CTA/metric/cost/result/learning/
next action and SCALE/ITERATE/STOP. Ethical growth only: no fake claims/engagement,
spam, impersonation or dark patterns. Revenue paths require customer/offer/price/
customers-needed math/distribution/readiness/risk/validation/next milestone.
Free core philosophy and major commercial-change approvals remain intact.

## Telemetry and reporting

engine/telemetry.py collects available sanitized receipts/aggregate data without
raw transcripts or contact data; unknown price, attribution, usage and billed costs
stay null. data/cost-policy.json exposes daily/weekly/per-agent/product/task/Astra
budgets. Unset budgets are NOT spending approval. In economy mode defer low-value
work, use code/Luna, batch/reduce context; keep critical work and deliberate strategy
available within existing authority. Do not claim global per-call coverage when
only scheduled-run receipts and marketing records are exposed.
Anomalies (premium spikes, growing context, duplicate work/repeated failure) create
bounded optimization tasks, not recurring expensive analyses.
Use ONE operations-supervisor: hourly changes via deterministic collection + Luna;
five-minute deterministic critical watch; no Astra/Sol for routine monitoring.
Daily CEO report and weekly Sol strategy: shipped/improved/tests/growth results,
known revenue/cost, Astra impact, failures, blockers, tomorrow's highest-value task.
Report pushed/merged/deployed separately. Existing channel destinations remain.
Unknown metrics and quality remain unknown. Dashboard is compact evidence, not hype.

## Completion and boundaries

Code: implement/build/test/workflow verify/document/measure where relevant.
Product: problem/solution/dogfood/save-reopen/regression/prove.
Marketing: research/hypothesis/create/publish only when authorized/measure/learn.
Astra: invent/Sol validate/Luna prototype/test/signal/continue-modify-kill.
Routine safe work proceeds without asking again. Approval is still required for
meaningful spending, customer pricing/payment changes, contracts/legal/access,
production deletion, mass outreach, major public promises or product retirement.
Never bypass gates. Complete authorized independent work while one item is blocked.
