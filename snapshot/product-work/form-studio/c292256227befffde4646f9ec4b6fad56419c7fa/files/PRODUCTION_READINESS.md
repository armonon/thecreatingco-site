# Form Studio production readiness

Authoritative status ledger for the shipping application. Update this file only when implementation and verification evidence changes.

## Current qualification checkpoint — 2026-10-07

**Not a qualified production release.** The dated ledger below records historical
engineering observations, not current deployed or supported-platform acceptance.
Its percentages are historical planning estimates, not a measured completion gate.
Current source work builds on security repair `b433a12` (PR #3): production npm
audit was clean at that candidate, while required remote CI could not start due
to the GitHub account payments/spending-limit restriction. No bypass is permitted.

The workflow-gate follow-up adds a named workspace status region and repairs
stale smoke-test selectors/base64 archive assertions without dropping behavioral
checks. Its imperative Three texture upload boundary preserves existing geometry,
GPU texture identity and document pixels; targeted tests cover subarray upload and
Undo/cancel snapshots. Source lint, typecheck, production web build, desktop web
bundle and 15 JavaScript budget tests pass locally on macOS arm64 / Node 22.
A synthetic real-Chrome/SwiftShader workflow imported an original SVG, resized
it to 40 mm, extruded 12 mm with the actual OCCT worker, applied brass, verified
Undo/Redo, downloaded a .FORM, closed/reopened a tab, reopened the downloaded
file and compared editable state. STEP and GLB exports worked at 1920px; independent
GLB byte decoding confirmed 40 × 40 × 12 mm and brass material parameters.
**Known blocker:** at 1440px the project actions menu overflowed offscreen, blocking
normal menu access to export. This is not complete responsive/workflow coverage.
These checks are not a signed native build, native launch or clean-install test.

Complete golden-workflow, native Rust, signed/notarized distribution, clean-machine
install/update and exact deployed-artifact qualification remain release gates.
Form's review host and canonical host are distinct; this branch is not a deployment.
Do not describe unsupported Windows, Intel macOS or Linux packages as verified.

## Historical ledger (not current qualification)

Last historically audited: 2026-08-26
Marketing entry point: `app/page.tsx`
Shipping web editor entry point: `app/studio/page.tsx` → `app/cad-workspace.tsx`
Desktop entry point: `desktop/main.tsx` → `app/cad-workspace.tsx`  
Release under audit: 0.40.0 (`garment-inference`; authoritative commit is the latest audited history entry)

## Status vocabulary

- **PARKED** — retained in source but deliberately disconnected from the shipping application.
- **PROTOTYPE** — exploratory code or UI; not a supported workflow.
- **EXPERIMENTAL** — reachable and useful for evaluation, but not dependable production work.
- **BETA** — coherent and tested, with documented validation or coverage gaps.
- **RELEASE CANDIDATE** — acceptance criteria are implemented; external/clean-machine validation remains.
- **PRODUCTION** — wired, tested, recoverable, documented, distributable, and supported within stated limits.

## Release targets

| Target | Current readiness | 100% acceptance gate |
| --- | ---: | --- |
| Internal testing/demo | 94% | All visible workflows work or are labeled; all gates green; README truthful; save/recovery dependable. |
| Closed CAD + garment beta | 77% | Signed/notarized distribution, first remote CI evidence, desktop workflow E2E, representative interchange corpus, remaining native CAD parity, complete interactive viewport, documented garment validation program. |
| Stable commercial CAD + garment v1 | 57% | Automated signed update pipeline, staffed support/legal policy, external CAD and garment validation, clean install/update/migration evidence, performance budgets and professional workflow completion. |
| Full 3D creation suite | 31% | Production CAD, garment, mesh, sculpt, materials, lights, cameras, rendering, animation, rigging, physics and scene organization sharing one project/selection/undo/command/viewport architecture. |

Percentages measure crossed acceptance gates, not quantity of code.

## Baseline quality gates

| Gate | Audited result | Required state |
| --- | --- | --- |
| TypeScript | PASS | Required on every change. |
| Web/unit tests | PASS — 1,007 tests | Required on every change. Add tests by risk, not count. |
| Native Rust tests | PASS — 35 tests | Required on every native change. CPU-heavy timing gates run serially so each engine is measured independently. |
| Native medium-workload budgets | PASS — CAD 404 ms; cloth 4,159 ms local debug baselines | Enforced at 15 seconds in native tests; expand to clean-machine release baselines and viewport budgets. |
| Production web build | PASS with large-chunk warnings | Must pass; chunk and interactive viewport budgets still required. |
| Desktop build | PASS — macOS ARM64 app/DMG | Must pass on supported release targets. |
| ESLint | PASS — zero findings | Zero errors and warnings. |
| Rust Clippy (`-D warnings`) | PASS — zero findings | Zero findings. |
| Production npm dependency audit | PASS — zero reported vulnerabilities | Automated in CI. |
| Rust dependency audit | PASS with 3 documented build-only exceptions | Automated in CI; remove Cadrum/minreq exceptions when upstream permits. Cross-platform informational warnings remain tracked. |
| macOS Gatekeeper | FAIL — ad-hoc signature, not notarized | Developer ID signature, hardened runtime, notarization, stapling and Gatekeeper validation. |
| CI definition | IMPLEMENTED — local YAML validation passed | First remote run must prove all mandatory gates and artifact upload. |
| Native launch smoke | PASS — five-second Apple Silicon process health | Expand into complete desktop workflow E2E. |

## Shipping subsystem matrix

| Subsystem | Status | Shipping/UI | Native / fallback | Verification | Known defects and required work | Production acceptance criteria | Complete |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| Project save/open | BETA | Shipping | Flushed atomic native save + previous-file backup; flushed three-generation native recovery; browser download/local recovery | Unit/native rotation, abandoned-temp and recovery tests + launch smoke | Disk-full and full UI recovery E2E remain | Save/Save As/open/restart/recovery E2E; no silent loss; explicit compatibility errors | 88% |
| Project schema/migrations | RELEASE CANDIDATE | Shipping | Shared JSON project data; explicit sequential v1–v12 migrations | Checksum/round-trip/every-version/corruption tests | Add real archived fixtures from released builds and clean-machine upgrade evidence | Versioned schema, fixtures for every supported version, backward migration tests, forward-version refusal | 86% |
| Undo/redo/history | BETA | Shipping | Web state model | React smoke tests | Full command coverage and save/reload interaction not E2E tested | Every destructive command participates; restart/reload verified; bounded memory | 70% |
| Exact CAD core | BETA | Shipping | Native Open CASCADE for supported history including rectangle/circle/polygon Draft and disconnected linear Pattern; exact Open CASCADE WASM fallback | Native + web exact-solid, dimensional polygon-frustum Draft, invalid/self-intersection and medium-workload tests | Native gaps: Revolve and topology-specific operations; external corpus limited | Native operation matrix, deterministic errors, invalid/extreme tests, topology reference policy, external round trips | 82% |
| Parametric history | BETA | Shipping | Shared model + exact rebuild | Unit tests | Regeneration failure UX and long dependency chains need stress testing | Stable dependencies, editable earlier features, downstream failures preserved and explained | 68% |
| Constraints/dimensions/units | BETA | Shipping | Shared solver | Unit tests | Large/over-constrained sketches and keyboard workflow need broader coverage | Deterministic solve, conflict diagnostics, precision corpus, undo/save/recovery/E2E | 75% |
| Assemblies/mates | BETA | Shipping | Shared deterministic solver | Unit tests | Not a full geometric assembly solver; no large assembly corpus | Supported mate types documented, conflict/DOF evidence, stable save/rebuild/export | 62% |
| Smart hardware/jewelry/linked generators | BETA | Shipping | Exact geometry output | Unit/exact build tests | Standard classes and large linked-system scaling incomplete | Validated parameter schemas, editable history, manufacturing fixtures, save/undo/export/E2E | 72% |
| Cast print/cast prep (ring size, wall thickness, mesh health, resin orientation, STL export) | EXPERIMENTAL (alpha) | Shipping, labelled alpha; read-only review dialog | Browser three-mesh-bvh ray casting; no native path | Closed-form unit corpus (plate/band/prong thickness, bore fit under rotation, hollow/overlap winding, hole caps, STL read-back by the independent importer) + workspace smoke + headless Chrome smoke | Ray sampling misses features smaller than triangles; no self-intersection check; overlapping shells double-count volume; orientation score ignores peel/suction/support marks; material minimums are guidance values | Caster-reviewed reference corpus, worker-threaded thickness for >500k triangles, self-intersection and union, slicer round trip | 35% |
| Engineering analysis | BETA | Shipping and labeled estimate | Closed-form calculations | Unit tests | No FEA; not engineering sign-off | Verified datasets, explicit assumptions/boundary conditions, no authoritative-simulation claims | 48% |
| BIM/architecture | BETA | Shipping with graph/document/exchange production gate | Connected object graph, coordinated plans/sections/schedules/quantities and IFC4 export | Unit, large-project, document-consistency, reference-corpus and independent IfcOpenShell schema/EXPRESS validation | IFC import, client-specific IDS/MVD certification, downstream authoring-app round trips and jurisdictional code workflows remain | Supported semantics defined, standards validation, external IFC round trips, reliable documents | 72% |
| CAD interchange | BETA | Shipping with explicit per-format gate | Native FORM and STEP/BREP; validated OBJ, ASCII PLY, STL, glTF and structured DXF; independently parsed IFC4 export | Unit/native round trips, malformed-input tests, topology/volume checks and external IfcOpenShell validation | DWG and USD absent; binary PLY, IFC import, certified apparel DXF and broader external authoring-app corpus remain | Published matrix and external round-trip corpus with dimensions, units, transforms, semantics and topology checks | 66% |
| Garment drafting/sewing | BETA | Shipping | Shared project model | Unit tests | Curves and production apparel conventions need more validation | Nondestructive pattern/seam editing, graded fixtures, save/undo/recovery/E2E, professional workflow trials | 68% |
| Cloth simulation | BETA | Shipping | Native CPU PBD; worker CPU fallback | Native/web solver tests + 324-vertex six-second stability/performance gate | No physical validation; dense multilayer and calibrated fabric corpus incomplete | Stability/extreme/long-run benchmarks, fabric calibration and documented physical comparison method | 62% |
| Avatar/imported-body fit | BETA | Shipping | Mesh import + CPU SDF | Unit tests | Scanner/body corpus and measurement validation limited | Supported-format corpus, predictable measurement edits, collision accuracy and malformed-input safety | 58% |
| Apparel interchange | BETA | Shipping export | DXF/PDF/SVG export | Unit tests | AAMA/ASTM round-trip certification pending; import absent | External apparel corpus validating scale, curves, notches, drill points, grain and piece metadata | 52% |
| Collaboration/cloud revisions | BETA | Shipping web | Authenticated D1/R2 APIs; local-first fallback | Unit/API contract tests | Desktop authenticated flow and concurrent-edit E2E incomplete | Authorization, offline/conflict/upload/recovery/delete E2E; local work never lost | 65% |
| Recipe graph/marketplace | BETA | Shipping | Local deterministic graph | Unit tests | Marketplace is local; no package sandbox or remote trust model | Validated package schema, sandbox, versioning, provenance and optional remote distribution | 48% |
| Large-project streaming | EXPERIMENTAL | Planning UI exposed | Chunk/LOD planning only | Unit tests | Geometry is not loaded/evicted on demand | Real lazy loading, bounded caches/memory, representative large-project benchmarks | 25% |
| Native GPU renderer | EXPERIMENTAL | Detached preview button | wgpu offscreen render | Native PNG test | Renders one exact mesh, not interactive complete scene | Complete active scene, selection/construction overlays, navigation, lifecycle and GPU matrix | 22% |
| Interactive viewport | BETA | Shipping | Three.js/WebGL | React smoke tests | No real browser/desktop GPU E2E or formal FPS/memory budgets | Complete scene interaction E2E, accessibility, performance budgets and failure fallback | 62% |
| Native job/cancellation | EXPERIMENTAL | Shipping job UI | Native job records; explicit `cancelling` boundary state | Native unit tests | Non-interruptible CAD work continues until OCC returns | Worker-process isolation, timeout/stale-result handling and hard interruption tests | 45% |
| Diagnostics/crash handling | BETA | Manual diagnostics export | Local native panic + frontend error capture; bounded path redaction | Compile/unit/launch evidence | No remote opt-in submission, rotation beyond latest report, or real crash E2E | Native/frontend crash capture, redacted logs, user consent, retention and support workflow | 55% |
| macOS distribution | PROTOTYPE | ARM64 DMG builds | Tauri bundle + hardened runtime + release validator | Valid ad-hoc bundle + launch smoke | Developer ID credentials absent; no notarization/stapling/clean-machine evidence; updater trust root absent | Signed, hardened, notarized, stapled, clean-machine installed and update-tested | 42% |
| Windows distribution | PARKED | Not shipping | Unvalidated | None | No build/sign/install/GPU/native dependency matrix | Signed installer, clean-machine QA, native/GPU/cloth/project compatibility matrix | 0% |
| Linux distribution | PARKED | Not shipping | Unvalidated | None | Support policy not defined | Sustainable packaging and QA matrix, or explicit community/unsupported label | 0% |
| Materials/shader editing | BETA | Shipping Appearance Studio | MeshPhysicalMaterial PBR in the active exact/mesh viewport; presets, live parameters, UV-aware interchange and material graph | Preset/normalization/migration, UV round-trip, material-graph and mounted workspace tests | Per-face assignment, complete texture asset lifecycle and cross-GPU visual baselines remain | Texture persistence, assignment model, undo/save/export and real GPU E2E | 62% |
| Lights/cameras/rendering | BETA | Shipping viewport and render workflow | Light rigs, ACES tone mapping, cameras, shadows, raster export and progressive CPU path tracer | Path-tracer, camera, graph and mounted workspace evidence | Denoising, render farm/queue operations, spectral workflows and cross-GPU golden-image corpus remain | Dependable image export, color management, crash recovery, performance budgets and external artist approval | 55% |
| Mesh modeling/sculpting | BETA | Shipping Sculpt workspace | Editable polygon meshes, component/marquee selection, direct edits, modifiers, booleans, subdivision, sculpt brushes, UV unwrap and mesh interchange | Mesh topology, selection, modifier, boolean, brush, UV and interchange regression suites | Retopology, multires sculpting, geometry repair UX and dense-production artist corpus remain | Nondestructive history, topology safety, dense-scene performance, save/undo/export and professional trials | 64% |
| Animation/rigging/ragdoll/vehicles | BETA | Shipping Animation/Rig workflows | Auto-rig classifications, skinning, IK/FK controls, keyframes, motion paths, ragdoll and vehicle simulation integrated with project state | Rigging, animation, character workflow, physics and native solver regression suites | Production deformation corpus, retargeting breadth, animation editing depth and external animator approval remain | Reliable deformation, retargeting, editing, baking/export, recovery, performance and professional trials | 58% |
| General scene composition | BETA | Shipping unified workspace | Shared hierarchy, exact and mesh bodies, cameras, lights, materials, animation and linked/grouped components | Scene graph, composition, command, save and mounted interaction tests | Large-scene streaming, collection overrides, reference linking and full desktop workflow E2E remain | Stable hierarchy/selection/undo/serialization, large-scene budgets and cross-workspace consistency | 64% |

## Immediate execution order

1. **DONE LOCALLY:** make TypeScript, ESLint, formatting, Clippy, tests and builds green.
2. **DONE LOCALLY:** add CI, dependency audits and deterministic release/package validation; first remote run remains.
3. **DONE EXCEPT CREDENTIALS:** prepare credential-driven macOS signing/notarization and document the exact secrets.
4. **DONE FOR LOCAL BETA:** add privacy-first native/frontend crash capture and user-controlled diagnostics export.
5. **BLOCKED ON OWNER TRUST ROOT/HOST:** add signed automatic updates after update keys and hosting are available.
6. Establish actual desktop workflow E2E beyond the passing launch smoke and add deterministic archived fixtures.
7. **DONE FOR V1–V12 + NATIVE ROTATION:** formalize project migrations and corruption-filtered browser/native recovery; native rotation now flushes and propagates failures, with abandoned-temp evidence. Disk-full and full UI recovery E2E remain.
8. **PARTIAL:** rectangle/circle/polygon Draft and Pattern are native. Close native Revolve and topology-operation gaps.
9. Implement process isolation for truly interruptible Open CASCADE work; current UI now reports boundary cancellation honestly.
10. Replace detached native preview with the complete interactive viewport.
11. **FOUNDATION SHIPPING:** persistent PBR finishes, light rigs, exposure, shadows and PNG output now run inside the exact viewport. Next: per-body/face materials, texture/UV assets, camera shots and render queue.

## Stable release blockers

A stable release is blocked by any launch crash, project corruption/data loss, broken save/undo/core CAD/export, serious security defect, failed signing/notarization, unsigned update execution, incompatible project migration, or severe instability in an advertised garment workflow.

## Evidence update rule

For each completed item, record:

- the user-visible behavior that crossed an acceptance gate;
- unit/integration/E2E/performance/recovery/interchange evidence;
- supported OS/hardware/format limits;
- remaining defects;
- the readiness percentage change and why it is justified.
