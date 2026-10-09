# Luma packaged-performance qualification — 2026-10-09

Task CORE-LUMA-AUD-003; owner core-lab-20261009T1940. Result: BLOCKED (partial qualification preserved).

## Source and environment
Exact source `30bea20f862c4302887b79b89f364f2d7bdf5710`, isolated detached worktree `/Users/agentsattari/code/company-worktrees/luma-perf-20261009T1940`; tracked source clean after build. Node v26.9.0, Apple M4/macOS (full uname in environment.json), Rust/Cargo 1.99.0 using existing reclaim-rust toolchain. Default PATH cargo was unavailable and direct cargo initially found no default toolchain; explicit CARGO_HOME/RUSTUP_HOME resolved it without installation. Exact package-lock hash matched existing dependency donor; reused dependencies, not a clean installation. Fixtures synthetic only, hashes in fixture-provenance.json.

## Executed results
- `node_modules/.bin/tsx --test tests/resident-memory.test.ts tests/extreme-alpha-memory.test.ts tests/performance-governor.test.ts tests/project-history.test.ts tests/project-zip-stream.test.ts`: exit 0, 20 pass/0 fail/0 skip. Includes 10K/25K/50K bounded selections, sparse transforms, shared admission ceiling and synthetic history/archive persistence. Engine harness, not UI dogfood.
- `npm run pro:build -- --bundles app`: exit 0, 127.22s. Explicit reclaim-rust toolchain, CARGO_NET_OFFLINE=true; release mode; frontend build passed. Exact command/env receipt and full build log retained. Build duration is not product performance.
- `codesign --verify --deep --strict --verbose=2` on isolated generated app: exit 0. Ad-hoc signed; not notarized, not installed or released. Source digest/executable SHA retained in native-build-report.json.
- `/usr/bin/time -l node_modules/.bin/tsx build/benchmark-brush-streaming.ts`: exit 0. Three synthetic CPU samples: baseline median 346.253ms, incremental median 52.803ms, exact pixels. Reported subprocess maximum RSS 145309696 bytes; NOT native app process-tree RAM. This compares two algorithms in the same source, not historical app performance or input-to-display percentiles.
- `node build/check-release-evidence.mjs status`: exit 0 but only 1/10 evidence gates PASS. Preserve nine FAIL/unevidenced gates in release-status.log; status command exit is not qualification success. No hosted CI billing retry.

## Blocker and resume
Build a separately identified native qualification bundle/profile with isolated synthetic recovery state; execute dense/sparse brush/transform/open/save/reopen/export fixtures using validated input-to-paint instrumentation and process-tree RSS sampler; record raw samples and parity, p50/p95/p99 and peak RAM. Reuse this task, not a duplicate.

The canonical native identifier is app.luma.studio and recovery uses persistent IndexedDB keys; a separate native profile and measurement driver were not established in this batch. Did not launch canonical package and risk touching existing user recovery. This is a safety/measurement limitation, not a confirmed app defect. Packaged input latency, dense/sparse full-app memory, save/reopen/export interactive dogfood and full golden workflow remain UNKNOWN/NOT RUN. No assertions relaxed. No code changes, commit, push, PR, merge or deployment; existing source branch was already pushed in the preceding documentation cycle. No artifact uploaded. Existing task retains concrete resume work, no duplicate enqueued.

Cost preflight advisory continue; all budgets unset, not spending approval. No extra model requests, Luna/Astra delegation or independent review. Actual director OpenAI GPT-6.1 Sol; deterministic execution only; no fallback. No material UX/code change requiring independent review. Billed cost unknown.
