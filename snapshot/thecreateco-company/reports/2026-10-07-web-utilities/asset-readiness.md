# Focused web utilities: existing asset readiness

Read-only research under parent lease `REV-WEBTOOLS-20261007`; observed 2026-10-07 Pacific (UTC 2026-10-08). No product edits, queue mutation, model inference, fresh browser tests, deployments, or external messages in this audit. Fresh source inspection is distinguished below from prior executed evidence. Registry snapshot generated **2026-10-08T03:47:30Z**. Read company AGENTS/DIRECTIVE/COMPANY_STATE/AUTONOMY/CI_OUTAGE_POLICY, latest REVENUE_DIRECTIVE owner correction, and release-program/DIRECTIVE. Parent remains owner.

## Decision

**Best readiness-first standalone asset: Glyph Studio, with a narrow “draw your own lettering → usable font” workflow.** It is already a standalone browser app with genuinely parsed downloadable output and a source-matched public release. It has no neural-model cold start or hosted inference requirement for that core workflow. This is a recommendation to validate demand around the existing product, **not** evidence of willingness to pay, readiness for a new paid offer, or permission to charge for existing free functionality.

**Second: Key & BPM as a focused local batch utility**, not a new build. It has useful measured/report workflows and low inference infrastructure cost but is not deployed at the qualified candidate and has weak real-music accuracy evidence. Split is a real existing local AI asset worth qualifying, but it has heavier client-compute, recovery and quality risks; do not sell it as a production splitter yet. Captions/Reframe/AutoCut already exist and should not be rediscovered as fresh ideas. Cutout/Upscale are embedded capabilities, not qualified standalone websites.

That second-place description is **readiness/low-compute utility reuse**, not a paid-offer ranking. For the parent's commercial validation shortlist: Glyph first; Split next only after a real quality/device benchmark; Captions after output/lifecycle qualification. Key & BPM is better treated initially as a free acquisition/support utility, not the first paywall. No demand evidence in this audit settles the commercial ranking.

The commercial distinction is important: a narrow tool can be easier to understand and acquire than a full editor, but this audit measures implementation/readiness, not demand, conversion, margin, or retention. User media inference runs locally in inspected paths, which removes a hosted per-job inference requirement; it does **not** make CDN/model bandwidth, support, development, compatibility, and customer acquisition free. No measured cost figures exist here.

## Exact source and freshness

Fresh `git rev-parse HEAD` and `git status --porcelain` observations:

- Split/shared Sattari: `/Users/agentsattari/code/wave2/sattari-all`, `a9a77e6ad21245a99c83b592ed2fb8a660e71a37`, **1 dirty/untracked entry**. Local module source is not a source-matched deployed artifact.
- Key & BPM qualified candidate: `/Users/agentsattari/code/core-product-lab/key-bpm`, `dab0dda829ffc436987773d650abbe0232f4a0ec`, **clean**.
- Glyph qualified candidate: `/Users/agentsattari/code/worktrees/glyph-completion-20261007`, `a3e50fa6d5fabdf499fd1592085c54d9710e42dc`, **clean**. Merged main `0feefc7785d356f1862f23a96162bfd69f4d872e` has identical tested tree per release receipt.
- Embedded Glyph/Cutout/Upscale baseline: `/Users/agentsattari/code/wave2/luma-E`, `e709a1667ff72feacca91bb0a04238ec59ae96d7`, **clean**. This is the inspected module baseline, **not** newest Luma golden-workflow candidate: active owner is continuing PR7 `d4e7223` after PR5/6. Do not regress or fork their work.
- Captions/Reframe/AutoCut: `/Users/agentsattari/code/wave2/scenepilot-autocut`, `fb42d12b98c895b47642eaab4a9be74de0c2c358`, **193 dirty/untracked entries**. Inspected working-tree content is not attributed solely to HEAD.

The release18 inventory dated `2026-10-08T02:11:40Z` observed initial desktop/390px interfaces. Its later gap audit at `02:21Z` inspected source, not real model inference/full workflows. Both are superseded for Glyph and Key & BPM by their later exact-candidate reports. Generic registry fields such as “Historical alpha publication report; not live reverified” must not override newer `completion_observations`.

## Asset-by-asset actual jobs

### Glyph Studio — standalone

- **Input → output:** brush/pen-drawn glyph strokes → editable alphabet, metrics/advances and kerning → portable project, SVG sheet and real OTF/TTF. A lettering/font authoring utility, not a prompt-to-font model or photograph-to-full-alphabet reconstruction. Works locally with IndexedDB autosave and explicit portable backup; offline PWA operation is tested.
- **Fresh source:** candidate README and `src/engine/font-export.ts`, `glyph-model.ts`, `project-store.ts`; no neural/API inference is required for font creation/export. Standalone is a spin-off from Luma, with its own upgrades and recovery logic.
- **Strongest prior execution:** `../glyph-completion-20261007/README.md`: 45/45 unit tests, lint/build, actual pointer-drawn A/V/H/o and kerning → save → closed tab → restore → portable reopen → edit → OTF/TTF/SVG downloads in Chromium/Firefox/WebKit. Independent parser checks and fixture font-shaping/raster comparison passed. Full 85-glyph synthetic import/export also parsed. PWA/offline and real IndexedDB failure/recovery tests passed. These are fixture/platform subsets, not product quality scores.
- **Published evidence:** exact draft `6ac702c6402f6654a7134732` promoted **2026-10-08T02:44:07.429Z**; public host `https://glyph-studio-610.netlify.app`; 21 manifest hashes and post-publish font workflow/UI verified. See `publish-receipt.json`, `public-provenance.json`, `public-font-workflow.log` there. Normal PR1/PR2 merges; absence of configured remote checks was not labelled a CI pass.
- **Boundaries:** physical touch/pressure devices, Windows/Linux, actual installed desktop font hosts/Figma, manual screen reader and broad stress/privacy coverage unverified. OTF kerning unsupported/documented; TTF is the tested kerning path. No Brand Kit or Locker qualification inferred. Generic “all fonts, all apps” promises would outrun proof.
- **Target-app evidence is missing:** an independent font parser and browser text shaping are meaningful export evidence, but are not an actual Figma/Adobe/Canva/OS font-install/import test. Any chosen buyer workflow needs a real supported destination import/use check. Do not describe the fixture raster result as Figma compatibility.
- **Monetization boundary:** existing free drawing, metrics, kerning, OTF/TTF/SVG exports, offline use and project/recovery features cannot simply be moved behind a paywall. A future paid offer would need genuinely additional demonstrated value and qualified fulfillment; batch/team/template/service hypotheses are not verified needs or authorization to build/sell here.

### Embedded Glyph — separate Luma module

- `luma-E/app/studio/glyph-dialog.tsx` imports `app/engine/glyph-font.ts`, supports drawing/OTF/TTF, local project storage and installing generated fonts into Luma. This is **not the standalone deployed candidate** and does not inherit its newer corruption/recovery qualification.
- Freshly inspected `loadStoredProject()` catches malformed draft errors and starts fresh; it is an observed source behavior, not an executed loss repro in this audit. It reinforces why standalone fixes must not be assumed present in embedded Glyph.
- Existing **P08** covers generated-font/Brand Kit outputs and licensing/reopen distinctions. Do not launch a duplicate “font maker” build or claim Brand Kit paid readiness.

### Split — actual AI separation, not a mute trick

- **Input → output:** one audio song (UI limits 10 minutes/100 MB) → four inferred vocals/drums/bass/other stereo WAV stems → preview/solo/mute/levels, WAV/ZIP download, or StemDeck handoff. Original mixed track is retained muted for A/B.
- **Direct source proof:** `src/utils/stemSeparatorEngine.js:1` imports `DemucsProcessor` from `demucs-web`; `init()` loads a model; execution providers are WebGPU/WASM with CPU retry; `process()` calls `this.processor.separate(left, right)`. `stemSeparatorModel.js:3` pins the HTDemucs ONNX Hugging Face revision and SHA256-verifies its bytes. Worker/client offload real inference. The model is approximately 172 MB; offline UI notes another 28 MB runtime.
- **Do not conflate workflows:** `src/labs/split/StemMixer.jsx` mute/solo operations act **after** inferred output exists. Muting existing prepared stems is a mixing operation, not evidence of separating a mixed song. Stereo center extraction/cancellation is a different DSP operation and would not establish four semantic stems. The inspected Split inference call chain is HTDemucs, not center extraction. No audio-quality pass is inferred just from model wiring.
- **Readiness:** prior source/interface audit confirms public `/studio/split` renders and documents model/cancel fixes. Historical `docs/SPLIT_RECOVERY_2026_10_06.md` has decode/start deadlines and late-result protection; reuse, do not rewrite as a new discovery. This audit did not download/run the model, assess reference stems, or verify public artifact parity.
- **Gaps:** dense-mix bleed/artifacts expected; CPU latency and low-memory/mobile performance unqualified. `SplitPage.jsx:31` explicitly says results are not saved. Real current separation → four finite nonblank independently parsed WAVs → listened/reference comparison → handoff and durable recoverable results remain existing **PROGRAM18-SPLIT-SESSION-001** work. Sattari source/deploy drift and O02 release gates apply.

### Key & BPM

- **Input → output:** batch local audio → detected musical key, Camelot code, BPM/confidence/status → CSV and versioned portable measurement report. Report contains metadata/results, **not source audio or a reanalysis project**. Uses existing local audio analysis/beat tracker and worker; no hosted inference in inspected path.
- Candidate `src/labs/keybpm/keyBpm.js` declares 200-file/200-MiB file caps and content-aware duplicate detection; synthetic 600-second boundary accepted, 601 rejected per browser report. Rough tempo is labelled; half/double-time ambiguity and true musical accuracy require honest treatment.
- Prior exact-candidate evidence in `../../release-program/reports/key-bpm-20261007/README.md`: 2249 full-suite tests, 35 targeted, types/build/lint, actual decoded synthetic C-major/120 BPM and A-minor/100 BPM, silence/malformed rejection, CSV/report fresh-context roundtrip and 20-file Stop/Resume. Three engine core/report workflows passed. AIFF unsupported in tested decoders; WebKit M4A/AAC failed and is not claimed universal codec support.
- **Freshness correction:** initial remote attempt failed a real shared StemDeck scheduler soak; unchanged rerun passed Node22/24 exact-head gates. The report's final “CI attempt2 settled” and registry nested `remote_ci.attempt2` supersede stale `remote_gate_status=PENDING`/queue “check run” text. PR31 remains **open/not merged/not deployed**, with source/live stack/provenance dependency O02 unresolved. Do not repeat the CI rerun or conflate green CI with release readiness.
- Real labelled music-corpus accuracy, actual mobile/Safari, full accessibility/performance/privacy remain unqualified. Existing **PROGRAM18-KEYBPM-001** owns continuation.

### Captions

- **Input → output:** local talking audio/video (UI up to 15 minutes), or existing SRT/VTT → local Whisper timed text → hand-corrected words/styles → SRT/VTT, ScenePilot cut JSON, or real-time caption-burned WebM.
- Source `tools/src/captions/main.tsx` and `app/transcribe.worker.ts`: Whisper tiny/base English or tiny multilingual, approximately 40–80 MB download, transformers.js from CDN, local WASM default / experimental WebGPU fallback. No server speech inference in this path.
- **Not a polished MP4 clip-delivery product yet:** burn-in is audible real-time MediaRecorder WebM without duration/seek index; some players cannot scrub, ScenePilot analysis wants MP4; no MP4 export here. Whisper tiny/base accuracy and word-timing correction matter. GPU is not automatically faster (source historical example was slower on a short clip; not a current benchmark).
- Latest source inventory: async media replacement has a plausible stale-decode race; controlled repro still needed. Component-local state plus SRT/VTT is not complete authored media/style/timing restoration. Current end-to-end real speech/edit/reopen/output proof not present. Reuse **PROGRAM18-CAPTIONS-LIFECYCLE-001**, not a new tool task.

### Reframe

- **Input → output:** local video → frame samples, face detection (self-hosted BlazeFace) or motion-saliency fallback + scene cuts → smooth crop path/manual subject corrections → reframed rendered video or crop-path JSON/ScenePilot handoff.
- Source `tools/src/reframe/analyze.ts`: 6-Hz samples, local mediabunny decode, canvas statistics, face selection. This is a deterministic/local vision workflow, not general semantic story understanding. WebCodecs / real-time MediaRecorder export paths have actual browser limits.
- Inventory found no same-tool import/reopen for exported crop path, no automatic source-media carryover on handoff, and overlapping analysis/face-toggle may replace authored state. Controlled race repro and independent moving-subject output tests needed. Real-footage detection quality remains unqualified. Existing **PROGRAM18-REFRAME-LIFECYCLE-001**.

### AutoCut

- **Input → output:** local song plus clip/take files → beat/downbeat/section estimates and tiny-frame quality/face cues → generated hard-cut montage with manual locks/slips/offsets → MP4/H.264/AAC where encodable, otherwise WebM, ScenePilot project, CSV or Premiere timeline.
- Source `tools/src/autocut/main.tsx` truthfully says section names are loudness/texture guesses; clip scoring does not understand content; face detection is not motion tracking. Performance take-sync uses audio cross-correlation and may choose wrong repeated chorus. No transitions/speed ramps/effects/titles in this tool.
- Local browser compute; video requires WebCodecs audio encoder, with **project export** rather than fake video success on unsupported browsers. Only media-folder hint is persisted in inspected app; cuts/locks/music/media editable restoration and real phone-media quality are unqualified. Existing **PROGRAM18-AUTOCUT-ROUNDTRIP-001**; **P07** covers Board→AutoCut handoff (Board remains excluded from implementation scope).
- All three ScenePilot tools share dirty working-tree/additive-deployment constraints; do not replace full production site with incomplete source snapshot.

### Cutout / Upscale — embedded, inference qualification still missing

- **Cutout input → output:** active Luma raster layer → duplicate with editable alpha mask → brush refinement/normal editor export. `app/engine/studio.ts:6027` preserves original and calls local MODNet (`neural.ts`, Xenova/modnet); network required initially for model assets. If model fails, code explicitly falls back to a **luminance threshold mask** and UI discloses it. This fallback is not AI object segmentation and cannot prove e-commerce-quality background removal.
- **Upscale input → output:** active raster layer → local Swin2SR lightweight x2 → preview → new layer or PNG. `app/engine/upscale.ts` tiles inference; 4× is **two 2× passes**, not an independently qualified 4× model. Fresh source sets every output pixel alpha to 255: do not promise transparent-alpha preservation without a separate test/implementation. Tiling limits per-call tensor size, not total output canvas memory.
- Source uses lazy Hugging Face model downloads/transformers.js; no cloud inference required in these functions. Model/license comments are implementation documentation, not a new commercial licensing review.
- Registry calls both local implementation/release unknown; historical Wave5/initial audit says real model output tensors unverified. Luma's newer PR6 merely repairs Upscale preview lint/image handling; that does not qualify model quality. Active Luma PR7/export/golden work and production provenance P01 remain separate. No new standalone build should compete with **CORE-LUMA-AUD-002**. Follow its owner/P01, then explicit model-quality qualification if prioritized.

## Reuse existing work; do not create duplicate ownership

- **PROGRAM18-GLYPH-001** NEEDS_REVIEW continuation: remaining platform/manual-a11y/stress/privacy qualification; already published primary subset must not be redone as if absent.
- **M03** QUEUED: verified Glyph output tutorial. Best low-build distribution asset after parent demand work; no claim that a tutorial is a paid product or customer validation.
- **W03** QUEUED: first-project activation/journey work; reuse for a narrow qualified Glyph destination workflow rather than starting a duplicate activation program.
- **P08** QUEUED: standalone vs embedded Glyph, real fonts, Brand Kit/licensing/reopen boundaries.
- **PROGRAM18-KEYBPM-001** BLOCKED + **O02** BLOCKED: source/live artifact reconciliation, not another CI retry. O02 latest task records provider function artifact mismatch, preservation of functions/schedules/live-only paths, and independent final artifact review.
- **PROGRAM18-SPLIT-SESSION-001**, **PROGRAM18-CAPTIONS-LIFECYCLE-001**, **PROGRAM18-REFRAME-LIFECYCLE-001**, **PROGRAM18-AUTOCUT-ROUNDTRIP-001** QUEUED: exact recovery/output gaps above already have durable tasks.
- **CORE-LUMA-AUD-002** RUNNING and **P01** QUEUED: active golden-workflow owner and deployment provenance; Cutout/Upscale source reuse must respect these. **CORE-LUMA-AUD-003** covers packaged performance; do not manufacture speed scores.

## Evidence index

- `PRODUCT_REGISTRY.json`, `TASK_QUEUE.json`, root `RELEASE_MATRIX.md` (company-relative).
- `reports/release18-inventory-20261007/{README.md,inventory.json,interfaces.json}`.
- `reports/release18-inventory-gaps-20261007/{README.md,source-snapshots.json}`.
- `reports/glyph-completion-20261007/README.md` and linked exact candidate/public receipts; supersedes older `reports/glyph-20261007-1910/README.md` limitations for the repaired standalone subset.
- `release-program/reports/key-bpm-20261007/README.md`, `remote-attempt2.json`, candidate engine reports.
- `reports/luma-completion-2026-10-07/README.md`, `reports/initial-portfolio-audit.md` (historical claims explicitly not promoted to current live/model proof).

No sales/preorders/public promises recommended before a specific deliverable, terms/licensing/price and automated payment-to-delivery flow qualify. This audit does not assert all18 must finish before one narrow offering can qualify, and does not require routine founder product-selection chores.
