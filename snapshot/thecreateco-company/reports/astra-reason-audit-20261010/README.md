# OS-COST-ASTRA-REASON-NOT-EXPOSED-20261010

Observed: 2026-10-10T08:10:50.004534+00:00. Actual executor: scheduled Sol director (GPT-6.1 Sol), deterministic Python only. No Luna/Astra worker or additional model request; software fully handles this audit. Task selected severity-first P3; commissioning proof already COMPLETE; no running product owner or PAUSE. Claim owner company-director; bounded 35-minute lease.

## Result

COMPLETE investigation: the anomaly remains visible but is historical missing metadata, not observed ongoing Astra routing. All 40 weekly Astra scheduled-run receipts are from main between 2026-10-07T22:50:57.795000+00:00 and 2026-10-08T19:20:57.915000+00:00, before routing commissioning completed 2026-10-09T06:52:18+00:00. Among 224 receipts after proof, zero identify Astra. This is scheduled receipt coverage only, not proof of native-child/per-call usage. Historical purposes/outcomes/cost stay unknown. No reason was invented and no historical receipt was rewritten. No telemetry defect demonstrated; smallest correct resolution is evidence closure, not suppression or a speculative code patch.

## Evidence and checks

- `python3 engine/company.py recover`: exit 0; no expired leases.
- `python3 engine/telemetry.py preflight`: exit 0; normal/advisory continue, all monetary caps null. Unknown budgets are not spending approval; no new external spend.
- `python3 engine/telemetry.py collect`: successful parsed output in collection.json; cron available, no error/truncation. Sanitized allowlisted collection only; no raw transcript reads.
- `python3 engine/test_telemetry.py`: exit 0, 16 tests PASS (tests.log).
- Focused deterministic assertions: exit 0, historical boundaries/no post-proof Astra/missing-versus-explicit reason preservation/complete collection PASS (focused-checks.log).
- aggregate.json contains sanitized dated counts; source hashes: {"engine/telemetry.py": "54ad9015eec003614da1836fc1a5f1eff8ac5e17806a16b182585a9fd47ba7ff", "engine/test_telemetry.py": "667c09c0f0927cf0985e86dae3425c2bb6e1a492dd01f9757816b443c74a183c"}.

## Git handoff and boundaries

No source code edits or code commit resulted; no push was needed. Only task-owned evidence and generated telemetry/state refreshed. No product edits, messages, release, merge, deployment or CI-success claims.

## Next action

Preserve historical missing metadata and the weekly anomaly until it ages out. If a new post-proof Astra receipt appears, investigate that exact sanitized receipt and record purpose/outcome through existing authority. Do not reopen this same historical-only investigation each cycle or infer unknown usage/spend as zero.
