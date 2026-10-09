# ScenePilot performance checkpoint — 2026-10-08

Task CORE-SP-PERF-001; owner director-perf-20261008T1010. Observed 2026-10-08T10:12:29.315755+00:00. **BLOCKED: insufficient local disk for representative media/export/soak qualification.** One bounded audit batch only; full task/product/release remains incomplete.

## Selection and baseline

PAUSE absent. Read company AGENTS/DIRECTIVE/engine README/state/AUTONOMY/routing, Core Lab directive/health, named18 directive/manifest/matrix and CI-outage/revenue amendments. Initial matrix lookup at release-program/RELEASE_MATRIX.md failed; canonical root RELEASE_MATRIX.md read. `python3 engine/company.py recover` returned no expired leases; refresh passed; `python3 core-product-lab/lab.py next` selected this eligible P2 flagship task; no running product owner in queue. Claimed via CLI for35minutes, owner/token retained. No task or source changes belonging to another worker.

Read-only audit against current reviewed PR95 candidate **c26d518bc3d05f0adbf7287f79c5f5f15ac25220** in /Users/agentsattari/code/company-worktrees/scenepilot-golden-20261008T0740. Tracked status clean before/after; no branch/build/source modification was needed. Reused source only, not older timing results. Existing build/type/lint/1095unit evidence remains in core-product-lab/reports/scenepilot-golden-20261008T0740/README.md; not rerun or represented as newly passed. No substantive fix identified by microbenchmarks, no unnecessary code churn.

## Commands and actual checks

`df -h /Users/agentsattari` showed approximately141MiB available,100% capacity. Python stdlib `shutil.disk_usage` recorded **146059264bytes** free at audit start. Exact host/Node/source hashes in receipt.json. No cleanup/deletion of unrelated work or disk-pressure simulation performed.

On macOS arm64, Nodev22.23.2, three fresh-process repetitions of:

`PATH=/opt/homebrew/opt/node@22/bin:$PATH node --experimental-strip-types scripts/benchmark-editor.mjs --report=/Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261008T1010/benchmark-N.json`

Each wrapped with Python subprocess timeout90seconds; all exit0, all five internal budget cases PASS. Logs/results retained as benchmark-1/2/3.log/json. Synthetic deterministic fixture definition is the hashed benchmark script (hash and transitive compositor/PCM hashes in receipt.json);256 metadata assets,10000cuts,10000overlays,8tracks. No media-byte fixture was created. Reference is the same run's unprepared planner, not prior device/candidate timing.

| Measured quantity | Three-run observed range | Unit |
| --- | --- | --- |
| 20000-item prepared-context compilation |1.6582–1.7946|ms|
| Prepared10000-cut planner p95,900calls/run |0.0123–0.0156|ms|
| Prepared10000-overlay planner p95,900calls/run |0.0067–0.0082|ms|
| Unprepared reference planner p95,120calls/run |0.1106–0.1218|ms|
| Eight-strip generated1secondPCM computation |53.0931–56.1826|ms|
| Reference/prepared mean ratio |8.61–9.66|times|

These are algorithmic measurements, not4K playback FPS, real-media decode, editor responsiveness, browser-worker IPC, export throughput or product health. Benchmark reports heapGrowthBytes0 after clamping negative deltas; GC can make this zero, so it is **not proof of zero allocation or no leak**. Audio runs in Node, notwithstanding script's worker label.

## Independent scoped audit and workload gaps

One native isolated child requested gpt-6-luna for read-only script/docs audit, completed, no files/tests changed. It confirmed:

- certify-long-project: generated600s export,60reused clips,320x180output; not600s4K/UI playback. Main render lacks overall deadline.
- certify-release-stress: synthetic30s4K input repeated3times,250ms FFmpeg-child RSS sampling; excludes Electron/app/process-tree/system memory. Failure retains temp files, adds64MB save fault fixture and proxies. Not safe to launch with current free disk.
- certify-linked-media:1s160x90custom-protocol fetch/seek/pixel test, hardware acceleration disabled; not sustained playback.
- benchmark-editor: metadata/frame-plan/one-second PCM computations; no media/decode/GPU/UI/export/soak.
- release/native-performance docs explicitly retain real-footage/low-memory/multi-hour requirements. Full read-only findings preserved in independent-scope-audit.md.

## Model, resource blocker and resume

Director serving model verified by session_status: **openai/gpt-6.1-sol**, actual fallback none. Routing requested Luna research child; child's exact serving model not independently exposed, so requested gpt-6-luna is not claimed as verified serving identity. No Claude review or fallback used. Two bounded workers; independent child completion received. No code change needing independent Sol approval.

Do not label this full performance task COMPLETE. Only146423808bytes free is insufficient to responsibly launch unknown-size4K source/intermediate/repeated output/proxy generation while preserving customer data and other workers. Real-camera media corpus/access not inspected because disk capacity already blocks the workload. The selected task cannot fit its multi-hour component in35minutes; record a durable checkpoint rather than starting an unowned worker.

Next: restore an independently approved sufficient scratch capacity without deleting active work; then use rights-cleared representative footage with fixture SHA, codec/rate/duration/bytes and source SHA. Preflight source+intermediates+outputs+proxy budget and enforce a top-level timeout/disk ceiling. Run a bounded30–60min first soak checkpoint with app/process-tree memory time series, dropped frames, seek-to-visible p50/p95, A/V sync and output validation; continue toward multi-hour/low-memory/supported-platform qualification using durable ownership. Golden/project/export fidelity remains unverified, not inferred from timing.

No commits/push/merge/deploy/release/outreach/spend/account or production changes. Mandatory hosted CI/stack gates preserved; no billing retries. Registry performance gate stays UNVERIFIED with exact-candidate partial evidence. Company/lab/matrix/revenue views refreshed after this checkpoint.
