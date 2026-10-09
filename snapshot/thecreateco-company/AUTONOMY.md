# Standing execution authorization — 2026-10-07 17:56 Pacific

Latest amendment: CI_OUTAGE_POLICY.md explicitly requires continued local work and
feature-branch pushes, but forbids merge/deployment/release while mandatory checks
remain unresolved. Existing personal-review autonomy does not override that boundary.

Owner: Armon (`armonon`), Discord #4geeks, message 1557557217585270805:
“dont wait for my review just keep upgrading and pushing and send me reports often”

This latest specific instruction removes Armon's personal review as an extra gate
for routine product fixes/upgrades. It supersedes older local-only/no-push wording
in company and Core Product Lab operating prompts for this scope. It does not
erase repository-required reviews/checks or product-safety requirements.

## Continue without asking again

- Select evidenced high-value work, preserve existing features, implement and test.
- Perform proportionate independent OpenAI review where warranted; do not use
  Claude/Sonnet/Opus for reviews under the owner's separate model instruction.
- Commit and push scoped tested branches; create/update PRs and follow normal
  checks. Routine changes may land when exact-head required checks/reviews pass.
  Do not hold a ready routine change solely for Armon to personally review it.
- Inspect stack membership: a narrow fix is not permission to merge an unreviewed
  stack. Review/qualify prerequisites as resumable follow-up work rather than
  bypassing the gate or repeatedly asking Armon.
- Continue through the queue after each completed batch. NEEDS_REVIEW normally
  means an agent must perform the review, not that work waits for Armon. If blocked
  by external CI/access or a genuine product decision, record the exact blocker
  and continue unrelated safe work.
- Existing established release workflows retain their deployment authority and
  exact-artifact/reproducible-baseline gates. A branch push is not a deployment.
  Never push an incomplete site snapshot wholesale, roll back an undocumented live
  build blindly, or label an unqualified candidate production-ready.

## Still outside routine authority

No branch-rule bypass, production-data deletion, destructive migration, financial
spend/price/payment changes, ownership/access changes, licensing/legal commitments,
major feature removal, physical capture, or unrelated public outreach. Prepare
concrete options if such a decision is necessary; keep other work moving.

## Reporting

Deliver a short status to Discord #4geeks (`channel:1542939125366132819`) every
30 minutes from 08:20 through 22:50 America/Los_Angeles. State: completed upgrades,
verified GitHub push/PR/merge state, tests, blockers and next work. Separate pushed,
merged and deployed. Unknown stays unknown; no health or business metrics invented.
Use cron's final-response delivery, not a second send tool. Do not include secrets,
contact/customer data or private account contents. Existing other-channel report
rules are unchanged. During quiet hours work may continue; regular reports resume
in the morning. This policy authorizes these progress reports, not marketing posts.

## Revenue-workflow correction — 2026-10-07 19:45 Pacific

Armon (#millions 1557584649482665997) requires autonomous execution and says the apps are not ready. Do not hand routine catalog/product-selection work back to him. Read the latest REVENUE_DIRECTIVE.md amendment: product readiness first, no premature sales, automated payment-to-delivery goal, consolidated owner-only steps only when necessary. Existing active release work and safety/review boundaries remain intact.
