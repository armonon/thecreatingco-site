# Benchmark history

Append one JSONL observation per measured scenario to history.jsonl. Fields:
observed_at, product, source_sha, artifact_hash, fixture_hash, scenario, command,
environment (OS/CPU/RAM/runtime/browser/audio device and buffer where relevant),
metric, unit, repetitions, samples, summary, baseline, regression, evidence.

Unknown data stays null; no regression assertion without a comparable baseline.
Keep synthetic engine, rendered UI, end-to-end product and physical audio series
separate. Never call unit-test runtime, package build time, declared budgets or
accelerated soak models measured real-world throughput.

Initial ScenePilot audit contains a measured synthetic benchmark. Other initial
audits identify qualification gaps, not new latency/FPS/audio-CPU measurements.
