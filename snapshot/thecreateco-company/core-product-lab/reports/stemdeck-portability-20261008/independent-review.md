# Independent bounded portability review — 2026-10-08

Reviewer: independent OpenAI subagent, configured model `gpt-6.1-sol` (`openai/gpt-6.1-sol`, parent-confirmed). No Claude or fallback. Child runtime status tool was not available; model attribution is configured-model evidence, not a separate child runtime receipt.

Reviewed: `qualify.mjs`; exact isolated source HEAD `b26c03be150e9ebb4dfcfa489bb57e62802011ec`; archive import/storage implementation; `docs/PROFESSIONAL_ACCEPTANCE.md` section D; historical fixture manifest. Review does not certify pending browser run results. No product modifications or external actions.

## Verdict

The harness genuinely measures a useful **single-fixture desktop-engine import → metadata edit/undo/redo → normal process close/reopen → mixdown export subset**. Passing per-engine receipts can support that narrow claim. It does not complete browser/mobile continuity acceptance, recovery interruption qualification, or universal portability.

## Sound assertions

- Independent Node parsing computes SHA-256 directly from each original binary archive asset, rather than trusting the app importer or archive-declared hashes. For this 39-asset fixture, saved referenced asset hashes and normalized complete arrangement/capture fields are compared to those independently derived expectations.
- Real UI file import, track rename, undo and redo are exercised; persistence is awaited through actual committed IndexedDB reads rather than elapsed sleep alone. Reopened asset hashes and arrangement are checked in a persistent profile after `context.close()` and a new launch.
- Actual UI-downloaded WAV bytes are compared with a retained historical reference. A passing whole-file comparison implies exact PCM equality for that WAV, not merely successful download.

## Material limits / assertion assumptions

1. **State scope is arrangement, not the entire portable session.** `semantic()` compares only `session.arranger`; master/deck/pad/recording/piano-note/mixer/session-name state is not independently compared, although the archive contains those fields. Collecting asset IDs across session does not prove those other values survived correctly.
2. **Edit is a rename only.** This proves metadata edit/undo/redo durability, not resumed sound-changing editing. Split/trim/retime, MIDI, automation, processing changes, and exports reflecting those edits remain untested. No editing is performed after restart before exporting.
3. **No return portable transfer.** The imported archive comes from historical capture evidence, not a new archive produced by each target engine. No target-engine Save project → independently verify archive → import into another clean engine/profile round trip is tested. Track-stem exports are also absent.
4. **Graceful close is not a crash.** The harness waits until edit persistence is committed, then normally closes the browser context/process. It does not kill during import/save/export/capture, test in-flight transaction interruption, OS suspension, sudden power loss, storage eviction/quota denial, or last-good-session preservation after failure.
5. **Desktop engines are not physical devices.** Playwright Chromium/Firefox/WebKit are headless desktop engines on one host. Narrow viewports do not emulate a mobile device; the report correctly marks both mobile emulation and physical device false. No actual Safari, iOS, Android, touch interaction, device-to-device file transfer, permission, or hardware qualification is demonstrated.
6. **Historical WAV is a regression oracle, not independent musical truth.** Its recorded source SHA differs from this candidate. Exact equality is strong for this known fixture, but does not establish live performance/reconstruction correctness, general codec/DSP parity, every audible track, or independently correct mastering. A whole-file mismatch could reflect container metadata rather than audible PCM; the harness does not separately decode/diff a failed WAV.
7. **Hash normalization deliberately loses asset identity.** All strings equal to known IDs are replaced with content hashes. Identical-byte assets can therefore hide identity/remapping differences; non-byte metadata (type/name/analysis) is not verified. Asset enumeration assumes IDs start with `audio-`, true of this fixture, not guaranteed by archive format. The parser also assumes a valid fixed fixture rather than validating uniqueness/declared hashes/schema as a standalone validator. These are bounded-fixture assumptions, not proof for arbitrary archives.
8. **Source binding depends on invocation/server provenance.** `git rev-parse HEAD` and dirty status use the launch working directory, and the harness does not assert the expected SHA or that port 4308 serves that tree. Parent server/source receipts must establish that binding; harness JSON alone cannot. Browser versions are recorded appropriately.

## Required disposition

Retain per-engine results as commit-bound subset evidence, including failures and exact versions. Keep professional acceptance D and full release/mobile qualification open. Remaining material evidence includes physical Safari/iOS/Android and separate desktop browser qualification, post-restart meaningful editing, portable re-export/cross-engine re-import with full relevant state, and separately scoped interruption/recovery tests. No score increase or release sign-off follows from this review.

## Actual-results addendum

Reviewed completed `firefox.json`, `webkit.json`, `chromium.json` and `chromium-pcm-oracle.json`. All three record source `b26c03be150e9ebb4dfcfa489bb57e62802011ec` and the same 39-asset fixture. Firefox 153.0 and Playwright WebKit 26.5 pass the bounded harness, including exact downloaded WAV equality. Chromium 151.0.7922.34 passes all 39 imported/reopened asset hashes, arrangement/event preservation and rename/undo/redo, but **fails the strict WAV byte-identity assertion**; `pass: false` must remain.

I independently parsed both original and Chromium RIFF/WAV files and decoded signed little-endian 24-bit PCM. Their format matches (PCM, stereo, 48 kHz, 24-bit), with 1,336,704 samples. Exactly 5,005 differ; maximum error is one least-significant bit, normalized `1.1920928955078125e-7`. This independently reproduces the supplemental oracle. It is below the existing `< 2e-6` PCM assertions in `scripts/perform-lifecycle-qa.mjs` (lines 287 and 347). This is a **separate toleranced PCM subset result**, not a conversion of the strict failed qualification into a pass, nor proof of cause or universal audio parity. The observed difference alone does not justify escalation as asset corruption or a product defect.

The first Chromium attempt exited 137, with cause unknown (parent reports the receipt retained). The diagnostic rerun changed Buffer equality reporting to a boolean assertion, not the byte-identity requirement; its exit 1 remains an actual strict failure. Do not attribute exit 137 to memory/disk/product failure without evidence.

Chromium/Firefox receipts retain `sourceDirty: true`; parent attributes this solely to an untracked dependency symlink, with no tracked changes. WebKit records false. I independently confirmed the final worktree `git status --porcelain` is empty; that supports current cleanliness but does not retrospectively replace the recorded dirty flags or independently establish their past cause. Preserve those flags and annotate the dependency-only provenance explanation.

Disposition: usable, explicitly scoped desktop-engine continuity evidence; strict Chromium export parity remains failed with supplemental within-existing-tolerance evidence. All original full-state, meaningful-edit, portable return-transfer, crash/in-flight and physical Safari/iOS/Android gaps remain open. No release or full professional acceptance qualification follows.
