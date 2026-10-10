# Native macOS Pro migration

Current increment: [Native motion / schema v3](native-motion.md), following
[Native workspace 0.2](native-workspace-0.2.md). These records
supersedes the first-slice UI/schema details below; the migration limits still apply.

## Decision and baseline

macOS / Apple Silicon first. Browser Lite stays on the existing web implementation.
The current Electron Pro remains available during migration. This work branches from
the verified `4f2445c` candidate on `feature/native-macos-foundation`; it does not
replace the existing app, public downloads, project format or release approval.

The first native executable is **ScenePilot Native**, bundle identifier
`com.armonon.scenepilot.native-preview`. It uses AppKit/AVKit, AVFoundation,
Core Image on Metal (native CPU fallback if Metal is unavailable), and Foundation.
No Electron, WebView, JavaScript engine, web server or Node process is required at
runtime. Node is used only by the development packaging script, not by the app.

## Architectural boundaries

- `ScenePilotCore`: versioned document, canonical `videoClips` arrays per sequence,
  track order, validation, edit transactions, bounded history and atomic persistence.
- `ScenePilotMedia`: local stream inspection, nested edit expansion, AVFoundation
  timing/audio graph, shared native compositor, cancellable atomic MP4 export.
- `ScenePilotNative`: AppKit shell, command registry, project media, sequence picker,
  native timeline interaction, contextual inspector, dirty-close protection and recovery.

The shell skill drives shared menu/toolbar/shortcut commands and authoritative
document/selection state. Split panels are resizable; 0.2 adds versioned, validated workspace persistence;
floating/dockable panels and independent multi-document tabs are **not** implemented.

## First vertical slice

Implemented and exercised in the migration slice:
- Local video/audio import and compatible media relinking.
- Track creation/removal, ordering, enable/disable and locking.
- Clip append, drag between tracks, timing/source-in/duration/speed edits and split.
- Clip volume, fades, opacity, exposure, saturation and blur.
- Matched-size compositions, editable sequence switching and recursive nesting.
- Native playback and MP4 export through the same compositor.
- Native-format save/reopen, undo/redo, dirty document guards and recovery journals.

Native preview/export parity is a new contract that must be measured. It does not
prove cross-engine equivalence to Chromium. Never silently substitute a close-looking
effect when importing a legacy project. Reference renders must record color space,
timing, dimensions and agreed tolerances, including compressed-output error.

## Safety and current limits

- Native v2 documents use `scenepilot-native`, not `scenepilot-cut`, and read native v1.
  Existing Electron projects have a compatibility review and explicit media-only
  rebuild with byte-exact original archival; full scene conversion is still pending.
- First engine supports SDR, even dimensions and integer frame rates 24/25/30/50/60.
- Media is referenced by local paths, not copied into the project.
- Nested compositions must match dimensions. Group-level visual effects are rejected
  until proper offscreen group rendering is implemented.
- At most 256 expanded clips per render in this migration build. This is an explicit
  temporary guard, not the intended production capacity.
- Beyond the later frame-step roll/slide commands, advanced drag trim modes, masks,
  roto, titles/shapes, keyframes, graph effects, LUTs,
  scopes, auto-director, captions, proxies, alpha/stem exports, queues, plugins,
  interchange and large-project scheduling are not yet ported into this app.
- Never advertise this executable as a complete replacement for current Desktop Pro.

## Next migration gates

1. Validate the first real import/edit/save/reopen/export/recovery workflow.
2. Define a versioned interoperable scene contract and lossless migration checks;
   keep all unknown/unsupported legacy fields safe and block unsupported playback.
3. Port composition transforms/keyframes, titles/shapes, masks/mattes, effects/LUTs,
   and preview/export reference corpus using native GPU render passes.
4. Connect native Core ML/Vision roto and correction/cache workflows, eliminating
   JavaScript-dependent provider orchestration from the native process graph.
5. Port automation, professional timeline/audio/delivery workflows and caching.
6. Qualify large footage, minimum macOS, offline installation, signed updates and
   notarization before retiring Electron or changing public downloads.

## Build

```sh
npm run native:test
npm run native:build
```

Output: `release/ScenePilot Native.app`. Its identity and recovery folder are separate
from the current Pro app. The developer directory override is per process; no global
Xcode selection or security settings are changed.

`native:test` generates synthetic audio/video fixtures locally, then runs the Swift
tests with real AVFoundation decoding/rendering enabled. FFmpeg is only a **test
fixture generator**; it is not packaged into, launched by, or required by this app.
Plain `swift test` without the fixture environment skips media integration cases.

## Validation record — 2026-09-20

- 23 Swift tests passed, with the generated media fixtures enabled (no skips).
- Real patterned-video export with exposure, saturation and blur passed compressed
  preview/export RGB error tolerance (MAE < 8 on a 32×18 sample at 0.5 seconds).
  This is a smoke gate, not an exhaustive color/effect parity certification.
- Nested composition / red-over-blue track-order pixels passed.
- Native PCM readback verified that two identical quarter-gain audio tracks double
  the single-track RMS within 3%; the MP4 master contains both audio and video.
- Pre-canceled and in-flight canceled exports preserve the previous destination.
- Exports cannot overwrite their source paths; project saves cannot overwrite a
  legacy project or non-native document. Regressions cover both safeguards.
- Reused composition dependencies are validated once per node, and render expansion
  is bounded separately from leaf count to avoid pathological nested-graph workloads.
- Packaged AppKit app was launched and exercised using actual UI controls:
  import real 1280×720 H.264 footage, append, playback, saturation to grayscale,
  undo, ruler seek, frame-quantized split, drag to another track, save, restart,
  reopen and preview. UI export produced a decodable 1920×1080 H.264 MP4,
  duration 5.466667 seconds, matching the edited sequence.
- `npm run check`, all 747 existing JS tests, `npm run build`, and the existing
  browser mount/accessibility audit passed. No existing editor source was replaced.
- Ad-hoc codesign verification passed. Linked-library inspection found Apple
  frameworks / Swift libraries and no Electron, WebKit, JavaScriptCore or Node.
- Native timeline exposes accessibility actions for tracks/clips and frame-stepping
  keyboard controls. Full VoiceOver and multi-viewport acceptance remain pending.

Generated reports: `outputs/native-macos/report.json` and `tests.log` (ignored).
Local GUI project/output: `outputs/release-today/media/Native UI QA.*` (ignored).
The native app is a local development preview, **not** Developer-ID-signed or
notarized. Minimum macOS testing, long-project performance, exhaustive effect/audio
parity, display/HDR management and public distribution approval remain open gates.

## Exact scene translation — landed

A strict, exact-or-blocked `scenepilot-cut` → native translator now backs File ›
Review Existing Pro Project; see [native scene translation](native-scene-translation.md).
It measured that native composites opacity in linear light while Pro blends gamma sRGB,
so partial alpha blocks until a Pro-compatible gamma blend mode exists.

## Immediate next increment (historical)

Introduce a lossless versioned bridge from existing ScenePilot projects before
porting more creative features. Inventory unsupported fields/effects explicitly;
keep the original document immutable, and refuse unsupported renders instead of
silently flattening or dropping data. Then port native transforms/keyframes and
mask/matte passes against paired reference projects. The current Electron Pro stays
the full-featured app until those migration gates pass.
