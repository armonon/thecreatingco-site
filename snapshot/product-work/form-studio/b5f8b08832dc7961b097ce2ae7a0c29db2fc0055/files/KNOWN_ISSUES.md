# Known issues — 0.40.0 (release qualification pending)

These limitations are release boundaries, not hidden promises.

## Distribution blockers

- Local builds are Apple Silicon only and ad-hoc signed. They are not public installers.
- Apple Developer ID credentials, notarization evidence and a clean-Mac install are still required.
- Signed automatic-update code, packaging and CI publication are implemented, but public updater builds remain disabled until the owner supplies the Tauri trust root, protected signing key and HTTPS feed.
- The repository contains a large pre-existing dirty worktree. A release tag must not be created until those changes are reviewed and committed intentionally.

## Product limits

- BIM/IFC output and large-project streaming remain experimental.
- Engineering calculations are estimates, not professional certification or FEA sign-off.
- Procedural garment avatars are fitting references, not licensed body scans or production fit certification.
- Physical garment correlation requires externally measured evidence before the release gate can pass.
- Native CAD does not yet claim complete operation parity with mature mechanical CAD systems.
- Cast (print/cast prep) is an alpha review tool. Its ring-size, wall-thickness, weight and overhang figures are estimates from a triangle mesh, and its material minimums are editable guidance values; results are for discussion with a caster or printer. It does not detect self-intersections, union overlapping pieces or generate supports.
- Windows, Intel macOS and Linux packages are not validated release targets.

## External compatibility

- Automated FreeCAD STEP and Blender OBJ/glTF checks are included.
- AutoCAD, Cinema 4D and CLO validation still requires licensed external installations and representative customer files.
- DXF/STEP exports should be independently inspected before fabrication.

## Performance

- Large CAD histories and dense cloth scenes can rebuild for several seconds.
- Open CASCADE work cannot always be interrupted until the active native operation returns.
- The desktop build contains large specialist engine chunks; startup-critical Rig Lab code is now lazy-loaded.

## Development toolchain

- The 2026-10-07 isolated source dependency repair pins Next.js 16.3.8 and resolves sharp 0.35.5 / source-map-js 1.2.2 in the lockfile. `npm audit --omit=dev` reports zero advisories for this candidate; this is not verification of the deployed dependency tree or runtime exploitability. Development-tool advisories and the existing desktop/release qualification gates remain separate; do not use forced breaking upgrades to claim readiness.
