# Form golden workflow qualification fixture

Status: full fixture specification remains unqualified. A dated single-body browser/export subset fixture is available; it is not full native end-to-end qualification.

## Purpose

Repeatably qualify the first flagship path: Sketch → Model → Refine → Material → Save → Reopen → Export. Keep one deterministic project per supported Form version and record exact app build, platform, input/output checksums, logs and screenshots. This fixture complements, not replaces, the broader CAD, garment and animation RC matrices.

## Fixture contents

Create a new project named `Form-Golden-Workflow` in millimeters. Include:

- one fully constrained, dimensioned sketch with a closed profile;
- a body generated from that sketch and a second independently-created mesh body;
- one refinement operation with an intentional parameter edit after the initial build;
- two distinct materials assigned to distinct objects (include one appearance setting known to persist);
- a hierarchy/group relationship and a non-default view/camera state;
- no cloud dependency, external linked asset, unsupported operation or hidden recovery-only content.

Store the source sketch dimensions, expected solid/mesh object counts, object bounds/volume tolerances, hierarchy, material identifiers/values, and initial project checksum in a fixture manifest adjacent to the project once a qualified fixture is created. Do not invent fixture values before capture.

## Qualification procedure

1. Start from a clean supported Apple Silicon macOS environment and record hardware, OS, app version, build manifest/commit and whether web or native desktop target is under test.
2. Create the fixture content above through normal UI actions. Exercise selection and one undo/redo around the refinement edit; confirm redo reproduces the intended geometry.
3. Save to a named native `.form` project. Confirm save completion and that the UI is no longer dirty. Record file size and SHA-256.
4. Close the document and application completely; relaunch and reopen the saved file.
5. Compare sketch dimensions/constraint status, body count, geometry bounds and volume (within manifest tolerances), hierarchy, materials, refinement parameters and view state. Compare canonical project content/checksum rather than raw bytes if serialization metadata is expected to vary.
6. Export the refined geometry in at least one supported mesh format and STEP where the exact history is supported. Record options, warnings, output checksums, units/bounds and independent recipient-tool results. Never count file existence alone as an export pass.
7. Reopen the exported artifact in an independent reader (FreeCAD for STEP; Blender for mesh) where available; check units, dimensions/bounds, object/solid count and repair warnings.
8. Exercise recovery separately using a disposable copy: make an edit, wait for a recovery checkpoint, terminate only the disposable test process, relaunch, choose recovery and confirm it is marked unsaved and does not overwrite the named source until explicitly saved.

## Pass criteria

- No unexpected error, crash, silent data loss or undocumented manual repair.
- Sketch, refined geometry, hierarchy and material state match the captured manifest after full close/reopen.
- Undo then redo restores the exact expected refinement result.
- Exported geometry is dimensionally correct in the independent recipient app; format limitations/warnings are recorded.
- Recovery is offered with valid content and remains distinct from the last explicit save.
- Evidence is reproducible and attached to a dated report for the exact build.

## Evidence record template

| Field | Result |
| --- | --- |
| Date / operator | Not run |
| App version / commit / manifest | Not run |
| Host and OS | Not run |
| Fixture path and SHA-256 | Not created |
| Save/reopen state comparisons | Not run |
| Undo/redo result | Not run |
| Export format / recipient app / dimensional comparison | Not run |
| Recovery result | Not run |
| Logs / screenshots | None |
| Limitations / deviations | Qualification has not yet been performed |

## 2026-10-07 Pacific / 2026-10-08 UTC checkpoint

Exact candidate `1e7f6d1c84a6c956ece3cfe6f74b665208bf069c`: synthetic single-body browser-process close/relaunch/reopen and independent geometry checks PASS. [Report](../../reports/form-golden-20261008T0310/README.md), [actual project](../../reports/form-golden-20261008T0310/golden-bracket.form), [hashes](../../reports/form-golden-20261008T0310/export-verification.json). STEP native-reader solid dimensions40×40×12mm and volume19200mm³; GLB actual positions and brass properties match. This subset does not satisfy the complete fixture contents/pass criteria above. Native qualification is BLOCKED by exact supported artifact/signing/notary access; broader fixture and recovery remain agent-owned next work.
