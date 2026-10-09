# Core Product Lab

Four flagship products. Golden-workflow reliability before breadth.

- [Health dashboard](HEALTH.md) — measured evidence and explicit unknowns.
- [Product health report](PRODUCT_HEALTH_REPORT.md) — initial audit synthesis.
- [Unified priorities](PRIORITIES.json) — projection of the existing company queue.
- [Directive](DIRECTIVE.md) and [original brief](USER_BRIEF.txt).
- `products/` — independent living state/specs; `reports/` — dated raw evidence.
- `golden-projects/` — protocols and fixture artifacts; a spec is not a passed test.
- `benchmarks/` — measured history, never inferred from build-time or task counts.

## Operation

Run from this folder:

```sh
python3 ../engine/company.py recover
python3 lab.py next
python3 ../engine/company.py claim --id TASK-ID --owner UNIQUE-OWNER --minutes 45
python3 lab.py refresh
python3 test_lab.py
```

Use the actual lease token for heartbeat/finish per the parent engine README.
Selection checks per-product active work, dependencies and holds; exact task claims
are transactional in the company engine. Recheck product ownership before starting
work. Selection itself is a snapshot, not a cross-task database lock; isolated
worktrees and bounded ownership remain required.

Schedulers (America/Los_Angeles): cycle at minute 40 every two hours, daily review
09:05, Monday flagship review 09:35. Jobs are isolated, bounded, and do not broadcast
to channels. Definitions and verified receipts are in automation/. Enabled does
not mean the first scheduled run already occurred. Initial work was performed in
the interactive setup session. Put PAUSE here or in the parent company directory
to stop new scheduled cycles; existing active work needs separate cancellation.

Routing: Sol direction/review, Luna routine workers, independent OpenAI reviewer
for consequential work. Per Armon's 2026-10-07 amendment, no Claude reviews or
review fallbacks. Historical Sonnet attempt/error receipts remain historical only;
restoring Anthropic credits does not re-enable review use.

Releases, legal/access/payment decisions, destructive actions and physical capture
retain their existing gates. The lab prepares reviewable code; local success never
silently grants production-readiness or deploy authority.
