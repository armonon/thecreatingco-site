## Scope
Adds versioned AutoCut editable sessions with full-file SHA-256 relink, strict validation, preserved locked/manual edits and settings, staged decode before state replacement, and stale-render fencing. Four scoped source/test files only; generated site and production overlay untouched.

## Evidence
Candidate 8d740071cb9631cfa18d4d6c7faa4a806b8fa42a; baseline fb42d12b98c895b47642eaab4a9be74de0c2c358. Luna implementation; independent Sol scoped review. Tools build, TypeScript, changed-file lint, 51 focused tests and 10 hash oracle cases pass. Local Chromium synthetic owned-media save/close/reopen, lock/2x tempo preservation, wrong-file atomic rejection, identical renamed-file relink and CSV/project/video downloads pass with zero page errors. Independent MP4 full decode passes; video frame oracle passes.

## Blocking qualification
Independent decoded audio starts 2112 samples (44 ms at 48 kHz) later than the synthetic song; unshifted RMS error 0.2523, shifting by 2112 reduces error to 0.000328. Suspected AAC priming/metadata handling is unconfirmed; audio alignment is NOT qualified. Required hosted checks, parent stack, source/live overlay, unsupported encoders, cancel/stress/large-media and real/browser/platform qualification remain. This draft must not merge/deploy/release until those gates resolve. No hosted billing retry.

Targets unchanged wave4/scenepilot-suite, not main; do not treat its parent stack as qualified. Company evidence: reports/autocut-roundtrip-20261009/README.md (workspace artifact).
