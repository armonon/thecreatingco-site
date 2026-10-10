# Premiere / After Effects workflow parity

## Honest baseline — 2026-09-21

ScenePilot is **not at 100% parity** with either product. This is an acceptance
plan, not a percentage score or a promise of interchange compatibility. Feature
names and passing unit tests alone do not establish production equivalence.

There are three distinct delivery targets:

1. Browser Lite: the intentionally smaller browser product.
2. Existing Electron Pro: the broadest ScenePilot feature set, using the shared
   frame planner/painter and native helpers where supported.
3. AppKit native preview: an independent Apple-native implementation, still being
   ported. Its `.scenepilot-native` document is NOT a lossless import of the existing
   `.scenepilot.json` format. Do not retire Electron or replace its public download.

The release evidence in `release-followup-0.1.16.md` is candidate-specific historical
evidence, not a certification of every subsequent change.

## Reference capabilities

Adobe's current [Premiere feature overview](https://www.adobe.com/products/premiere/features.html)
and [editing/trimming overview](https://www.adobe.com/products/premiere/editing-and-trimming.html)
cover editorial, multicam, sound and color workflows. Its
[After Effects overview](https://www.adobe.com/products/aftereffects/features.html)
and [motion tracking](https://www.adobe.com/products/aftereffects/motion-tracking.html)
cover motion design, compositing and 3D/tracking. These define comparison categories,
not licenses to copy proprietary code, models, plugins, branding or assets.

## Engineering order and exit criteria

| Workstream | Inspected ScenePilot evidence / gap | Required acceptance evidence |
| --- | --- | --- |
| 1. Interoperable native document | `LegacyCompatibility.swift` archives original bytes and inventories unsupported content; media-only rebuild is not scene translation | Versioned scene translation; explicit unsupported-field diagnostics; open/save/reopen fixture corpus with no silent effect/audio/animation loss; old source immutable; rollback test |
| 2. Editorial precision | JS trim/selection/multicam engines exist. Native has slip/split/trim and now track-local roll/slide. Native source monitor, insert/overwrite, multi-selection, linked audio, markers remain gaps | Frame-accurate edits and source handles at each supported rate; mixed media; one-step undo/redo; lock/link semantics; keyboard and pointer tests; independent audio sync and exported cut-frame checks |
| 3. Motion and compositing | JS keyframes, graph, expressions, vector shapes, 3D/camera and matte modules exist but are not equivalent to the AE ecosystem. Native has transform/opacity keys, easing, retiming, transparent composition groups, animated rectangle/ellipse/Bezier masks, pixel alpha/luma mattes and nested group audio fades (`native-motion.md`, `native-compositing.md`, `native-animated-masks-and-fades.md`) | Independent channels/custom curves; multi-mask editing and paths over footage, native roto, titles/shapes, broader effects/LUTs; expand decoded preview/export comparisons across time, alpha edges, color spaces and nesting |
| 4. Roto and tracking | Existing Pro has learned segmentation, temporal memory and correction/cache infrastructure; no complete AppKit UI/provider port | Permission-cleared labeled long-shot corpus, including hair, occlusion, fast motion and multiple subjects; measured boundary/temporal error; corrections survive save/reload; cache eviction/recovery; native integration; blind review remains an explicit quality gate |
| 5. Media, performance and delivery | Existing Pro has proxy/PCM-worker/native-helper delivery paths. Native uses per-leaf AV tracks with a 256-expanded-clip guard; SDR and selected integer rates only | Bounded decode/cache scheduling; seeking p50/p95, dropped frames, memory and thermal soak on declared hardware; VFR/rate/color handling; native waveform/mixer/automation, proxy management, alpha/stems/queues; cancel/retry/disk-full outputs independently decoded |
| 6. Ecosystem and trustworthy release | Custom extensions are not Adobe plugin compatibility. Native is locally ad-hoc signed. Docking, accessibility and compatibility qualification remain incomplete | Supported interchange round-trip corpus; documented extension/API contracts and versioning; workspace/focus/VoiceOver tests; clean-machine offline/upgrade/recovery tests; signed/notarized exact artifact, license review, support and rollback procedures |

All six workstreams remain open. A completed sub-feature does not mark its entire
workstream complete. Third-party plugin binary compatibility, proprietary camera
SDKs, hosted collaboration and licensed ML models require separate technical and
licensing decisions, not placeholder UI.

## This increment: native adjacent edits

- Roll Out ±1 Frame adjusts the selected clip's tail and the following clip's head.
- Slide Clip ±1 Frame moves the selected clip without changing its source window,
  trimming the previous and following clips to close both edges.
- Both are explicitly track-local. Separate audio tracks do not follow implicitly;
  audio embedded in each clip follows that clip through the native media graph.
- Touching, non-overlapping neighbors are required. Missing neighbors, gaps,
  overlaps, locks, insufficient source handles and sub-frame clip lengths refuse
  the transaction without modifying the original document.
- Trimmed neighbors use edge-relative clamped fades; the slid clip keeps its
  original fade envelope. Static transforms/effects are preserved.
- Edit menu, contextual menu, inspector and keyboard share the command registry.
  Roll: Command–Option–[ / ]. Slide: Command–Option–Shift–[ / ].
- Does not add roll/slide drag tools, multitrack sync-lock or linked-selection editing.

Validation: `npm run native:test` passed all 46 Swift tests with generated media
enabled; native production packaging and local signature checks passed. Direct
AppKit checks opened the generated red/blue/red project, selected its middle clip,
slid 0.600→0.633 seconds while holding duration/source-in, rolled its tail to 0.633
seconds, and verified one-step undo, the keyboard slide shortcut, right-click roll,
and disabled controls on a locked track. All QA edits were undone. This is one
window-size interaction check, not the full accessibility/viewport matrix.
Core tests cover all supported frame rates,
source rate mapping, invalid edits, fade semantics, serialization and undo/redo.
The media test checks changed cut pixels and an independently decoded MP4 at four
sample times. These generated short clips do not replace a long real-footage soak.

## Shared editor maintenance in this increment

- Extracted context-menu selection, availability and deletion actions into
  `app/editor-context-actions.ts`; tests import the actual module, without evaluating
  slices of page source. Page stays under its unchanged 500,000-byte budget.
- Extracted media-bin querying/counting into `lib/media-browser-query.ts`; an ID map
  replaces repeated profile scans during filtering/sorting. A 5,000-item regression
  asserts linear profile-ID reads while preserving first-match legacy semantics.
- 768 JavaScript tests passed. TypeScript, lint and the production Electron renderer
  build passed. The renderer retains its large-chunk/per-plugin timing warnings.
- Local web mount showed zero captured console errors. Right-click and Shift+F10
  opened the track menu; Add video track created V4, locking it disabled removal,
  and undo twice removed the test edits with no console errors.
- Native core track reordering now rejects moving locked tracks or moving across
  locked tracks; extreme deltas clamp without integer overflow. Regression coverage
  checks the transaction, not only disabled menu controls.
- No public deployment or notarized release is claimed. Public release qualification
  in `release-handoff.md` remains open.

## Native motion slice — implemented, with bounded evidence

Serialized transform/opacity keyframes now run in the native preview/export
compositor. Tests cover interpolation/hold/easing, split/trim clocks, reused comps
at different speeds, duplicate, undo/redo, save/reload and schema rejection.
Inspector/menu/shortcut/context controls and timeline retiming share validated
transactions. See [native motion evidence and limits](native-motion.md).

Follow-ups now include offscreen composition groups, masks/mattes, animated
Bezier paths and nested audio fades; see their qualification documents above.
Next: independent property curves, multi-mask stacks and path editing over footage.
Exact legacy scene translation now exists for projects whose rendered features have
native equivalents ([native scene translation](native-scene-translation.md)); everything
else blocks with an itemized report. Native schema is v6. All six broad workstreams remain open.
