# Company workspace

Read CI_OUTAGE_POLICY.md for the latest owner policy: local work continues during
hosted-CI outage; flagship repair priority, exact-source evidence, no billing retry
loops and no merge/deployment with unresolved mandatory checks.

For the named18 public-release initiative read release-program/DIRECTIVE.md and
manifest.json. First wave: Bounce, Pocket Studio, Key & BPM, Glyph Studio.

Read DIRECTIVE.md and COMPANY_STATE.md first, then only the evidence relevant to
the selected task. USER_BRIEF.txt is the founder's supplied design brief; this
workspace implements it subject to the host's tool and authorization policies.

Use engine/company.py for queue changes. Never hand-edit generated exports or
the SQLite database. Claim work before starting, preserve the returned lease
token, heartbeat long tasks, and attach evidence before marking work complete.
Do not modify another worker's checkout. Respect repository AGENTS.md and PR/CI
gates. Do not bypass branch protection or replace undocumented production builds.

Unknown is not zero. Distinguish local tests, previous reports, live observations,
and qualified releases. Keep individual feedback, contact details, and secrets
out of the compact state. Product and idea scores are estimates unless supported
by dated measurements. Never claim scheduled work has run merely because enabled.

This is the company director; ../thecreateco-marketing is the growth department.
Preserve its CRM, opt-outs, queue, review controls, and existing authorization.
No new external-send permission is created by this file.

For the four flagships, consult core-product-lab/DIRECTIVE.md and HEALTH.md.
The lab uses the same leased queue; never compete with an active product owner.

## Routine autonomy amendment — 2026-10-07 17:56 Pacific

Read /Users/agentsattari/thecreateco-company/AUTONOMY.md. Armon explicitly removed personal review
as a routine gate and requested continued upgrades, Git pushes and frequent
#4geeks reports. Follow normal independent OpenAI review and PR/CI gates; do not
wait for Armon solely to approve routine reviewed work. This later amendment
supersedes older local-only/no-push wording within its stated scope.

## Autonomous Company OS — 2026-10-08

Read OPERATING_POLICY.md for current model tiers, budgets, compact task capsules,
Astra cycle limits and golden-workflow priorities. Full founder brief is retained.

## Creating Co canonical Git destination — 2026-10-09

Armon explicitly designated `armonon/thecreatingco-site`, branch
`company/operations`, as the central destination for ALL Creating Co work
(message1558301715059445790). Preserve product review branches/checks: after each
verified product commit, the Git handoff helper also mirrors screened committed
source changes and provenance to this central branch. Company operations code,
policy, state, plans and safe text evidence are published there too. Never merge
this internal orphan branch into the website or deploy it. No credentials, contact
lists, private feedback, databases, dirty product trees or unrelated work.

For company/marketing/supervisor code maintained outside a product Git origin,
run relevant checks, then record EXACT task-owned tested files and publish with:
`python3 /Users/agentsattari/git-handoff/checkpoint_company.py --evidence /path/to/verification --file /path/to/task-owned-file`
Repeat `--file` for each owned file. This is a verified-byte checkpoint, NOT a new
human-approval gate. Changed code without a current checkpoint is retained locally
and visibly excluded until its worker verifies it. The existing hourly publisher
continues state/evidence synchronization; source pushes trigger immediate handoff.
At handoff report the central remote SHA or precise blocked state; never call
reference-only or unverified local work pushed code.
