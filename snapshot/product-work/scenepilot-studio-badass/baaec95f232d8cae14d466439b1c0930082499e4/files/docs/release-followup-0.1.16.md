# ScenePilot release-readiness follow-up — 2026-09-20

## RELEASE STATUS

Internal QA candidate; **not ready for unrestricted public production release**.
No public deployment was performed. This extends, rather than replaces, the initial
`release-today-0.1.16.md` assessment. Final artifact identifiers appear below once
packaging and the last UI retest finish.

Final candidate evidence (2026-09-20): **747 tests pass; 18 automated gates pass;
zero automated failures; 10 perceptual gates remain pending**. Browser Lite,
Cloudflare and packaged Desktop renderer builds passed. Package resource/source,
model hash, native-helper target and ad-hoc signature integrity checks passed.
DMG internal checksum verification passed. Gatekeeper acceptance remains false.

- Candidate source SHA-256: `a9a71785f94d2e979202f84ff3e09e49dac4ac24bae7d33a5041c5571a838040`
- DMG: `release/ScenePilot-0.1.16-arm64.dmg`
- DMG SHA-256: `90f18ab1b88ae050f23751dbaa9df2d0b26ae8caf45a78707b34ec94be0fbead`
- Source-bound report: `outputs/release-today/final-followup/qualification-report.json`
- Package report: `outputs/release-today/final-package-report.json`

## WORK COMPLETED

| Problem | Root cause | Fix | Validation |
| --- | --- | --- | --- |
| Failed replacement could destroy an existing master | Export deleted destination before rename | Same-filesystem atomic rename; unique per-job partials | Cancellation and missing-input tests preserve sentinel master; three repeated 4K outputs decode |
| Concurrent proxies shared a partial path | Cache key reused for in-progress output | Unique per-job partials and bounded cleanup | Concurrent same-source proxy requests produce valid output |
| Export preparation blocked Cancel and loaded unused offline media | Cancellation started after whole-bin materialization | AbortSignal during preparation; resolve only reachable clip, audio, nested-comp and clean-plate sources | Retry/cancel regressions and nested dependency traversal tests |
| Disk journals existed but full recovery was hard to reach | History exposed edit snapshots without full disk media links | Native disk-journal picker, restore with links, force a new Save As | Packaged UI restored clip-red preview and saved Recovered-QA-0.1.16.scenepilot.json |
| Restored composition exports received zero-byte path-backed files | Alpha route bypassed media materialization | Resolve reachable original files before encoding | Preparation regressions; final packaged alpha check recorded below |
| VP9/alpha export failed despite a usable software encoder | Delivery forced hardware VP9; preflight asked Chromium for native alpha rather than the renderer's dual-plane route | Match no-preference encoder route; check opaque VP9 planes used by Mediabunny; add composition preflight | Real WebM alpha fixture decodes to transparent and opaque pixels; capability regressions |
| Composition retry could export the main sequence | Job lacked composition identity and dispatch | Project/comp-bound jobs, route retries to the original comp, fail safely if removed | Deleted-comp and repeated-comp-job regressions |
| Render queue hid useful errors | Error stored but not displayed | Visible wrapping error text | UI retest below |
| Review approval could name missing files or a different candidate | Metadata-only review validation | Candidate source fingerprint, evidence existence/size/path checks, robust malformed-input validation | Evidence traversal/symlink/duplicate/missing-file regressions |
| Native helper required macOS 26 while download copy claimed 11 | Compiler inherited host deployment target | Explicit Swift target and application floor of macOS 13 | Mach-O vtool and bundle metadata checks; actual macOS 13 operation NOT VERIFIED |

The editor-shell skill guided consistent dirty-document/recovery behavior and focused
shell extraction. No broad UI redesign was attempted during release freeze.

## PERFORMANCE

Bounded generated workload: three consecutive 30-second 3840×2160 native exports
completed in 16.842, 16.915 and 16.851 seconds. Sampled encoder process peak RSS was
669,408 / 687,728 / 699,888 KB. These are one host's short native-encoder results,
not 4K UI playback, total app memory, a multihour soak, or a universal speed promise.

## TEST RESULTS

- Actual isolated 32 MB volume reached ENOSPC: previous document survived; retry
  succeeded after freeing only the test volume. The system disk was not filled.
- Process-kill during a 64 MB atomic document write left a complete old or new JSON
  document; subsequent save succeeded. This tests the save primitive, not every UI
  process/crash timing.
- Four-second 640×360 H.264 montage from two public-domain real-person clips passed
  duration, shot difference and decoding checks. No real song/dialogue mix was used.
- Eight seconds of real-person footage sampled at 2 fps returned spatial mattes on
  all 16 frames; neural memory operated on all 15 later frames with at most five
  anchors. First/last overlays keep the selected left subject. No labeled truth or
  fine-hair quality score is claimed. Alpha/source/overlay frames and labeling
  instructions are in the local roto review pack.
- One-second transparent 160×90 WebM produced by the shared renderer decoded via
  libvpx-vp9: 14,400 pixels, including 8,133 fully transparent and 3,375 fully opaque.
  This proves real alpha survives encoding, not all composition/effect parity.
- Packaged recovery UI restored linked footage, showed it in preview, and saved a
  new document without overwriting the journal.
- Earlier rebuilt DMG integrity/package checks passed; final rebuild/retest below
  supersedes that artifact. Ad-hoc signature integrity is not Gatekeeper approval.
- Final packaged composition UI: TITLE IMPACT exported and saved as 1920×1080 VP9
  with Opus, 4.020 seconds. At one second, independent libvpx-vp9 alpha decoding found
  1,599,577 transparent and 103,254 opaque pixels out of 2,073,600. Queue reported
  completion. The previous failed hardware-only job now displays its diagnostic.
  This verifies the actual packaged composition route, not just a mock or fixture.

Evidence: ignored `outputs/release-today/` contains `stress-followup.json`,
`licensed-footage/report.json`, roto artifacts, `alpha-proof.webm`, codec probe,
and the source-bound full qualification directories. Media provenance is recorded
in `release-qa-assets.md`; downloaded footage is not added to Git.

## REMAINING ISSUES

- **P0 distribution blocker:** no Developer ID Application identity / complete
  notarization credentials available. Existing Apple Development identity cannot
  satisfy this. Public signing gate remains closed.
- **P1 acceptance gate:** ten named real-footage/perceptual reviews remain unsigned.
  Generated assets and short public footage do not meet all their acceptance criteria.
- **P1 compatibility gate:** no separate clean macOS 13/current-machine matrix,
  offline installation, update/rollback or full long-session test result is available.
- **P2:** source materialization still holds required files in memory; the bounded
  stress run does not qualify very large media/long-project limits.
- **P2:** main source still appears separately from the media-bin count, confusing
  first-time users. Some Lite/Pro affordances need further usability review.
- **P3:** exhaustive dock-layout screenshot matrix and every editing gesture have
  not been qualified. Do not describe this pass as an exhaustive UI certification.

## MISSING FOR A PROFESSIONAL RELEASE

Owner-provided signing credentials, access to the compatibility test machines,
permission-cleared representative production projects, completed human review, and
owner license/distribution approval. Safe generated/public alternatives have been
used for engineering tests; they do not replace those exact-artifact gates.

## IF WE RELEASED RIGHT NOW

The candidate is materially safer and more testable. Publishing it as trusted,
universally production-ready software would still overstate compatibility, long-shot
quality and Apple distribution status. Keep it a clearly labeled local test candidate.

## RELEASE CHECKLIST

- [x] Atomic render/proxy and interrupted-save regression checks.
- [x] Isolated real disk-full failure/retry.
- [x] Short 4K repeated export and cancellation evidence.
- [x] Real-person media render and neural roto review assets.
- [x] Packaged disk-journal restore/Save As.
- [x] Source-bound review evidence validation and support/recovery handoff.
- [ ] Developer ID/notarization and final Gatekeeper acceptance.
- [ ] Separate clean-machine/offline/upgrade/rollback matrix.
- [ ] Signed perceptual reviews and realistic long-project limits.

## FINAL VERDICT

Engineering has reduced concrete release risks. Release approval remains withheld
until external distribution/compatibility inputs and recorded acceptance gates are
available. See `release-handoff.md` for secure setup and the exact remaining procedure.
