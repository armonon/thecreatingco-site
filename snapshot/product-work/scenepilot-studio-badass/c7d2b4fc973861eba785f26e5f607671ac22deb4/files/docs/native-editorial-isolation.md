# Native editorial and object isolation increment

Scope: AppKit migration preview. This does not retire Electron Pro or establish Premiere/After Effects parity.

## Source editing

Select media → Open in Source Monitor. Scrub independently from the program, mark In/Out, then choose a destination track and program playhead. Source Out is exclusive (Mark Out includes the currently displayed frame).

- Insert on Track: splits a crossed clip and ripples that track only.
- Overwrite on Track: preserves portions outside the new range; other tracks are untouched.
- Both preserve source-rate mapping and existing fade/animation clocks on retained portions.
- Locked destinations, sub-frame fragments, invalid source ranges and affected matte links refuse atomically. Undo/redo use the document history.
- Not yet multi-track sync-lock insertion, three/four-point editing, multicam or a full source-patching matrix.

## Local AI object isolation

Select a video clip → Compositing → AI Object Isolation. Click foreground on its first source frame, Option-click background exclusions, right-click to remove the last point. Generate to a NEW `.mov` alpha sidecar.

Keyboard selection is also available: arrows move the cursor (Shift moves faster), Space adds foreground, Option-Space adds background, and Delete removes the last point. Before tracking continues, a checkerboard preview shows the actual first-frame alpha. Cancel and run selection again if the wrong object is included.

The native app packages the existing Swift Core ML helper and locally staged SAM2 Tiny / ViTMatte weights with license notices. No cloud upload, browser inference, JavaScript service or Electron runtime is involved.

Each bake owns a persistent inference process and session memory. It processes the selected source span, writes a ProRes 4444 alpha-only sidecar, and wraps the original media plus alpha provider in a transparent native composition. The composition appears in project media and can be reused; outer transforms, effects, masks, timing and audio remain on the instance. Original media are not modified. Undo removes the document edit but deliberately keeps the generated sidecar.

Inference and encoding run off the main actor. Each inference has a 120-second deadline; cancellation terminates the helper and removes only this job's temporary files. A destination created during generation is never overwritten. Media memory is bounded to one frame; inference is capped at 2048 pixels per dimension and 18,000 output frames per job. Source color is not re-encoded—the sidecar stores coverage only.

Alpha inference uses a disk-backed scratch cache before starting the encoder, bounded to 8 GiB with a free-space check. This avoids keeping an idle encoding session open throughout slow inference. Publication uses an atomic no-replace move.

Limitations: initial-frame prompts only; no correction-keyframe UI yet. Tiny-model masks can drift on occlusion, scene changes, connected props and hair. Existing custom feature-memory propagation is not a claim of full upstream SAM2 video-model equivalence. Full-shot human inspection and long-video benchmark qualification remain required. Sidecars must accompany the project; relink missing sidecars as media.

## Existing Pro documents

Review Existing Pro Project has three paths: close, linked media only, or explicitly acknowledged Editorial Rebuild. Rebuild imports linear picture cuts, frame/aspect settings, flips and overlay scale/opacity plus original main audio. It does **not** reproduce global/clip effects, transitions, color, audio mixing/editing, automation, titles, motion or track blending. It refuses referenced nested compositions, reverse, time remap and unavailable referenced media. This is not render-parity or lossless interoperability.

Canonical `videoClips` take precedence even when empty; older cut/placement arrays are fallback only. The source document is retained byte-for-byte, including unknown extensions, and can be recovered to a new filename. Native save never overwrites a legacy document.

File → Collect Project + Media creates a new portable folder, including AI sidecars. Files are copied off the UI thread; the folder appears only after the entire copy succeeds. Native documents use safe `Media/filename` references within a collection, resolve them on open, and keep them relative when saved again. Moving the entire folder is supported. Missing sources abort collection; current working media and document are unchanged. This does not collect media referenced only by the opaque archived Pro document.

## Validation

- Run `SCENEPILOT_ISOLATION_QA_ROOT="$PWD" npm run native:test` to include the local Core ML sidecar integration test (requires staged models and the existing `native-people.mp4` QA fixture).
- Run `npm run native:build` for the ad-hoc-signed local app with packaged helper/models.
- Interactive gates: source marks/insert/overwrite/undo; foreground/background point selection; progress/cancel; generated composition preview/export; save/reopen; missing-media relink; explicit legacy rebuild acknowledgement.
- Do not call this a complete native Pro release or universal legacy compatibility on the strength of synthetic or short-shot tests.

### Verified in this increment

- 106 native tests passed, none skipped, including real Core ML inference, alpha decoding, native composition MP4 export and save/reopen. Latest full run: 92.7 seconds on the development machine; not a product speed guarantee.
- 768 JavaScript quick tests passed; TypeScript/lint and production web build passed.
- Native 0.3.0 local build passed signing verification and the no-Electron/no-JavaScript-runtime binary check.
- Actual AppKit interaction: real-media source monitor, first-frame source Out/insert, undo/redo; pointer and keyboard foreground/exclusion placement; cancel during inference without publishing output; first-frame alpha review; accepted subject composition in Project Media/timeline tabs; save; collect source plus sidecar; reopen the portable collection and restore preview.
- The first-frame UI fixture isolates the selected woman, but visible edge contamination remains around parts of her hair/clothing against black. This is workflow validation, not a claim of perfect matting or long-shot temporal quality.
- Optimized Core ML tensor reads retained byte-identical decoded alpha on the three-frame fixture: 2,764,800 bytes, SHA-256 `6de5998da0896859c155342e0a63b1bcb608cca7e8d508065b0c5159510c697c` before and after optimization.
- Legacy conversion/refusal, source overwrite and moved-collection round trips have automated coverage; their complete interactive acceptance matrix is still pending. No full viewport/accessibility audit or long-video identity benchmark is claimed.

### Next native milestones

1. Correction anchors and refinement controls for difficult object edges, with long-shot identity/occlusion benchmarks.
2. Expand explicit legacy conversion one feature at a time with paired render fixtures; retain refusal/warning behavior for unsupported data.
3. Multi-track sync-lock insertion/source patching, proxy-aware editing and longer mixed-media export qualification.
4. Notarized distribution and release qualification after feature/compatibility gates pass.
