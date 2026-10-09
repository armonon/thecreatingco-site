# Core Product Lab — Initial Product Health Report

Date: 2026-10-07 (America/Los_Angeles). Scope: ScenePilot, Luma, Form, StemDeck.

## Decision

Golden-workflow reliability is the first milestone. No new apps. No numeric product scores are defensible yet; all four remain unqualified for the professional-readiness claim in the brief. This is an initial source/build/test/UI audit, not a completed four-product release qualification.

## Fresh findings by product

### ScenePilot

- Isolated source fb42d12: site build, typecheck/lint and 1,091/1,091 tests pass. Synthetic engine benchmark passed; not real-footage or multi-hour performance proof.
- Accessibility audit reproduced invalid tablist children and insufficient contrast. A two-file isolated repair passes the same three-state audit; reviewable diff saved, not merged.
- Production dependency audit reports one critical and two high advisories; deployed route reachability unverified. Existing checkouts include substantial uncommitted work and source divergence; untouched.
- Golden Import → Edit → Composite/Animate → Audio → Save → Reopen → Export fixture protocol written. Complete Lite/Desktop lifecycle, packaged recovery and independent export qualification remain open.

### Luma

- Source e709a16: web build and four rendered checks pass. Engine tests: 1,372 passed, one failed, ten skipped of 1,383.
- Failure is a hard-coded sibling Form-repository path in a cross-app contract test, not demonstrated user-document corruption. Three high production-dependency advisories need scoped repair.
- Local Chrome UI opened and screenshot inspected. Release evidence checker reports 1/10 gates; this is not a 10% health score. Cargo is unavailable, so Rust/native checks did not run.
- Full Import → Edit → Layers/Masks → Save → Reopen → Export, independent compatibility corpus, packaged recovery/performance and live-source reconciliation remain unqualified.

### Form

- Clean source b5abdd1 audited separately from dirty feature work. Web build and typecheck pass; Latest durable Node22 run: 1,518 passed and eight workspace-smoke failures of 1,526 (initial run had nine failures). Seven repeated failures are ambiguous status queries; one expects a legacy texture archive field. A current-field round-trip check passed; no texture data loss is claimed. Test repairs remain queued.
- Source labels conflict (ALPHA registry / beta README / older RC notes); maturity is not promoted from a README. Production audit reports one critical and two high dependency advisories, with exploitability unverified.
- Model workspace visually inspected in local Chrome with software WebGL. This does not qualify Fabric/Animation, native CAD, licensed recipient tools or clean installation.
- Sketch → Model → Refine → Material → Save → Reopen → Export protocol written; CAD/Rig history/recovery handoffs, independent exports and fresh performance budgets need actual qualification.

### StemDeck

- Baseline 8c06f81: Node22 2,233/2,233 tests, build and types pass. Default Node26 caused storage-harness failures; those are retained separately, not counted as browser-app defects.
- Real browser synthetic reconstruction/reload/export subset passes: reopened PCM is identical; master error 6.33e-8 (<2e-6); ten aligned stems. Arrangement browser harness: 13/13. UI/export checks pass at 1440, 615 and 390 widths.
- Complete real perform → capture → replay → arrange → save/reopen → export is still unqualified. Existing action-support matrix is not fully qualified; physical hardware, real-time long sessions and full-process recovery remain open.
- First security repair executed: local commit 278e087 upgrades only proxy-addr and source-map-js patch versions. npm audit now reports zero advisories; post-fix serial Node22 suite 2,233/2,233, build/types and three-width UI/export checks pass. Independent Sol review completed. Not pushed or deployed.
- An initial post-fix test failure was preserved. Deterministic review reproduced a 15-minute clock-boundary flaw in the unchanged throttle test; test-only stabilization queued separately. No authentication implementation change or proven auth defect.

## Unified priorities

One authoritative company queue, not four competing roadmaps. Severity first, then estimated impact/workflow value/confidence versus effort/risk. Candidate estimates are not measured quality scores. Duplicates merged; no padding to 200 speculative tasks. Known hypotheses, historical reports and fresh failures stay distinguishable.

- P0 · CORE-STEMDECK-SEC-001 · NEEDS_REVIEW: Patch CI-blocking proxy-addr and source-map-js advisories without broad dependency upgrades
- P0 · CORE-SP-SEC-001 · QUEUED: Patch and triage vulnerable production dependency versions
- P0 · CORE-LUMA-AUD-005 · QUEUED: Resolve production dependency advisories and verify runtime exposure
- P0 · CORE-FORM-AUD-SEC-001 · QUEUED: Triage current production dependency advisories
- P1 · CORE-STEM-AUD-006 · QUEUED: Qualify process-crash and storage-exhaustion recovery
- P1 · CORE-FORM-AUD-WF-001 · QUEUED: Qualify Sketch-to-independent-export golden workflow
- P1 · CORE-STEM-AUD-002 · QUEUED: Qualify real perform → capture → replay → arrange lifecycle
- P1 · CORE-SP-RECOVERY-001 · QUEUED: Qualify abrupt-exit, disk-pressure, and missing-media recovery journeys
- P1 · CORE-STEM-AUD-003 · QUEUED: Measure long-session audio deadlines and memory
- P2 · CORE-FORM-AUD-REL-001 · QUEUED: Reconcile release maturity and evidence date
- P2 · CORE-SP-WORKFLOW-001 · QUEUED: Qualify complete generated-media golden workflow in Lite and Desktop Pro
- P2 · CORE-LUMA-AUD-002 · QUEUED: Qualify current-source import-through-export golden workflow

Full queue: PRIORITIES.json. Per-product detail and scored candidate evidence: products/*.json and reports/*-initial.md. Bugs: data/bugs.json. Historical benchmark observations: benchmarks/history.jsonl. Golden protocols and actual synthetic StemDeck fixture/hash: golden-projects/.

## Autonomous operation installed

- Bounded development cycle: minute 40 every two hours, America/Los_Angeles, maximum 35 minutes per cycle.
- Daily review: 09:05. Weekly flagship review: Mondays 09:35. All three scheduler definitions were read back and verified enabled. First future scheduled runs are not claimed to have occurred.
- Existing company director now consults the lab and shared leases; unrelated new-app work is subordinate to critical flagship gaps. Existing growth operations retained.
- Sol directs; Luna performed the three parallel product audits. Independent Sol reviewed the StemDeck repair. Sonnet screenshot review was attempted but Anthropic rejected it for insufficient API credits; no Sonnet review is claimed. Opus not invoked for routine work.
- StemDeck local development reopened by this explicit four-product instruction; unrelated Sattari/music holds, payment/access/licensing decisions, PR/CI and release gates remain.
- PAUSE file in the lab or company directory stops new cycles. No public messages, deployments or physical recording are authorized by these schedules.

## What is not complete

The first audit is recorded, but all four complete professional golden workflows are NOT qualified. Native toolchains, real media/device sessions, independent file-format recipients, current live-source provenance and source-bound release gates remain blocked or queued as described. Tests and attractive UI are not professional readiness. No unsupported 10/10 scores, fake metrics or production claims were introduced.
