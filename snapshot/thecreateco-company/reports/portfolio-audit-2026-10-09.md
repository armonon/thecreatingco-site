# Portfolio source-evidence audit

Generated: 2026-10-09T14:24:34+00:00

This is a deterministic source inventory, not a user-experience or release qualification. A present directory or build script does not prove a working/live product.

Registered products: **45**. Maturity inventory: ALPHA 29, IDEA 4, PROTOTYPE 8, UNKNOWN 4.

| Product | Maturity | Local source | Standard scripts | Git HEAD | Existing evidence |
|---|---|---|---|---|---|
| Animate | ALPHA | package.json | build, test, typecheck | 11ccaca | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Auto Pitch | ALPHA | no package.json | — | 08b7ad4 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| AutoCut | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Board | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Bounce | ALPHA | no package.json | — | c85ec72 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Brand Kit | IDEA | path absent | — | — | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Canvas | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Captions | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Cast | ALPHA | package.json | build, test, typecheck | b5abdd1 | PUBLIC_BINARY_WORKFLOW_AND_EXACT_CANDIDATE_ASCII_WORKFLOW_SUBSET |
| Clean | PROTOTYPE | package.json | build, test | 702a6f9 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Community | UNKNOWN | path absent | — | — | LIVE_READ_ONLY_UI_AND_PUBLIC_CLIENT_INSPECTION |
| Cutout | PROTOTYPE | package.json | build, test | e709a16 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| FileLab | IDEA | path absent | — | — | FOUNDER_DIRECTION_ONLY |
| Form Studio | ALPHA | package.json | build, test, typecheck | b5abdd1 | EXACT_SOURCE_BUILT_BROWSER_SUBSET_AND_INDEPENDENT_DOC_REVIEW |
| Ghost Studio | ALPHA | package.json | build, test | bfad2ee | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Glyph (Luma embedded) | ALPHA | package.json | build, test | e709a16 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Glyph Studio | ALPHA | package.json | build, test, typecheck | bc6b6d0 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Grade | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Key & BPM | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Librarian | ALPHA | package.json | build, test | 1ba7da4 | EXACT_LOCAL_AND_PUBLIC_ONE_FILE_OVERLAY_WORKFLOW_SUBSETS |
| Locker | ALPHA | no package.json | — | 5515c3e | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Luma Studio | ALPHA | package.json | build, test | e709a16 | LOCAL_REVIEWED_CI_REPAIR_AND_PARTIAL_BROWSER_EVIDENCE |
| Lyric | PROTOTYPE | package.json | build, test | 702a6f9 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Mockup | ALPHA | package.json | build, test | e709a16 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Moodboard | PROTOTYPE | package.json | build, test, typecheck, e2e-check | b2a54d1 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Pattern | IDEA | path absent | — | — | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Pocket | ALPHA | package.json | build, test | a9a77e6 | REVIEWED_LOCAL_SOURCE_AND_EXISTING_ARTIFACT_CHROMIUM_PARTIAL_QUALIFICATION |
| Pocket Studio | UNKNOWN | path absent | — | — | PUBLIC_GUEST_UI_AND_ANONYMOUS_AUTH_BOUNDARY_ONLY |
| Portfolio | PROTOTYPE | package.json | build, test, typecheck, e2e-check | ae9a10e | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Press | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Reclaim | ALPHA | package.json | build, test, typecheck | 54d2c34 | LIVE_HTTP_AND_DOWNLOAD_DIGEST_ONLY |
| Reframe | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Room | PROTOTYPE | package.json | build, test, typecheck | b5abdd1 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Sattari Audio | ALPHA | no package.json | — | 08b7ad4 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Sattari Key | ALPHA | no package.json | — | 08b7ad4 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Sattari web platform | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| ScenePilot | ALPHA | package.json | build, test | fb42d12 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Script | IDEA | path absent | — | — | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Sessions | UNKNOWN | path absent | — | — | PUBLIC_GUEST_UI_AND_ANONYMOUS_AUTH_BOUNDARY_ONLY |
| Split | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| StemDeck | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_BUILD_TEST_AND_SYNTHETIC_BROWSER_SUBSET |
| thecreateco website | UNKNOWN | no package.json | — | 5515c3e | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Thumb | PROTOTYPE | package.json | build, test | e709a16 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Upscale | PROTOTYPE | package.json | build, test | e709a16 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |
| Vox | ALPHA | package.json | build, test | a9a77e6 | LOCAL_SOURCE_AND_HISTORICAL_REPORTS_ONLY |

## Review boundary

Next review layer: execute only the scripts that actually exist, then inspect the core user workflow and current deployed version separately. No claimed production status has been inferred from this inventory.

## Runnable project checks

| Source directory | Command | Result | Final output line |
|---|---|---|---|
| animate | npm run test | FAIL (127) | sh: vitest: command not found |
| scenepilot-autocut | npm run test | FAIL (127) | sh: vinext: command not found |
| sattari-all | npm run test | FAIL (127) | sh: vitest: command not found |
| form-D | npm run test | FAIL (127) | sh: tsc: command not found |
| sattari-lyric-clean | npm run test | FAIL (127) | sh: vitest: command not found |
| luma-E | npm run test | FAIL (127) | sh: vinext: command not found |
| ghost | npm run test | FAIL (1) |   } |
| glyph-studio | npm run test | FAIL (127) | sh: vitest: command not found |
| librarian | npm run test | FAIL (1) |   'test failed' |
| moodboard | npm run test | FAIL (127) | sh: vitest: command not found |
| portfolio-studio | npm run test | FAIL (127) | sh: vitest: command not found |
| universal-operator-batch-kit | npm run test | FAIL (127) | sh: tsc: command not found |

## Findings

1. **Portfolio is the only registered web-site builder.** It is a local prototype with source and standard checks, not a general web/code design environment. There is no dedicated web/code design product in the registry.
2. **The code portfolio is concentrated in 12 repositories.** Those repositories cover 35 of the 45 products; shared suite repos correctly account for multiple modules. Ten registry entries have no local source path, including the new FileLab concept.
3. **This machine cannot currently qualify 10 of the 12 runnable repositories.** Their test commands stop because their local dependencies are absent (`vitest`, `vinext`, or `tsc`). This is an environment/dependency gap, not evidence of a product regression.
4. **Librarian has two test files blocked by missing packages** (`vite` and `fake-indexeddb`) while 20/22 executed subtests passed. It is not a clean test run.
5. **Ghost's visible test cases passed through the functional suite reached during the command**, but the bounded command did not return a final exit status in the captured window. It remains unqualified pending a completed run.

## Recommended order

1. Reinstall/restore locked dependencies in each source directory before treating any test command as a quality signal.
2. Re-run exact `test`, then `build`/`typecheck` where available, one repository at a time with independent evidence.
3. Qualify the four flagship golden workflows before allocating product engineering to FileLab or a new web/code app.
4. Treat a web/code design app as a future validated concept; Portfolio can inform its export and local-first architecture but is not its substitute.
