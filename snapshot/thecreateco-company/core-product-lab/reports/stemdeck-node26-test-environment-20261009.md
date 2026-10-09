# StemDeck Node 26 test environment repair

Task: `CORE-STEM-AUD-004`  
Candidate: `a9e9d977e409c56e3b1f2d636ea9291034848645`  
Date: 2026-10-09

## Root cause

Node 26 exposes experimental process-level `localStorage`. In parallel Vitest
jsdom workers it shadowed jsdom's browser storage, leaving browser tests with an
undefined storage object and causing broad false failures. This was reproduced
with `src/pages/SattariStudioPage.test.jsx --maxWorkers=2`: 36/36 failures at
`localStorage.removeItem`.

## Repair

- Route the package `test` script through `scripts/run-vitest.mjs`.
- That cross-platform Node wrapper appends `--no-experimental-webstorage` before
  Vitest starts workers. It preserves existing `NODE_OPTIONS` and avoids
  shell-specific environment syntax.
- Add a jsdom regression that proves global storage is the jsdom storage and
  supports a write/read/remove cycle.

No persistence assertion was weakened. An unrelated pre-existing responsive CSS
modification was not staged or changed.

## Verification

From `/Users/agentsattari/code/core-product-lab/stemdeck` on Node `v26.9.0`:

```text
npm test -- src/pages/SattariStudioPage.test.jsx src/test/nodeWebStorage.test.ts --maxWorkers=2
2 files passed; 37 tests passed

npm test -- --maxWorkers=2
246 files passed; 2234 tests passed; duration 96.28 s

npm run type-check
PASS

npm run build
PASS (Vite build, prerender, studio service-worker build)
```

## Boundary and next action

This qualifies the deterministic test environment only. It does not qualify the
full musical replay workflow, WebKit storage behavior, release artifacts, or
physical performance. Obtain independent OpenAI review, then merge through the
existing PR/CI path if approved.

## Later push handoff — 2026-10-09T22:33:00Z

After Armon's cross-thread push instruction, the exact tested commit
`a9e9d977e409c56e3b1f2d636ea9291034848645` was pushed to
`origin/core-lab/stemdeck-audit-20261007` and the remote SHA read back.
The checkout had a separate uncommitted `src/styles-studio-session.css` edit;
that edit was **not** staged, committed or pushed. A local receipt is in
`git-handoff/receipts.jsonl`. Independent review and PR/CI/release qualification
remain pending; this push is not a release.
