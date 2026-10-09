# Dedicated garment designer: pattern-first contract

Decision (Armon, 2026-10-09): build a specific garment app with **both** authored-pattern-to-3D and scanned-garment-to-3D workflows. Patterns are primary: every **accepted** scan must become an editable draft pattern, not just a photo study or GLB. A scan that lacks enough evidence for the supported construction must return `needs-input` with corrective instructions, not an invented validated pattern.

## Verified reuse boundary

- Form Studio candidate `b5f8b08832dc7961b097ce2ae7a0c29db2fc0055` has `PatternPiece`/`GarmentProject`, drawing and editing, seams, save/reopen, DXF/PDF, and cloth preview. `app/garment-inference.ts` converts supplied 2D silhouettes to editable pieces, but it does not recover hidden construction or measured scale from photos.
- Ghost Studio candidate `bfad2ee` preserves source photos and can extract bounded alpha silhouettes from prepared front/back images (`dist/engine/silhouette.js`). Its photo-derived cloth shell is a visual approximation, not a sewing pattern; `FORM_STUDIO_INTEGRATION.md` explicitly says the host integration and measured patterns are not implemented.
- The Ghost vendored Form solver is a pinned snapshot. The dedicated app must use a versioned core/interface and avoid silently diverging copied engines.

## Product contract

1. Import front/back scans, optional side/detail views, category, rights and at least one scale reference when physical dimensions are claimed. Retain original bytes, view assignments, transform/crop edits and source hashes. Validate image quality, view consistency and declared category.
2. Trace visible boundaries and landmarks in original image coordinates. Store confidence and human corrections. Resolve scale only from a recorded measurement/calibration object; otherwise keep the draft explicitly unmeasured and block print-at-scale, fit and production claims.
3. Infer a category-specific **draft pattern construction**: editable named pieces, grain, seams, openings and symmetry/assembly assumptions. Each piece and seam carries `observed | inferred | user-corrected | measured | sample-validated` evidence state and links to source view/landmarks or template assumption. An outer silhouette is not itself a finished pattern.
4. Present the pattern for correction first. Preview 3D from the current pattern, not an unrelated Ghost shell. Photo textures/ghost visualization may be displayed as a second comparison mode; changes to pattern must invalidate/rebuild dependent preview.
5. Save/close/reopen the complete project, including source photos and provenance. Export editable pattern data and DXF/PDF only with truthful scale/status labeling. Export GLB/imagery as derivative visual output, linked to the pattern revision.

## Acceptance and evidence

- A category-stratified fixture corpus records accepted, needs-input and unsupported examples. **100% of accepted scan fixtures must round-trip to editable pattern pieces** with source-linked provenance; none may end only in a mesh or image. This is a logical gate, not a promise that every arbitrary photo is reconstructible.
- Reject missing/ambiguous views, disconnected or tiny masks, inconsistent front/back scale, impossible seams and unsupported construction with specific remediation. Do not auto-accept by inventing sleeves, lining, darts, exact fabric or unseen geometry.
- Pattern-to-3D and scan-to-pattern-to-3D each pass source-preserving save/reopen and independently parsed export checks. Compare front/back/side visuals to original photos; inspect pattern seams and physical samples before manufacturing/fit claims.
- Start with a narrow construction category (e.g. simple skirt) and add tops, trousers, dresses, coats and complex details only as independently evidenced category modules. The long-term goal is all supported scanned garments, not a universal unverified reconstruction claim.

## Delivery order

1. Freeze current Form garment numerical proof and enumerate remaining physical/visual/native gates.
2. Implement versioned scan-observation → draft-pattern boundary, provenance schema and first category; prove rejection paths and save/reopen/export.
3. Build the dedicated app shell with scan and manual-pattern entry, pattern editor primary, 3D/photo comparison secondary.
4. Expand category coverage and physical validation; review PR/CI, packaged UI and deployment separately.

No public launch, merge, physical-fit or manufacturing approval is implied by this document.

## Exact-source baseline (2026-10-09)

The retained September 23 report's 0/45 numerical fit result is **not current** for Form candidate `b5f8b08832dc7961b097ce2ae7a0c29db2fc0055`. On that unchanged source, `scripts/benchmark-garment-proof.mjs --compact` completed the 45-case CPU matrix: **45/45 numerical fit-screen and engineering passes**, worst peak stretch 10.50% (trousers/female-full/walk), maximum seam gap 0.000635 mm (hoodie/male-tall/walk), maximum residual body correction 0 mm. Full result: `current-matrix.json`; incremental record: `current-progress.json`. `releaseReady` remains false, and 0/45 cases have physical sample validation. This does not prove real-body fit, a sewn sample, photo-to-pattern accuracy, packaged UI, or a public release. There is no demonstrated current numerical failure to justify changing the solver or relaxing thresholds.

## First code slice (isolated Form branch)

Draft [Form PR #10](https://github.com/armonon/form-studio/pull/10) at `d42d25caeb56550dc06ca227f38927a76dd520f1`, stacked on draft PR #9, introduces a narrow `draftSkirtPatternFromScan` boundary. Given two traced source outlines with SHA-256 IDs and an actual skirt-length measurement, it builds editable Form front/back pattern pieces and preserves `inferred-draft` source/assumption evidence across `.formgarment` save/reopen. DXF and tiled PDF exports visibly warn that scan geometry is unvalidated for cutting. Unsupported categories, absent measurement, malformed/self-crossing source and inconsistent views return `needs-input`. This does **not** yet ingest photos directly, retain photo bytes inside a project container, implement the dedicated app UI, or validate that the inferred skirt dimensions match a sewn sample. It is a first category-specific contract, not completion of the product goal.

Local verification at this head: 4/4 new scan tests; 1,531/1,531 full unit suite with `NODE_OPTIONS=--no-experimental-webstorage`; TypeScript, targeted ESLint and production web build pass. The first full-suite attempt on Node 22.23.2 failed before workspace assertions because experimental native `localStorage` collided with jsdom; application persistence was not changed. Hosted PR #10 web/macOS jobs failed **before starting any steps**. Both GitHub check annotations state: “The job was not started because recent account payments have failed or your spending limit needs to be increased.” This is an external GitHub Actions billing/spending-limit gate, not evidence of a code-test failure. PR #9 and its earlier stack remain unmerged with prior hosted checks red; no merge or deployment was made.
