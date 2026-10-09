# Nine-product evidence-gap inventory — 2026-10-07

Task PROGRAM18-INVENTORY-GAPS-001. Read-only source/interface inventory; no product edits, builds, installs, deployments, account changes, deletion or outreach. The only new execution is Pocket's actual pure storage helpers against a **synthetic in-memory store**. No browser/user storage touched. Existing test files are discovered, not presumed passed. Parent live observations are from `../release18-inventory-20261007/interfaces.json`; an HTTP200 and rendered controls are not a completed workflow.

Exact inspected source/branch/dirty-file inventory and SHA256 of relevant files: [source-snapshots.json](source-snapshots.json). All original dirty work is preserved. The three ScenePilot tools share an incomplete/additive source deployment; Split/Pocket share a Sattari tree with documented live overlay drift. Never publish those source trees wholesale. Excluded products/links/dependencies have not been removed.

## Priority findings

1. **Pocket P1 confirmed data-loss behavior:** 41st named save silently removes the oldest saved pattern; malformed existing storage is silently replaced on save. [Actual helper memory reproduction](pocket-memory-repro.json). No UI disclosure of the40-save limit found in PocketPage. Active implementation task PROGRAM18-POCKET-SAVE-001 (concurrent inventory duplicate PROGRAM18-POCKET-PERSIST-001 parked WAITING).
2. **Cast core availability BLOCKED/UNVERIFIED:** parent real browser could not make the review-host body visible in30seconds. This is not proven404 or an engine bug. Canonical Form and review hosts differ. Queue PROGRAM18-CAST-QUAL-001; first establish real current interface and source identity.
3. **Librarian source integration gap:** client recommendation fetch has content-type but no Authorization; server guard requires a verified Bearer session before anything else. Keep the guard; integrate account state if recommendations remain reachable. Historical reader asset404/source-deployment parity remains existing task P02. Source confirmation is not proof of current live endpoint configuration. Queue PROGRAM18-LIBRARIAN-AUTH-001.
4. **Captions/Reframe P1 correctness hypotheses:** asynchronous media decoding/analysis commits results without a generation check. Captions accepts drops even while decoding; Reframe face toggle can start another analysis while one is active. A late previous operation may overwrite newer media/target state. Needs controlled repro, not called observed data loss. Queue dedicated lifecycle/persistence tasks.
5. **Standalone editable recovery gaps:** Split explicitly keeps results only in its current page; Captions and Reframe retain authored state in React; Reframe exports crop JSON but has no observed import path; AutoCut persists only media-folder text, exports a ScenePilot cut rather than a verified same-tool project roundtrip. No full completion gate is satisfied by these exports alone.
6. **Reclaim has destructive native capabilities:** scoped trash manifests, no-overwrite restore and symlink checks/tests exist, but native quarantine→restart→restore/interruption/disk-pressure qualification remains necessary before general release. Reuse existing P05.
7. **Ghost documentation conflicts with recovery implementation:** README line40 explains IndexedDB recovery; line94 still says nothing persists after closing. Pending10-file pattern branch is not a released artifact. Preserve it and qualify exact-source original-photo/project/output roundtrips.

## Reclaim

- Source: `/Users/agentsattari/code/wave4/universal-operator-batch-kit`, HEAD54d2c34; clean snapshot. Live browser companion renders200; no desktop/phone horizontal overflow observed by parent.
- Real product split: browser file-review is **read-only**, limited SHA256 comparisons up to64MB; native app can quarantine/restore and therefore needs separate evidence. Do not infer native safety from browser render.
- Safety code: `src-tauri/src/batch_operator.rs:960–1065` prevalidates scope and manifests, stores private manifest before moves and refuses occupied restore destinations; tests around4516 and4619–4804 cover symlinks, occupied paths and manifest traversal. These were inspected, not rerun.
- Tests located: `tests/diskCleaner.test.ts`, `tests/safety.test.ts`, `tests/executor.test.ts`, Rust tests in batch_operator.rs. Declared `npm test`, `npm run typecheck`, native cargo/Tauri qualifications.
- Existing sibling report verified public0.1.1 DMG byte length/checksum, not current exact-artifact clean install. Physical Intel/macOS13 and native interruption behavior remain unverified.
- Documentation: root README still calls this a scaffold not compiled locally and lists Node18/TailwindCDN. Reconcile with current actual distribution; don't silently erase restrictions.
- Next: **P05** synthetic temporary files only, native quarantine→restart→restore with exact bytes, collision/symlink/denied/disk-full interruptions; check actual signed artifact and update docs. No real-user deletion authorized.

## Librarian

- Source: `/Users/agentsattari/code/wave4/librarian`, HEAD1ba7da4; clean. Parent live root200, no initial JS errors/overflow. This does not clear historical PDF-reader404.
- Current source stores PDF owned bytes plus metadata atomically in IndexedDB; `pdfSave` transaction commits both stores. `pdfOptions` disables eval/scripting/XFA. Electron has sandbox/contextIsolation and no nodeIntegration. These are inspected guards, not full security certification.
- Tests located: `tests/pdf-library.test.mjs`, `pdf-import-failure`, `pdf-storage`, `shelf-storage`, `navigation`, `ai-guard`. Shelf writes verify persisted value; PDF storage migration is versioned.
- Source gap: `src/main.js:623` recommendation POST sends no bearer; `netlify/lib/ai-guard.mjs:51–60` requires one and fails closed. README says offline heuristic while code calls a server model. Do not weaken guard or expose service key to fix the UX.
- Registry's previous release blocker says live proxy/functions cannot be recovered locally and required catalog credentials absent. Confirm with authorized access before a deployment; do not overwrite functioning live catalogs with a partial snapshot.
- Distribution guide describes notarized app while package build config has notarize:false. Treat it as instructions/future qualification, not current signed status.
- Next: existing **P02** reproduce real PDF import→read→close/reopen→download byte equality and restore reader assets using recovered source/functions; new auth-integration task for verified-session lifecycle and accurate docs. Local PDF use remains independent of AI recommendations.

## Ghost Studio

- Source: `/Users/agentsattari/code/wave4/ghost`, HEADbfad2ee, branchwave5/ghost-pattern with10dirty/untracked files preserved, including pattern format additions. Parent live200, no initial page errors/overflow.
- AGENTS/product contract: Add photos→Adjust→Export; assisted inferred geometry, **not** recovered measured fit/manufacturing patterns. No provider/model/service is integrated. Keep original photos and explicit provenance.
- Recovery described in HANDOFF: IndexedDB v2 stores sources/settings/outputs; writes await transaction completion, sessions separated, engine-version cache compatibility enforced. README40 agrees; README94 contradicts it by saying nothing persists.
- Tests located: collection/studio/objects/drape/precision suites plus optional actual worker/GLB integrations. Older HANDOFF has44/46 full run followed by targeted22 passes; not a fresh exact-candidate pass. No suite ran in this inventory.
- Next: freeze intended committed+pending version without discarding edits; synthetic garment/object references→adjust→save `.ghostbatch`→close/reopen→regenerate/export GLB, independent geometry/texture/source-byte comparison; quota/engine-migration/cancelled generation; reconcile recovery docs. Patterns remain inferred, not measured claims.

## Split

- Shared source: `/Users/agentsattari/code/wave2/sattari-all`, HEADa9a77e6. Parent live200, initial desktop/phone layout without overflow; mobile engine behavior explicitly untested.
- Model: pinned/SHA256-checked172MB HTDemucs download; one track up to10min/100MB; user media stays on device. No new model or uploads were executed.
- `SplitPage.jsx:31` says results are not saved. Source holds jobs/outputs in hook state; completed WAV download/StemDeck handoff is the escape route. This disclosed limitation still leaves requested save/close/reopen/recovery acceptance unmet.
- Existing `docs/SPLIT_RECOVERY_2026_10_06.md` describes60second decode deadline/immediate cancellation,45second worker-start deadline and late-result rejection; historical focused29 tests/live demo reported. Do not duplicate that fix or call it freshly verified.
- Tests located: `src/hooks/useStemSeparator.test.jsx`, model/download/worker utilities. Need real current model run and audio output verification, not just hook mocks.
- Deployment: same doc says live download/navigation differs from source and only changed modules were overlaid. Exact-source/live reconstruction required before release.
- Next: qualify real current input→decode→separate→listen→four finite nonblank WAVs→independent audio parse→StemDeck handoff; implement explicit recoverable session or approved complete portable restoration, denied/quota/cancel/retry handling. Phones remain UNVERIFIED.

## Captions

- Shared ScenePilot source: HEADfb42d12, primary tree193changes preserved; parent live `/tools/captions/`200 with rendered controls and no initial page errors/overflow.
- Workflow implemented in source: local Whisper CPU/WebGPU transcription, editable captions, style selection, SRT/VTT/ScenePilot cut and real-time WebM burn-in. Model download/inference not run in this inventory.
- `tools/src/captions/main.tsx:127–155` clears state and awaits decode, then commits PCM without token check. `onDrop:320` calls loadFile even on existing stage while a decode is pending; abortRef covers transcription but not that decode. Controlled overlap repro required before labelling an observed race.
- State is component-local; SRT/VTT restore text but not a demonstrated all-settings/media/timing/style project. Burn-in WebM limitation explicitly says no duration/seek index and ScenePilot analysis wants MP4. Full authored roundtrip/integration remains unqualified.
- Tests located: caption-words/transcribe/transcribe-client; no current end-to-end real speech+edit+reopen+independent output result.
- Next: fence/drop-cancel replacement lifecycle and preserve valid prior document on malformed input; portable editable project/recovery; synthetic/original short speech, repeated-word correction and timing/style preservation; media export sync/seek validation.

## Reframe

- Same shared dirty ScenePilot source and additive deployment guard. Parent `/tools/reframe/`200, initial layout no overflow; rendering alone is not detection or export proof.
- `tools/src/reframe/main.tsx:114–144` resets overrides and asynchronously loads/analyzes without generation fence; face checkbox246 remains enabled and starts another load. Potential stale result/authoring loss needs controlled repro.
- Export crop-path JSON exists at195–198; no same-tool import route found in that entry. ScenePilot handoff intentionally opens a tab/download and does not automatically carry source file. Do not present it as preserved editable reopen.
- Real export uses WebCodecs or real-time MediaRecorder fallback. Actual browser codec/visibility limitations require verification.
- Tests located: `tests/e2e/reframe.spec.ts` has synthetic import/analyze/export and generated-face trajectory coverage; source pure crop/path/subjects tests. No tests rerun here and no real-footage quality claim.
- Next: serialize/reopen authored crop overrides/settings with relinked source; fence overlapping analyses and preserve overrides on optional face-toggle reanalysis; compare known moving subjects/manual corrections through independent output decoding.

## AutoCut

- Same shared source/deployment risk; live `/tools/autocut/`200 initial UI. No real clip ingest/edit/export test performed by this audit.
- Source authored state includes cuts/locks/music/media and media-folder hint; only that hint is localStorage-persisted. ScenePilot JSON/CSV/Premiere timeline/video exports exist; same-tool source/locked-cut restoration is not established.
- Video requires WebCodecs audio encoder; unsupported browsers are directed to ScenePilot project export. No fake successful video fallback should be added.
- Tests located: autocut-cut/export/clips-align/music pure tests, synthetic helpers. Quality on real phone footage and locked cuts with missing media/relink remains unverified.
- Next: real synthetic-owned A/V fixtures→beat analysis→manual lock/change→save→close/reopen with relink→same timeline/audio-export verification; explicit unsupported-codec handling and cancelled-output cleanup. Preserve excluded linked tools and additive deployment assets.

## Pocket

- Shared Sattari source and deployment drift; live `/studio/pocket`200 with beat/bass/mixer/export UI. This is Pocket beat sketchpad, **not Pocket Studio** voice memos.
- `pocketPattern.js:142–166`: listSaved catches every parse/read failure and returns[]; savePattern replaces same-name entry and slices40; deleteSaved also derives from that permissive read.
- **Executed proof:** [pocket-memory-repro.mjs](pocket-memory-repro.mjs) imports unchanged helpers and stores41distinct synthetic names in a fake memory store. The oldest named record disappears with no throw. A malformed stored record is then overwritten with a new list, original bytes not retained. No real user's data touched.
- `PocketPage.jsx:95–105` best-effort draft writes silently swallow failures; named save surfaces thrown storage errors but not cap eviction. Delete button544 has no local error handler/undo. These are additional source findings requiring UI repro.
- Tests located `pocketPattern.test.js`; timing functions shared by playback/render. No actual current playback/WAV/ZIP/DAW output verification performed here.
- Next: refuse silent cap/corrupt-store destructive writes, preserve recoverable bytes, make retention policy explicit, quota/error feedback and reversible delete; verify named save→reload, draft, independently decoded loop duration/audio, stem ZIP and handoff. No user's existing patterns may be discarded.

## Cast

- Source Form HEADb5abdd1 in primary dirty11-file room worktree; local reviewed Form follow-up ea67346 exists separately (PR4) and does not establish deployed Cast version.
- Parent real-browser review host body never became visible in30sec; no page exception logged. **Availability UNVERIFIED/BLOCKED**, not a proven application404. `netlify.toml` routes canonical `/studio` to separate ChatGPT-hosted Form, not reviewhost; reconcile intended public entry and source/artifact.
- Source `app/cast-studio.tsx` accepts STL/OBJ up to200MB, reviews a copy, exports binarySTL; repair/material/wall/ring measures are estimates. Self-intersection/stone-seat/sprue/alloy behavior explicitly excluded.
- Tests located `tests/cast-prep.test.mjs` and Cast case in workspace-smoke. Sibling Form ea67346 run includes their passing synthetic/jsdom evidence; no actual current Cast UI/header/render/export verification from the live host.
- Next: recover actual public editor entry/provenance, then synthetic known-size rings/closed+hollow meshes, malformed/nonfinite/oversize inputs, units/scale/repair undo/reopen and independently parsed STL. Keep honest alpha scope; do not invent manufacture-certified completion.

## Release status and exact dependencies

None of these nine is newly merged, deployed or declared complete by this inventory. Native signing/clean machines, external recipient/hardware qualification and unrecovered live functions require separate access/evidence where applicable. Most persistence/race/navigation gaps are **implementation work**, not excuses to stop on missing access. First-wave priorities remain Bounce/Pocket Studio/Key & BPM/Glyph; queued follow-ups are evidence-ranked for subsequent execution. No new public-post or payment permission inferred.

## Durable queue handoff

- Pocket implementation owned by another worker: PROGRAM18-POCKET-SAVE-001; this audit handed over exact source/helper reproduction and did not edit its source. Concurrent unclaimed duplicate PROGRAM18-POCKET-PERSIST-001 parked WAITING, not falsely completed.
- Existing tasks P05 (Reclaim native safety) and P02 (Librarian reader/deploy gap) enriched, not duplicated.
- Seven additional P1 follow-ups enqueued: PROGRAM18-LIBRARIAN-AUTH-001, PROGRAM18-GHOST-ROUNDTRIP-001, PROGRAM18-SPLIT-SESSION-001, PROGRAM18-CAPTIONS-LIFECYCLE-001, PROGRAM18-REFRAME-LIFECYCLE-001, PROGRAM18-AUTOCUT-ROUNDTRIP-001, PROGRAM18-CAST-QUAL-001. Source hypotheses remain marked as requiring controlled reproduction.
- All9 product inventories completed as bounded read-only investigation. **No product completion gate newly passed** and no production action taken.
