# Initial portfolio audit — 2026-10-07

## Scope and confidence

Read-only inspection of local catalog, product capability records, research, wave build trackers, the current checked-in suite registry, selected source/package files, README files and latest commit metadata. No live sites were fetched, no credentials or customer feedback were opened, no existing repository was changed, and no builds/tests were executed. Historical verification results below are reported by their source documents, not newly reproduced results. This is a seed inventory, not an exhaustive company qualification.

Applicable instructions read: workspace AGENTS context and `code/wave2/thecreatingco-live/maintenance/AGENTS.md`. Its chronology matters: recent sections explicitly supersede older homepage, navigation and capability instructions. In particular, the current public company name remains **thecreateco**, domain **thecreatingco.com**, and full suite name **THECREATECO MOMENTIUM SUITE** is deliberate—not a spelling correction opportunity.

## Inventory semantics

`data/products.json` has 44 discovered entries: **13 standalone product families, 27 feature modules, 4 infrastructure/services**. This is not 44 independent apps, 44 released products, or an exhaustive count of all native plugins.

Standalone families: Form Studio, Luma Studio, StemDeck, ScenePilot, Ghost Studio, Librarian, Reclaim, Bounce, Glyph Studio, Animate, Moodboard, Portfolio, Sattari Audio. Ten have historical public-alpha evidence (the original eight, Glyph, Animate); two have local implementation but unknown release (Moodboard, Portfolio); Sattari Audio is cataloged as internal alpha. Reclaim's browser and native editions are one product family. Published alpha does not mean maturity PRODUCTION.

Embedded Luma Glyph is a child feature; standalone Glyph Studio is a distinct product with its own repo. Sattari web is a platform, not another name for the native Sattari Audio plugin suite. Auto Pitch/Sattari Key are child plugins, not two additional standalone suite counts. Locker and Company website are infrastructure. Community is listed as infrastructure and its Sessions/Pocket Studio features as modules. The catalog mentions 49 native plugins but this audit does not enumerate them individually.

Sources:
- `thecreateco-marketing/CATALOG.md` (Oct 6 early; historical mixed apps/tools count).
- `thecreateco-marketing/PRODUCTS.md` (Oct 5–6 capability snapshots).
- `code/wave4/WAVE4.md` (Oct 6–7 handoffs/deploy receipts).
- `code/wave5/WAVE5.md` (Oct 6–7 new work and blockers).
- `code/wave2/thecreatingco-live/suite/v1/apps.json` (`updated: 2026-10-07`; 26 launch entries).
- `code/wave2/thecreatingco-live/maintenance/AGENTS.md` (chronological implementation constraints).

Each inventory entry has source references, observation time, historical evidence freshness, explicit release-readiness qualification, and null quality/user metrics. Unknowns must remain unknown. A dashboard health score would be fabricated until a documented scoring method and measurements exist.

## Material reconciliation findings

1. **Marketing knowledge is stale.** PRODUCTS says no analytics and no native downloads. The current hub privacy source and maintenance AGENTS say Netlify Web Analytics enabled Oct 5, included in current plan. Current downloads/product source and Wave4 record **Reclaim 0.1.1 free notarized universal Mac alpha**. No traffic numbers were retrieved. Do not create a new analytics subscription or claim native releases for other products on that basis.
2. **The suite architecture is partly already implemented.** Wave4 reports shared suite menu, Locker, PWAs and 16 qualified Send-to targets. Old research proposals to build all these from scratch should become verification/finish tasks, not duplicate projects.
3. **Registry drift:** Animate has a Oct 6 publication receipt at `https://animate-thecreatingco.netlify.app`, but is absent from the current local shared registry. Its custom domain remains pending in the receipt. Its live alpha lacks undo/redo. Local Moodboard/Portfolio source and commits exist, but the Wave5 tracker lacks final release receipts.
4. **Librarian's core reader was reported broken:** missing PDF bundle `assets/pdf-BbVnaTMr.js` returns 404. A full replacement build also risks losing live catalog proxy functions; required provider keys are not available locally. Verify the error, then prefer a narrow asset repair if achievable while preserving functions. This audit did not reproduce the error today.
5. **Luma deployment provenance is unresolved:** Wave5 reports undocumented production deploy `6ac5b824c980d12bfaa63299`, not reproducible from inspected repo source. Later Cutout/Upscale/Thumb branch is tested locally but unpublished; real model inference is unverified. Do not automatically rollback based on an old note: inspect current source and live state first.
6. **Repository main is not a reliable production pointer.** Multiple ScenePilot/Luma/Sattari features were published by additive overlay before PR merges. A whole-site rebuild could remove live assets/functions. Preserve complete manifest, functions, headers and redirects; gate publication on current baseline parity and record rollback receipts.
7. **Form review is not Form production.** Cast and Wave4 Blender export/PWA/Locker changes are in main/review deploy, but canonical Form is on separate Sites hosting. Maintain this distinction and do not mark canonical handoffs supported from the review receipt.
8. **Qualification gaps remain:** AutoCut/Reframe tests documented only synthetic media; browser paths and real phone footage need qualification. Animate WebM less exercised. Luma new model inference not exercised with real model download. Marketing screenshot or page-load checks do not qualify these engines.
9. **Old September audio findings may have been fixed.** The native integration checkout's latest commit is Sep 29 `08b7ad4`, describing 60-minute soaks and packaged candidate qualification. Do not blindly requeue the September bypass/double-feed defects without inspecting later diffs/results.
10. **Prior scope exclusion persists:** Wave5 explicitly says skip Sattari/StemDeck/music. The new company-wide inventory is valid; automatic implementation in these workstreams is held as a scope conflict until the parent resolves the latest authorization. Inventory includes `execution_hold` for these entries. Do not silently reactivate them.

## Candidate scoring

Planning estimates only, not measured business impact. Vectors below use **I/U/C/E/R** = impact, user value, confidence, effort, risk (0–10); score = I × U × C / (E + R + 1). Strategic/urgency considerations may override. Revalidate each defect first. Scores compare this initial shortlist only. No candidate is automatically authorized to publish, spend or overwrite production.

### Ten product improvements to consider

1. Reproduce and repair Librarian PDF-bundle failure with function-preserving release plan — 9/9/8/3/3 = **92.6**. Source Wave4 S5. Verification: PDF import, render and catalog search parity.
2. Add Animate undo/redo — 8/9/9/4/2 = **92.6**. Source Wave5 known limits. Verification: drawing, erasure, layer and timeline history survives representative edits without data loss.
3. Reconcile Luma production source before another release — 9/8/9/4/4 = **72.0**. Source Wave5 A. Verification: reproducible source/deploy mapping and preserved workflows; no automatic rollback.
4. Real-phone-footage AutoCut/Reframe evaluation — 8/8/9/4/1 = **96.0**. Source PRODUCTS test caveats. Verification: representative rights-cleared corpus, export failures, sync and crop tracking failure rates, all attempted samples retained in denominator.
5. Finish Board's safe Locker open/import handoff — 6/7/9/3/2 = **63.0**. Source Wave4 registry `opens:false` and Products replacement caveat. Verification: confirmation/checkpoint before replacing existing project, supported file transport.
6. Finish recovery-safe save/export guidance for long-running browser workflows — 7/9/7/4/2 = **63.0**. Source PRODUCTS Split/Canvas/Pocket/Press storage limits; apply only to non-held scope first. Verification: explicit export and reload recovery; no false cloud-backup promises.
7. Form canonical-vs-review qualification plan — 7/8/9/4/3 = **63.0**. Source Wave4 S4. Verification: actual canonical hosting mechanism and full retained features, not Netlify review promotion.
8. Qualify Luma Cutout/Upscale with real model downloads and output tensors — 8/8/9/4/2 = **82.3**. Source Wave5 A left items; dependent on provenance reconciliation for deployment.
9. Safari/Firefox export compatibility matrix for existing video apps — 7/8/8/4/2 = **64.0**. Source Products and Wave5 Animate. Verification: supported container/codec output, audio sync, duration and fallback UX.
10. Recover Moodboard/Portfolio interrupted handoffs and perform definition-of-done checks — 6/6/7/3/2 = **42.0**. Source local commits/package files, missing Wave5 result. Avoid duplicate implementation or release claims.

### Ten website/growth improvements to consider

1. Reconcile capability/catalog/registry facts with newer release receipts — 8/8/10/2/1 = **160.0**. Immediate safe local task; prevents false public copy and duplicate work.
2. Wire existing Netlify analytics into timestamped state summaries — 8/7/8/3/2 = **74.7**. Read-only retrieval first; visitor counts are not active users; no fabricated metrics.
3. Define a minimal activation funnel per flagship product — 8/8/6/4/2 = **54.9**. Current analytics only shows traffic evidence, not onboarding outcomes; draft event definitions and privacy implications before implementation.
4. Add Animate to the shared launcher after verifying current live destination/handoff — 7/7/9/2/2 = **88.2**. Current registry omission versus Wave5 publication receipt.
5. Audit route/metadata/deployment parity across published tool pages — 8/7/8/3/2 = **74.7**. Do not overwrite historical live-only routes; older site brief is not current bug evidence.
6. Create a product-family chooser/comparison draft using registry parent relationships — 7/8/6/3/2 = **56.0**. Test comprehension; do not assert observed drop-off without data or restore user-removed homepage sections.
7. Add accurate try-first guidance to recently shipped tools — 7/8/7/3/1 = **78.4**. Reuse existing learning system; one on-demand lesson player, not extra editor embeds.
8. Audit conversion/support intake and consent-preserving feedback flow — 7/8/7/3/2 = **65.3**. Existing Netlify support form and founding-list consent are not automated campaigns; preserve fields and routing.
9. Build a release-status page source generated from canonical registry — 7/7/9/3/1 = **88.2**. Distinguish alpha/public/review/native platform/source commit; never equate notarization with quality.
10. Draft focused distribution experiments only for qualified, demonstrated workflows — 7/7/6/3/2 = **49.0**. Use true export demos and existing packs; measure resulting activation rather than produce generic volume.

## Operations priorities supported by evidence

- One canonical product/release inventory with source and freshness, plus module relationships.
- Reproducible deploy manifests, source commits, function parity, rollback receipts and per-site writer coordination.
- Durable interrupted-task reconciliation (do not restart Wave5 or September audio review blindly).
- Restore CI/build signal where historical Actions billing, preview failures or environment/toolchain baselines obscure results; current state must be rechecked.
- Timestamped metrics and feedback integration with nulls for missing data; no fake health scores, activity totals or traction rankings.

## Do not duplicate stale proposals

Locker, suite menu, many PWAs, focused product pages and cross-app handoffs already have release receipts. Animate, Moodboard, Portfolio, Cutout, Upscale, Thumb, Lyric, Clean and Room have at least source/receipt evidence, so they are not clean-sheet new ideas. Script, Pattern and Brand Kit were already assigned in Wave5; recover that work before proposing them as new apps. New opportunities should be research/validation candidates until differentiated from the existing portfolio.

## Unaudited and blocked knowledge

No current live status, analytics totals, feedback contents, search-console data, revenue, campaign outcomes, accessibility audit, native-device qualification, current GitHub PR/CI state, deep source review, or complete inventory of 49 native plugins. Not every local repo under `code/`, AgentProjects or other locations was inspected. Native audio, source functions and community internals require separate scoped review. Competitor positions, growth potential and costs remain unknown. Existing catalogs contain contradictions; registry entries reflect freshest inspected evidence but are not warranties of availability.
