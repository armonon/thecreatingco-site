# Astra reason telemetry audit

Task: OS-COST-ASTRA-REASON-NOT-EXPOSED-20261008
Owner: company-director-cron-2069305d
Director model: openai/gpt-6.1-sol. Executor: deterministic Python/CLI; no added model worker, Astra call, external spend or product changes.

## Findings

Fresh bounded collection at 2026-10-09T16:11:10.877707+00:00 read 595 scheduled receipts (220 model receipts) plus 27 allowlisted marketing calls; sources available, pagination not truncated. Exactly 40 historical Astra scheduled receipts lack exposed escalation reasons. First: 2026-10-07T22:50:57.795000+00:00; last: 2026-10-08T19:20:57.915000+00:00. All predate completed routing proof 2026-10-09T06:52:18Z. After that proof, 76 observed receipts contain no Astra. No current enabled explicit Astra cron route; six configured agents route to OpenAI Luna, this director to OpenAI Sol. Other existing OpenAI scheduler models remain unchanged; this audit does not certify every job follows Luna/Sol tier allocation or inspect private fallback config.

Cause: telemetry.normalize_run only accepts exposed escalationReasonCode. These historical cron receipts have null reasons; build_snapshot deliberately retains a weekly historical missing-reason anomaly. This is NOT proof of present Astra misuse. No retrospective reason, ROI, usage, or billed spend can be inferred. The smallest safe resolution is evidence-backed closure of this investigation: routing already repaired; retain historical anomaly and unknown outcomes rather than fabricating attribution or suppressing history. No code/config correction warranted for this task.

## Actual verification

- python3 engine/test_telemetry.py: exit 0, 16 tests PASS, including unknown costs, privacy allowlisting, idempotency, bounded pagination and Astra evidence-backed outcomes.
- python3 engine/test_company.py: exit 0, 24 tests PASS.
- openclaw agents list --json: exit 0; only sanitized route fields retained.
- openclaw cron list --all --json: exit 0; only sanitized route fields retained.
- Read-only ledger assertions: 7/7 PASS (audit.json), plus snapshot confirms historical anomaly still contains 40 rows.
- Cost preflight: advisory continue; all caps null, billed cost unknown. No monetary approval inferred; no new model invocation commissioned.

Artifacts: audit.json, fresh-snapshot.json, preflight.json, telemetry-tests.log, queue-tests.log, agents.log, cron-routes.log. Snapshot source coverage is scheduled-run, not native-child/per-call coverage. Native calls remain unobservable. One mistargeted rg lookup of nonexistent operations_supervisor.py returned exit 2; subsequent engine filename enumeration confirmed absence; no change was attempted and verification passed.

## Next action / boundaries

Preserve historical missing reasons and unknown Astra outcomes. Future deliberate Astra requests must record purpose/task/evidence when exposed. Use this evidence when the already-existing 20261009 same-anomaly task is selected; no second claim or duplicate task was created. Separate repeated_failures tasks remain eligible for their own bounded investigation. Active WEBLAB owner, all product gates, CI holds and releases unchanged. No messages, pushes, merges or deployments.
