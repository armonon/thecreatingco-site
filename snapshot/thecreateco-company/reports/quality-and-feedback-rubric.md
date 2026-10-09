# Quality and feedback — initial operating rubric

Adopted 2026-10-07. This defines measurement; it is not a product test result.

## Quality observation

Assess functionality, reliability, design, performance, UX, onboarding,
accessibility, documentation, competitive differentiation, installation,
error handling, data safety, mobile/responsiveness (where applicable) and user
value. Every measured dimension records product/version/environment, test or
observation, result, source artifact, observed_at, sample size and limitations.

- Null: untested or insufficient evidence; never converted into zero.
- 1–3: critical workflow fails or severe data/reliability defect is reproduced.
- 4–5: workflow works only with substantial workarounds or recurring failures.
- 6–7: usable but material friction or incomplete recovery is demonstrated.
- 8: intended workflow passes representative checks; minor gaps remain.
- 9: strong evidence across target workflows and failure recovery; independently
  reviewed, no significant known gap for the assessed scope.
- 10: unusually strong sustained evidence across the claimed scope, not a
  reward for writing tests or a default aspiration score.

Describe why every assessed score below 8 falls short. Important products below
9 get a bounded roadmap with task IDs, acceptance criteria and regression checks.
No aggregate quality score until scope/weights/coverage are declared. Mark
not-applicable dimensions with an explanation rather than a manufactured score.
An alpha's tested save/export flow does not qualify the whole product for release.

## Company health

Leave health null until a reviewed rubric covers quality/reliability, first-use
success, retention, sustainable distribution and operational risk with current
evidence. Store rubric/version, coverage, observation date and source with any
future numerical score. Do not average arbitrary task priorities or completed
work counts into company health. Show missing coverage explicitly.

## Feedback

Categories: BUG, UX ISSUE, FEATURE REQUEST, CONFUSION, PERFORMANCE, PRICING,
DOCUMENTATION, PRAISE, MISSING FEATURE.

Each record: feedback_id, product_id, category, received_at, source_reference,
redacted_summary, frequency, affected_workflow, severity, reproduction_status,
linked_task_id, consent_scope, last_seen_at. Count distinct relevant reports;
deduplicate forwarded/repeated copies. Frequency informs priority but does not
replace severity or user impact. Keep email/contact details in the existing
restricted CRM, never in company dashboard/state or shared reports.

## Close the loop

Capture baseline → make bounded change → verify intended behavior and regressions
→ record actual result → request/observe user feedback where authorized →
update the metric or keep unknown. Do not equate deployment with adoption.
