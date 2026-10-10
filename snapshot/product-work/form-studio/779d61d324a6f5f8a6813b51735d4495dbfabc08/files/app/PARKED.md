# Parked modules

Routing reconciled at **2026-10-08** (the original refocus was 2026-07-30), the product is refocused on:

> A single direct-manipulation 3D scene backed by an exact, simple parametric modeler.

The files below are kept intact but are **no longer wired into the app**. Their
unit tests still run against them so behavior stays observable.

## Active entry point

- Web: `app/studio/page.tsx` → `app/studio-entry.tsx` → `app/cad-workspace.tsx`
- Desktop: `desktop/main.tsx` → `app/studio-entry.tsx`
- Animation / Rig Lab: `app/studio-entry.tsx` lazily opens `app/studio-v2.tsx`,
  with `animation-engine.ts`, `rig-engine.ts`, `humanoid-rig.ts`, and `pro-engine.ts`
- Fabric: `app/cad-workspace.tsx` mounts `app/fabric-studio.tsx`

Model, Fabric and Animation share one versioned `.form` project container;
CAD, Fabric and scene data retain their own workspace payload schemas. The shared
`ProjectSaveSession` preserves the saved-content baseline and project-level undo
journal across CAD ↔ Animation navigation. Switching workspaces is not a save.
Use Save to persist the complete project, including authored workspace data.

The Animation button opens the same project without automatically copying CAD
geometry into the scene. **Animate model** is an explicit reviewed mesh-snapshot
transfer; the CAD original remains editable. Linked updates and independent copies
have distinct review choices, not an implicit conversion of the CAD source.

CAD and Rig still use separately keyed native/browser recovery channels. A direct
in-memory document handoff takes precedence over startup recovery data; this does
not certify cross-channel crash recovery. Full native close/reopen and recovery
qualification are separate release gates, not implied by workspace navigation.

## Parked files

| File | Reason |
| --- | --- |
| `app/studio.tsx` | Earlier studio shell, superseded twice. |

## To un-park

1. Remove the `PARKED` banner comment at the top of the file.
2. Remove its row from the table above.
3. Add the import back into the active workspace with a clear, narrow purpose.
