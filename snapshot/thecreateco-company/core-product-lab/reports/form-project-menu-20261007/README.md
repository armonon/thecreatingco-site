# Form Project-menu repair — verified branch checkpoint

Task CORE-FORM-UI-EXPORT-001, owner form-ui-export-20261007. Isolated source code/worktrees/form-project-menu-20261007, branch fix/form-project-menu-20261007 based reviewed PR4 ea6734638f72232676985f610daac18341fcd8ca. Other checkouts preserved.

## Confirmed defect and repair
Real Chrome1440px baseline Project summary x1505 (outside viewport);1280px x1297. Equal1fr side columns plus fixed-width actions exceeded viewport despite document scrollWidth reporting no overflow (body clipping). Baseline320px Project x332 also unreachable.
Desktop grid now sizes action columns to contents and permits brand column to shrink. Compact grid specificity repairs inherited padding/gap conflicts, preserves80px Back+Form logo identity and sizes action column to all controls (including suite menu). At≤355px, three header rows keep every action/target rather than hiding controls. Fixed Project x1388 at1440px,1228 at1280px,270 at320px, all within viewport; tablet row override verified.

## Verification
- scripts/verify-project-menu.mjs: realbrowser/OCCT synthetic rectangle extrude → topbar Save download → menu Open chooser → compare persisted geometry → actual keyboard Tab/Enter STEP export → GLB download → Escape restores trigger focus. Widths1440/1280/1100/768/390/320, fine and emulated coarse-pointer layouts. No forced clicks/native mocks.
- Initial test compared JS-only undefined optional fields and-0 against JSON roundtrip; expected fixture now normalized through JSON serialization, retaining all actual persisted field assertions.
- Pinned Node22.23.2 typecheck/lint, web and desktop frontend builds PASS; full unit1527/1527, budgets15/15 PASS. Production audit0. Node26 initial run failed the pre-existing jsdom/native-localStorage harness interaction; retained node26-* logs, not attributed to the CSS repair.
- All6widths PASS in fine/coarse contexts on actual dev and built frontend (24 workflow variants), including320px popup scroll/keyboard and coarse1280. Zero pageerrors. STEP/GLB signature checks establish actual valid downloads, not independent geometry fidelity; earlier PR4 geometry evidence remains separate.
- Environment: macOS25.2arm64, Node22.23.2/npm11.19.1, Chrome154.0.8037.98, Vite8.2.1/React19.2.8/OCCT3.8.1. Web149files anddesktop28files hashed in artifact-manifests.json.
- Independent parent OpenAI/Sol review found no blocking CSS issues, conditioned on actual320px menu/coarse1280 interactions and final tests.

## Release boundary
No merge/deploy or CI retry. Mandatory Actions remain externally blocked by billing/spending; parent confirmed retry attempt2 at02:45Z ran0steps (reports/actions-retry-20261007). New outage policy: complete local exact-head checks/artifact prep and feature-branch PR; do not bypass unresolved mandatory checks.
Independent parent OpenAI/Sol review approved all3files. Committed/pushed 1e7f6d1c84a6c956ece3cfe6f74b665208bf069c; https://github.com/armonon/form-studio/pull/5 OPEN, stacked onPR4. No merge/deployment or mandatory-check bypass.

Next: continue Form/Cast public initial-render/provenance task. Read-only follow-up found both /studio hosts render content despite bodyheight0; prior audit body-visibility predicate was a false blocker. Keep original observation; qualify actual visible app controls before correcting registry.
