# Glyph standalone completion/release evidence — 2026-10-07 Pacific

## Source and scope
- Task PROGRAM18-GLYPH-001, owner glyph-completion-20261007. Isolated worktree /Users/agentsattari/code/worktrees/glyph-completion-20261007; source branch fix/glyph-recovery-qualification-20261007.
- Reviewed/tested source **a3e50fa6d5fabdf499fd1592085c54d9710e42dc**. PR1 and PR2 merged normally; merged main **0feefc7785d356f1862f23a96162bfd69f4d872e** has identical tree **145ab3e2950e1448367ebf49c68b57ab9ba5413c**. PR2: https://github.com/armonon/glyph-studio/pull/2 . No configured remote checks; absence is not CI PASS. Parent retained merge receipts in reports/glyph-release-merge-20261007.
- Scope explicitly standalone editable font workflow. Existing dirty Brand Kit checkout untouched; native/Brand Kit expansion excluded by parent. Optional Locker/suite integration was blocked in browser fixtures to prove standalone operation; no Locker qualification claim.

## Defects repaired and independently reviewed
1. Unreadable autosave no longer silently becomes a fresh blank project that overwrites recovery data. Real IndexedDB baseline reproduced loss (recovery-baseline.log).
2. Strict preservation validation rejects semantic corruption that permissive normalization would discard: null/missing glyph container, unsupported authored characters, corrupt points/pressure widths/advance/kerning/metrics. Applied to autosave and portable import. Stored raw record remains untouched; explicit legacy Luma schema migration retains strokes/metrics and permits missing newer kerning/smoothing fields.
3. Recovery pauses writes but permits drawing and portable backup. Confirmed retry protects current work; transient rejected DB open can retry. Async import/recovery fences prevent delayed reads replacing newer edits. Browser beforeunload protects pending/failed writes where the browser supports it; not crash durability.
4. Actual axe findings fixed: invalid tab ARIA, keyboard tab navigation/panel association, missing kerning control labels and contrast failures. Existing published heading/hero/CTA CSS overlay ported into source, not rolled back.
5. Docs explain storage limits/recovery/backup, supported export limits and qualification scope.

Independent OpenAI/Sol parent review first found the semantic-normalization issue; final source including strict validation/a11y/live-overlay fix approved with no remaining blocking findings. See independent-review.md. No Claude.

## Exact-source test results
- npm test **45/45 PASS**, five files; npm run lint PASS; npm run build (TypeScript/Vite/PWA) PASS; git diff --check PASS.
- npm run recovery-check PASS: real synthetic IndexedDB unreadable + semantic-corruption preservation, failed/successful recovery, portable backup, malformed/semantic imports, late import versus newer Clear action, keyboard tabs; no unhandled page error.
- npm run autosave-check PASS: quota warning, truthful pending/saved/failed state, failed/successful retry, no-op handle behavior, Undo/Redo, portable close/reopen and exact persisted bytes.
- npm run smoke PASS: OTF parser, routes390px, zero app console errors. npm run pwa-check PASS: offline editor, draw/export and repeated reload preserves autosave.
- npm run svg-sheet-check in **Chromium, Firefox and WebKit PASS**: real pointer-drawn A/V/H/o, AV kerning, Save→closed tab→autosave restore→portable reopen→edit→Undo/Redo exact state→actual OTF/TTF/SVG downloads. Independent opentype parser validates advances, outlines within1font unit and TTF kerning. Browser font shaping versus independent SVG raster **100% tolerant ink agreement** on fixture; deliberately unkerned control~65%, below99.5% pass bar. OTF kerning unsupported and explicitly documented. These percentages measure fixture raster agreement, not product quality.
- ui-check.json: automated axe WCAG2A/AA/2.1AA zero violations, zero horizontal overflow on /,/studio,/guide,/privacy at390/768/1440 (12 combinations). This is not full manual assistive-technology/device qualification.
- extended-workflow.json: actual draft Pen/close shape→Erase→Undo, advance editing and copying editable strokes PASS. Full85glyph synthetic fixture,10880points,417508project bytes, actual TTF51056bytes parsed87glyphs. Observed import62ms, Save+export76ms on this host; one observation, not a hardware-wide performance guarantee.
- npm audit --omit=dev: zero reported advisories. This is not a complete security/privacy penetration audit.
- Environment: macOS arm64; Node26.9.0, npm11.19.1; Playwright1.63 browser engines installed. No physical hardware/native/font-host compatibility claim.

## Release provenance, preparation and deployment
- Old production Netlify deploy **6ac5d2b39f450706b3f7dda1**. API commit_ref unset. Rebuilt clean bc6b6d047d4bb0c1a988b3c820a3e7c367c6e5fa and matched15/19 manifest entries byte-for-byte, including runtime JS/CSS/SW and all static resources. Two remaining old assets are retained; deployed netlify.toml retained; index differs only HTML serialization and known glyph-quality-20261006 CSS overlay. Normalized DOM comparison proves equivalence after isolating overlay (index-parity.json). Overlay preserved in source.
- A preliminary file-download attempt hit404 for deployed netlify.toml. It was abandoned without deployment; retained as nonrelease-download-attempt / prepare-release-download-attempt.py.txt. Authoritative release uses manifest hashes and reuses provider-stored unchanged files, so config/static content is not dropped.
- deploy.py checked no functions, unchanged old production ID, clean reviewed source, preserved all19old paths and added2new assets. Exact21file draft manifest verified; unchanged old assets/config remain. See release-manifest.json.
- Draft **6ac702c6402f6654a7134732** passed actual full font workflow, parser/raster checks and12route/viewport axe checks; extended primary tools/fullalphabet fixture passed. draft-proof.json records exact-source/hash evidence.
- Parent normal PR merges verified; merged tree equals tested tree. Guarded promotion published the exact verified draft at **2026-10-08T02:44:07.429Z**. Public host **https://glyph-studio-610.netlify.app**. publish-receipt.json/public-provenance.json verify published ID and all21expected hashes. Rollback ID retained; no user data/credentials changed.
- Post-publication browser verification is recorded in public-font-workflow.log and public-ui.json; final result metadata in results.json.

## Honest remaining boundaries / exact next action
The scoped standalone primary workflow and deployment are verified, not the entire18-product assignment. Do not call all-platform/full-product completion merely from these gates.
- Real Windows/Linux browser, physical iOS/Android/touch/pressure tablet and installed desktop font-host/Figma compatibility remain UNVERIFIED; require those execution targets/hardware, not more headless claims. WebKit automation is not physical Safari/iOS qualification.
- Manual screen-reader/nonvisual usability and broad worst-case/low-memory performance remain unverified. Existing accepted caps and synthetic85glyph workload are evidence subsets, not full stress qualification.
- Abrupt process/OS termination within500ms debounce or browser eviction cannot guarantee recovery; portable backup and warnings are documented. Persistent corrupt storage is preserved rather than automatically repaired; users can retain/restore portable backups.
- Optional cross-product Locker integration excluded from this standalone qualification; no new public claims or licensing metadata added. Broad privacy/security assessment beyond production audit/strict input preservation not claimed complete.
- Next owner: complete remaining target-specific qualification with actual platforms/hardware; preserve published deploy and evidence. Do not rerun fixed corruption/firstwave work from scratch.
