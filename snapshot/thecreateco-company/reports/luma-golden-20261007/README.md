# Luma layered golden qualification — in progress

Owned task: CORE-LUMA-AUD-002, luma-golden-20261007. Isolated branch
fix/luma-layered-golden-20261007 above PR7 d4e722330e65a260badc475f53a7a176ccfe7e57.
No merge, deployment, CI retry or release. Current candidate has uncommitted
changes; final exact-head receipt pending. This is not a full product pass.

## Verified milestones

- Live opacity/fill-opacity previews failed to notify UI subscribers after the
  first transient-dirty event. Reproduced with real browser opacity input and
  two engine regressions (0/2 baseline). Narrow emit repair independently
  approved by parent; focused tests 8/8 passed. UI now reaches 63% correctly.
- `layered-run1/report.json`: actual synthetic PNG import, rename, group/ungroup,
  64×32px pointer move, hard diagonal mask, layer visibility/reorder, nondestructive
  exposure adjustment and corresponding Undo/Redo checks passed in Chrome154.
  Fixtures include 2048×1536 source and 1024×768 transparent overlay. All edits
  use actual UI; scripting is read-only inspection.
- Real Save then FAILED visibly: aggregate decoded-memory estimate613MiB exceeds
  unchanged512MiB ceiling. No download or source mutation was falsely passed.
  Baseline screenshot, report, expected state and exports are in layered-run1/.
- Follow-up precision admission regressions failed2/2 baseline, including real
  engine2048px group/ungroup save at685MiB. Decoder surface restoration is serial,
  but each repeated history tile was charged four retained working copies.
  Candidate streams each recognized surface tile into one bounded buffer then
  an independent owned store; counts each retained reference once plus three
  conservative shared scratch buffers. Unknown/opaque/LUT/parallel-patch payloads
  keep previous accounting, and512MiB cap is unchanged.
- `precision-admission-fixed.log`:27/27 focused tests passed, including unchanged
  repeated-canvas rejection, oversize save refusal, malformed ZIP handling,
  malicious metadata/mixed opaque reference accounting and independent restored
  history storage. Parent review requested; browser continuation in progress.

## Known limits / exact next action

Continue real layered Save→Close→Reopen→Export and independent composite pixel
reference, then invalid-file/cancel checks, full local gates and exact-source
review/push. Do not mark this task or product complete from the early subsets.
Raw layer thumbnails intentionally display the source bitmap, not masked output;
unchanged thumbnail is not evidence of source-pixel loss. Mask-disable control,
missing file/failed export, native/GPU/physical platforms remain unverified.
Hosted mandatory checks remain blocked by recorded GitHub billing failure;
source/live stack provenance and deployment remain separate unresolved gates.

## Layered run3 milestone

Actual Save/Close/Reopen now succeeds. All layer parameters and complete semantic
history tree match. Resident history bytes differ114,036,128→202,116,512 because
decoded mutable backing stores are independent; allocation topology is not
expected to serialize identically. This is not a process-RSS guarantee.
Twelve real UI/state checks pass, including corrupt-archive refusal and continued
Undo/Redo. Before/reopened exports match exactly. Independent fixture Canvas2D
composition verifies masks, source/overlay placement and63%opacity withinRGB2 and
exactalpha. However, final tonal output FAILED RGB3/alpha60: source-over doubles
backdrop opacity. Focused regression confirms64→112 and160→220 alpha. Candidate
uses copy for full-strength normal unmasked/unstyled adjustment only; other
blend/partial-opacity/masked variants remain unqualified. Parent review requested.
Parent independently approved bounded precision decode/accounting repair.
Current next action: final tone output oracle, full local gates, exact-source
reviewed commit/PR; retain mandatory CI/source-live/native blockers.

## Exact-head milestone d18aef5

Clean-head Chrome154 real layered checks13/13 PASS, independent composite within
fixedRGB2/alpha0 tolerance; before/reopened and maskUndo/Redo pixels identical.
Source-controlled docs/harness include unverified cases explicitly. Full exact
Node22 npmtest has1404 engine passes/10 skips and4 rendered checks; types and
strict/full lint pass. Netlify/desktop builds and production audit still running.
An existing isolated Reclaim Rust1.99 installation was located (no toolchain
installation or shell/global configuration change). Offline native-core attempt
reported missing cached rayon; normal locked dependency fetch/build then passed
all9 native-core tests. Native bridge compile is now being attempted against the
same exact source. This does not verify packaging, signing, dialogs or runtime UI.

## Native check prerequisite

Native bridge compilation reached Luma and failed because frontendDist
`dist-desktop` did not yet exist in this new isolated checkout. This is not
evidence that native tests passed or that Rust is unavailable. The exact-head
desktop build is already running in the web gates; rerun locked cargo tests
after that prerequisite exists. No GitHub retry or toolchain install involved.

## Checkpoint publication and remaining ownership

PR8: https://github.com/armonon/luma-studio/pull/8
Exact head: d18aef51086b50708cb9cb3a33fddc21d792dc58. OPEN, not merged/deployed.
All exact local web gates passed, including three builds and production audit0.
Native core9 and native bridge28 passed with the existing Rust1.99 installation;
bridge succeeded after the required desktop bundle was generated. Native unit
fault injection is not a physical packaged UI qualification.
New PR-triggered Actions run37725744179 had all three jobs fail with zero steps;
annotation confirms account payments/spending. No retry initiated.

CORE-LUMA-AUD-002 remains BLOCKED/incomplete for actual native/physical/OS-error
qualification and remaining full specification coverage; ownership released.
CORE-LUMA-ADJUSTMENT-VARIANTS-001 is queued and independently actionable for the
unqualified partial-opacity/masked/styled/blend variants above this reviewed head.
Do not treat that local follow-up as blocked by GitHub billing. P01 source/live
reconciliation and other product-wide release gates remain required.
Canonical registry/lab records and release matrix updated without false whole-gate
passes. Parent collaboration-send failed twice with 'agent thread limit reached';
this report and the final child receipt provide the durable handoff instead.
