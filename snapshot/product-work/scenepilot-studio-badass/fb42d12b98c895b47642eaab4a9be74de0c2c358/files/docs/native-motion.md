# Native motion animation — 2026-09-21

An AppKit migration-preview increment, not full Premiere/After Effects parity or a
replacement for the broader existing Electron Pro application.

Follow-up: [native composition groups, masks and mattes](native-compositing.md)
extends this motion system to composition instances and upgrades documents to v4.
The v3 evidence below describes the original motion increment.

## Working contract

- Video clips animate X/Y position, uniform scale, rotation and picture opacity.
  Each key holds all five channels; fit/fill/flips remain clip-wide. This does not
  animate audio gain, grading or blur.
- Outgoing interpolation: Linear, Smooth (smoothstep), Ease In/Out (quadratic),
  Hold. Rotation uses continuous degrees, including multiple revolutions.
- Before/after the key range, endpoint poses hold. One key holds throughout the
  clip; no implicit key is created at the other end.
- Add/update via Motion menu, inspector diamond, clip context menu, or
  Command–Option–K. With motion active, Return in a transform/opacity field inserts
  or updates a key at the playhead's sequence frame; existing easing is preserved.
- Previous/Next seeks visible keys. Bake Current Pose removes motion while holding
  its evaluated pose. Removing the final key preserves that pose as static values.
- Drag yellow timeline diamonds or edit Key Time (absolute sequence seconds) to
  retime. Frame-quantized moves preserve pose/easing. Collisions, out-of-clip times,
  missing keys and locked tracks refuse without overwriting another key.
- Inspector numeric fields commit explicitly on Return, then release focus.
  Leaving a field no longer replays an old value at a different animation frame:
  this defect was found and fixed in the actual desktop interaction pass.
- Preview builds that take more than eight seconds now display file-access/relink
  guidance instead of an indefinite unexplained loading label. Retry Preview is
  available in the transport and Sequence menu. Generation checks prevent a stale
  job or watchdog from replacing the current preview/status.

## Document and rendering

Native schema **v3** round-trips motion, upgrades v1/v2, and is rejected by older
native readers rather than silently dropping keys. Invalid/future version headers
and malformed curves refuse. Maximum 4096 keys per clip, finite validated values,
distinct increasing times and bounded clocks. Evaluation uses binary search,
without sorting copies on the render thread.

Motion has an independent timeline-seconds clock. Split offsets the right-hand
clock; head trim and roll/slide-neighbor trims advance or extend it. Tail trim
keeps it. Out-of-window keys remain recoverable. Moving, duplicating, slipping or
changing source speed retains clip-local animation. Nested leaves carry their
own child-local start and composed parent rate, so reused comps animate correctly
at different speeds. The native Core Image/Metal evaluator is shared by preview
and MP4 export; motion opacity multiplies picture fades without changing audio.

The original motion increment rejected composition-instance animation. The v4
follow-up now renders transparent intermediate groups and applies animation after
their children combine; see `native-compositing.md`. No browser or JavaScript
rendering fallback was added.

## Verification

- 61 Swift tests pass with generated H.264/AAC fixtures enabled, no skipped media
  tests. Covers all five supported frame rates; easing/hold/endpoints; repeated
  split/trim; roll/slide clocks; slip/rate/duplicate; retiming/collision/locks;
  malformed input; schema migration; persistence; undo/redo.
- Actual animated pixels match frozen evaluated poses and survive split/head trim.
  Two-level reused nesting is sampled at different rates and nonzero source-in.
  A four-second exported MP4 is independently decoded at five times; pixel MAE
  must remain below 8/255 including codec loss. Streams and duration are checked.
- 768 JavaScript tests pass; TypeScript and lint pass. Native production packaging,
  ad-hoc signature and no-web-runtime dependency checks pass.
- Desktop checks: shortcut creates first key; 30 frame steps reach second pose;
  X=25% at one second, X=0% at the first key, and X=12.5% midway. Smooth easing,
  bake/undo/redo, locked-track refusal, contextual add, remove, atomic save and
  reopen preserve the intended values.
- Follow-up desktop retiming checks: drag the second diamond from 1.000 to 1.500s
  while the clip stays at 0.000s / 2.000s duration; undo in one step; edit Key Time
  to 1.400s; attempt a collision at 0.000s and verify both original keys remain.
  QA retiming changes were undone, leaving the saved generated two-key project.
- Fixture: run `node scripts/create-native-motion-qa.mjs` after `npm run native:test`.
  It resets only `outputs/native-macos/motion-ui.scenepilot-native.json`.

Evidence is bounded: generated short media and one directly inspected window
size, plus automated layout constraints for the larger viewport matrix. This is
not a long-project performance/thermal soak, VoiceOver qualification, or a
notarized public release. Local app: `release/ScenePilot Native.app`.

### macOS permission gate found during final rebuild

The final rebuilt app's media reads were observed waiting inside AVFoundation's
file-open path. macOS TCC logs explicitly report a code-requirement mismatch for
`kTCCServiceSystemPolicyDownloadsFolder` after the ad-hoc-signed binary changed.
The engine tests and earlier desktop preview displayed valid frames; the final
live playback recheck requires resolving the system's access request. No privacy
settings, TCC records or signing requirements were weakened. Approval was requested
from the user; lack of that approval is not recorded as successful playback.
The final build's eight-second guidance was directly observed. Clicking Retry
Preview returned to the building state without dirtying the document; the OS
permission request itself remains pending.

A stable Developer ID signature and clean-machine file-access/upgrade tests remain
release requirements. The stalled-preview guidance is recovery UX, not a bypass
of operating-system file permissions.

## Remaining work

Independent property tracks, custom Bezier/graph editing, spatial paths, offscreen
groups, masks/mattes, native text/shapes/roto, lossless legacy scene translation,
and the other release gates in `adobe-workflow-parity.md` remain open.
