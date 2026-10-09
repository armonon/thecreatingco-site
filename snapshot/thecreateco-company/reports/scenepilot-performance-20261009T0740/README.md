# ScenePilot bounded performance qualification checkpoint — 2026-10-09

Task `CORE-SP-PERF-001`, executed against exact reviewed candidate `c26d518bc3d05f0adbf7287f79c5f5f15ac25220`. **Partial synthetic benchmark PASS; linked-media blocked at toolchain; real-media, app playback/export envelope, and long-session qualification remain BLOCKED/UNVERIFIED.** This is not a product/release readiness result.

## Scope and isolation

- Company and Core Product Lab operating policy, autonomy, AGENTS, ScenePilot performance prior report, independent scope audit, product directive and health were read before execution. Parent owns the queue; this run made no queue/database/export changes.
- Candidate source: `/Users/agentsattari/code/company-worktrees/scenepilot-golden-20261008T0740`, SHA above, clean before/after. New detached worktree: `/Users/agentsattari/code/company-worktrees/scenepilot-performance-20261009T0740` at the identical SHA. No tracked source edits; status was `## HEAD (no branch)`.
- New worktree's ignored `node_modules` link points to candidate's existing dependency path; that path ultimately links to the existing runtime-release18 dependency tree. No install/network fetch was attempted. This shared dependency tree has no Electron binary.
- Preflight: macOS 26.2 (25C56), Apple M4 / arm64, 10 logical CPUs, 16 GiB RAM, Node `/opt/homebrew/opt/node@22/bin/node` v22.23.2, npm 11.19.1. `df -h /Users/agentsattari`: 48 GiB available before run (47 GiB after); no disk cleanup or pressure simulation.
- Hosture/session serving-model identity was not exposed through local execution environment; no additional model/API call was made. Model identity: **unknown**. No review model/fallback used.

## Synthetic performance workload

Reviewed existing `scripts/benchmark-editor.mjs` before execution. It constructs 256 metadata assets, 10,000 cuts, 10,000 overlays, eight tracks, 4K-sized frame-plan inputs and one second of generated eight-strip PCM. It does not load/decode media or exercise Electron, UI, GPU, sustained playback, export, process-tree soak, or real footage. Three fresh Node-process repetitions were run with external 720-second hard timeout and stdout/stderr/timing capture:

```sh
python3 /Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261009T0740/run_bounded.py --timeout-seconds 720 --out /Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261009T0740/benchmark-N -- /opt/homebrew/opt/node@22/bin/node --experimental-strip-types scripts/benchmark-editor.mjs --report=/Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261009T0740/benchmark-N.json
```

Replace `N` with 1, 2, 3. All three exits were 0, not timed out, and all benchmark-internal cases/budgets passed. Whole-process elapsed times: 0.279, 0.269, 0.273 s. Internal measured values:

| Quantity | Run 1 | Run 2 | Run 3 | Unit / internal budget |
| --- | ---: | ---: | ---: | --- |
| 20,000-item prepared context compile | 1.914 | 1.9652 | 1.7693 | ms / 80 ms |
| 10,000-cut prepared planner p95 | 0.0133 | 0.0136 | 0.0135 | ms / 2 ms |
| 10,000-overlay prepared planner p95 | 0.0071 | 0.0074 | 0.0070 | ms / 2 ms |
| Unprepared 10,000-cut planner p95 | 0.115 | 0.118 | 0.1148 | ms / 25 ms |
| Eight-track generated 1-second PCM | 57.7367 | 63.5214 | 58.9997 | ms / 1,000 ms |
| Prepared/unprepared mean speedup | 9.07 | 8.97 | 9.02 | ratio, same-process reference |
| Child max RSS (macOS `RUSAGE_CHILDREN`) | 111,542,272 | 111,296,512 | 111,165,440 | bytes (~106 MiB) |

The external 250 ms `ps` polling captured only one sample per short process and missed its live peak. The recorded child max RSS is the OS `RUSAGE_CHILDREN` maximum for the directly launched Node process observed on wait; it is not an app/process-tree/system RSS aggregate or a time series. Script `heapGrowthBytes: 0` is reported by script but is not proof of zero allocation/no leak (GC can affect the delta). These algorithmic metrics do not measure editor responsiveness, 4K decode/playback FPS, dropped frames, real export throughput, Electron/app/system memory envelope, or long-session behavior.

## Linked-media gate attempt / blocker

Reviewed `scripts/certify-linked-media.mjs`: generated 1-second 160x90 clip, custom protocol fetch, metadata/seek and a pixel check; not sustained playback. Attempted its existing package command with the same external 720-second timeout:

```sh
python3 /Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261009T0740/run_bounded.py --timeout-seconds 720 --out /Users/agentsattari/thecreateco-company/reports/scenepilot-performance-20261009T0740/linked-media -- /bin/zsh -lc 'PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run qa:linked-media'
```

Exit **127**, elapsed 0.275 s, not timed out; stderr: `sh: electron: command not found`. No linked-media fixture was generated and no result is claimed. Dependency installation was not attempted because this bounded task did not require altering shared dependency state. Resume this gate only in an isolated dependency environment restored from the candidate lockfile with Electron exactly `43.7.9`; verify `node_modules/.bin/electron --version` reports `v43.7.9` before retrying. The linked-media script launches its own Electron entry script, so it does not require a built app main; any future app-level playback/export qualification must separately identify and hash the exact built/packaged main artifact at this candidate SHA before launch.

## Provenance and retained evidence

Benchmark fixture is deterministic and synthetic, defined by candidate script. SHA-256:

- `scripts/benchmark-editor.mjs`: `ab24d972d778d5c43aa7e3c84ec72a428c9a8ab300415234cb270059d5b2f828`
- `lib/compositor.ts`: `d16b1aa1a9e84781dcc8802e8f509b8dec8f841898f82dad2a548bf9ddb91991`
- `lib/pcm-audio.ts`: `f57324de1b04447defc0397dc20816f3ddb93644d7bcc6ee5082971641115246`
- `scripts/certify-linked-media.mjs`: `cc87b7b57bd155c2be61cdf03a9c4d77035e6583cdc2656a128aa0094927a512`
- `electron/desktop-io.js` (linked-media protocol implementation): `502f53bbdb215e38d3a33ca4cfab22eee7ae01dcb9f49548d3a668cb699e3147`

For each `benchmark-{1,2,3}.json`, exact script-produced report and stdout SHA-256 respectively: `6b1037fc0387a45d93226294ec6958293b196ccbb55031ff5dddbd5e3dcfdc3e`, `c41781c430ca9b92a874f8f0c1468a46f4ff38afb72caa1836ca660caab7888d`, `d289a80f7dee262b15542e22b948f7db6950c2ed72ac7cf603688ee6713cac92`. Timing JSON SHA-256: `129df7ac130141afaf156fcc3a0223935f67215cf2b460a3aa5d1ef83e781baf`, `46c7571282dcae5380169736bbaf0a0f00d73a62570f49711599f51356573144`, `4a1975c3a27f397d0b873e53f8ecb549a33dbc745fd3ef62f8a1ef2c7833d76b`. All corresponding benchmark stderr logs are empty (empty-file SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). Linked-media timing JSON: `549ea75d8a7b52f58b7cc953179d67c4d7c04492787c831593e278634684ed62`; stderr log: `5b8fe9ce95d9e9ad9db3c57a65d5933ae727bc72d76660ca786100e01c606ffe`.

Retained alongside this report: `run_bounded.py`, three JSON reports, three stdout/stderr logs and timing JSONs, and linked-media stderr/timing. Wrapper SHA-256: `ae91d972bf94df78e4b38da753b86e10b22191a65f216ec453553865d540f643`.

## Blockers and resume criteria

1. The Electron linked-media gate did not execute because Electron is missing from the available dependency tree (`electron` is pinned to `43.7.9` in this candidate’s package-lock). Restore that exact pin in an isolated dependency tree and verify its executable version as specified above; preserve exact candidate SHA and use a top-level timeout no greater than 12 minutes. For later product-app qualification, also preserve/hash the exact built/packaged main artifact and report its provenance.
2. Full performance objective remains BLOCKED: no rights-cleared representative camera-media fixture was used; no sustained interactive playback, seek-to-visible latency, dropped-frame/A/V-sync, export throughput, app/process-tree/system memory time series, thermal observations, low-memory run, supported-platform matrix, or 30–60 minute initial soak was measured. Multi-hour qualification remains outstanding.
3. Before a future soak, record fixture rights/provenance and SHA, codec/rate/duration/bytes; preflight scratch-space budget for source/intermediates/output/proxies; capture process-tree memory over time and playback/export metrics. Do not infer full golden workflow, production readiness, or product health from this synthetic benchmark.

No commits, pushes, merges, deployments, releases, spend, outreach, product/queue mutation, or production changes were made. Parent should retain task as BLOCKED/partial with this evidence attached; this run alone does not satisfy `CORE-SP-PERF-001`.

## Director closeout

Parent Sol inspected retained report/results. Requested native Luna executor; serving identity unavailable, fallback none; no independent consequential code review claimed because no code changed. Cost preflight advisory continue/normal, all budget limits null; unknown is not spending approval. No Astra call/invention or additional model escalation. Queue checkpoint and merge-preserving product/context patches handled by company CLI.
