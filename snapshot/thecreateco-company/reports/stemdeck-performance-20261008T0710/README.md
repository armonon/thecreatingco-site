# StemDeck performance checkpoint — 2026-10-08T07:12:04.984750+00:00

Task: CORE-STEM-AUD-003. Owner: company-director-20261008T0710-stem-perf.
Disposition: **BLOCKED**, not completed or released.

## Selection and scope
Company PAUSE absent; recover returned no expired leases. Refreshed shared queue; core-product-lab/lab.py next selected this P1 task with no active StemDeck owner. Claimed through company CLI, preserving its token. Read company directives, AUTONOMY, routing, CI policy, revenue amendment and named18 scope. Release matrix is at root RELEASE_MATRIX.md, not release-program/RELEASE_MATRIX.md; the requested nested path was missing and the existing root view was read. All18 and excluded-app protections remain intact.

No engineering changes required for this bounded audit. Used existing clean isolated candidate checkout read-only: `/Users/agentsattari/code/core-product-lab/stemdeck-archive-webkit`, SHA `6bad0edaf198d80d44c9aa02c3e65970fe7d9148`; git status empty before and after. No other worker checkout modified. No push, merge, deployment, external message, cleanup/deletion or physical recording.

## Actual commands and outcomes
From company root:
- `python3 engine/company.py recover`: no expired leases.
- `python3 engine/company.py refresh`: success.
- `python3 core-product-lab/lab.py next`: CORE-STEM-AUD-003 eligible.
- `python3 engine/company.py claim --owner company-director-20261008T0710-stem-perf --id CORE-STEM-AUD-003 --minutes 35`: claim succeeded.

From the source checkout:
- `git status --short`, `git rev-parse HEAD`, `git worktree list`: clean exact candidate, source above.
- Inspected docs/PROFESSIONAL_ACCEPTANCE.md, docs/SESSION_INTEGRITY_1_0.md, scripts/run-windowed-soak.mjs, scripts/windowed-replay-qa.html and recording-preflight.mjs.
- `df -h .`: about1.1GiB free on Data volume.
- `STUDIO_BROWSER_OUTPUT=/Users/agentsattari/thecreateco-company/reports/stemdeck-performance-20261008T0710/browser /opt/homebrew/opt/node@22/bin/node scripts/run-windowed-soak.mjs > /Users/agentsattari/thecreateco-company/reports/stemdeck-performance-20261008T0710/soak.log 2>&1`: **exit1**. Existing recording preflight refused before server/browser/capture: available 1229836288 bytes, required 2838683648 bytes (691200000 recording +2147483648 reserve). Not a reproduced audio deadline failure. No retry or weakened guard.
- `/opt/homebrew/opt/node@22/bin/node node_modules/vitest/vitest.mjs run src/utils/windowedSource.test.js src/utils/performanceClock.test.js src/utils/sourceCapture.soak.test.js --maxWorkers=2 > /Users/agentsattari/thecreateco-company/reports/stemdeck-performance-20261008T0710/targeted-unit.log 2>&1`: **exit0; 3 files,21 tests pass**. This is accelerated/unit coverage, not elapsed real-time performance.

## Coverage and limitations
Existing unchanged soak covers four stereo stems,180-second synthetic sources,120-second playback, two seeks and4ms UI pressure every32ms, with deadline/source-PCM guards. It does **not** implement the complete documented normal profile (2decks/8stems/16tracks/24notes/stereo input) or heavy profile (4decks/16stems/32tracks/80notes/stereo input). It cannot qualify those profiles by changing labels or substituting unit tests. Physical30/60/120minute sessions require explicitly authorized equipment/media and physical-input permission, unavailable within this job. All remain UNVERIFIED/BLOCKED.

No new CPU/RSS/heap/swap, audio underrun, runtime deadline, input latency, export time, captured-frame/drift or journal-growth observations; unknown remains unknown. Source and fixture SHA256 hashes, host, Node version and fresh receipt are in observation.json. Earlier full2259-test/build/WebKit evidence at this SHA is historical and not claimed freshly rerun. Disk failure applies to local development verification; existing hosted mandatory CI, stack/review/native/license/deploy gates are independent and unchanged. Product remains ALPHA/not qualified; no completion or score gate upgraded.

## Model and next action
Actual director model: openai/gpt-6.1-sol (session_status). Actual fallback: none. No reviewer/worker invoked; no code or consequential new product decision warranted one. Configured runtime fallback listing includes Anthropic, but no fallback was used and owner prohibition on Claude reviews is preserved.

Provide >=2838683648 free bytes on an authorized recording volume without deleting private/user data; rerun the unchanged synthetic soak once. Then implement/execute the complete documented normal/heavy qualification harness in a separately scoped isolated task; physical30/60/120minute campaign remains separate. Registry performance_probe records this exact candidate subset through company CLI, without altering canonical completion gates. Shared queue task is finished BLOCKED with this evidence; company/lab/release/revenue views refreshed.
