# Audio edit reliability — 2026-09-23

This increment follows `composition-audio-qualification-2026-09-23.md`.
It is not a claim that ScenePilot is release-qualified or an Adobe replacement.

## Implemented

- Partial and repeated audio slices retain their original fade clocks, including
  overlapping linear, equal-power and exponential fades. Automation and inherited
  composition envelopes follow the surviving source window. Linked speed changes
  scale retained clocks; J/L edits and crossfade head extensions move them with audio.
- Source Insert/Overwrite, dialogue/range extraction and audio Razor share the
  slicing helper. Source Insert leaves unrelated SYNC-excluded audio untouched.
- Audio can be split using the keyboard command, context menu or Razor tool.
  The command's availability now includes audio. Split is a single undo operation.
- Keyboard picture splitting now uses the same Razor transaction as the pointer:
  reverse/retime/keyframe slicing is retained, linked sound is sliced and relinked,
  and locked picture or linked audio blocks the entire transaction.
- The inspector explicitly identifies retained clip fades and can clear them.
  Editing/removing one edge replaces that edge's retained curve without deleting
  inherited composition fades. Auto-duck no longer modifies locked audio tracks.
- OTIO metadata round trips retained envelopes and rejects malformed/oversized
  envelope metadata. Other applications are not assumed to interpret this metadata.
- Project Media has a right-click/keyboard-menu Add audio at playhead command,
  naming its unlocked destination. It shares clip construction with drag placement
  and does not arbitrarily link new sound to a previously selected picture.
- Native PCM cache leases carry ownership markers. Before allocating a new mix,
  dead-process caches are reclaimed. Live processes, unknown files, unmarked legacy
  directories and symlinks are retained; only exact generated files are removed.
  Permission errors probing a process are not treated as proof that it died.
- Restore feedback counts audio clips as timeline items.

The app-shell skill guided the shared mutation/command boundaries and explicit
inspector state. Canonical `videoClips` ownership is unchanged. The editor shell
is still approximately 7,148 lines; decomposition is not complete.

## Evidence

- Deterministic regressions sample the gain before/after repeated edits across
  all three fade shapes, automation, inherited envelopes, linked varispeed,
  dialogue extraction, J/L idempotence, OTIO round trips and invalid metadata.
- Command tests cover atomic undo, frame-snapped audio splitting, busy/locked
  rejection, linked picture splitting and named-destination audio placement.
- Cache tests cover ordinary cancellation plus dead/live/legacy/unknown-file and
  symlink recovery fixtures. Tests create and clean only their own temp directories.
- Real browser at an isolated local development origin: imported the generated
  six-second WAV, placed it through the new media command, set a three-second fade,
  split at 1.5 seconds via the context menu, verified two pieces and retained-fade
  notice, undo (one piece), redo (two), clear retained fade and undo that clear.
  Saved, reloaded and reopened `Audio editing regression QA`; retained fades were
  present. A keyboard split produced three clips; a Razor click produced four.
  Saved the resulting synthetic QA project. No captured browser console errors.
- Two automated pointer drag attempts did not produce a media drop. The cause was
  not established; this pass does not certify drag-and-drop. The named placement
  command above was exercised successfully and is independently useful/accessible.

- TypeScript and lint passed without warnings. Full suite: **842 passed, zero failures/skips**. Production build and Electron
  renderer build passed. Production editor entry: **497,689 / 500,000 bytes**;
  other chunks still produce size warnings. This is not a whole-application budget.
- Worker PCM, native handoff and streaming certificates passed: exact decoded PCM
  handoff parity, native AAC RMSE **0.0018632**, explicit silence, rate checks,
  cancellation and cleanup. These certificates use generated media.
- Algorithmic performance checks passed; measured prepared frame-plan speedup was
  7.27× against the unprepared reference in this run. This is not a real-time
  playback FPS benchmark or a promise across machines.
- Logs: `outputs/audio-edit-{check,build,tests,desktop,bundle,worker,stream,performance}.log`.
  The isolated browser tab and development server were closed. The saved synthetic
  QA project remains in that local origin's project library.
- The desktop renderer was rebuilt, but no new packaged installer or public site
  was published. The earlier packaged candidate predates these changes.

## Still open

- Live playback remains media-element/WebAudio based, not gapless sample-scheduled
  PCM. Matching gain curves does not establish identical stateful EQ/compressor
  history at edit boundaries or live/export parity under all playback conditions.
- Reverse/variable audio retiming and pitch-preserving stretch are not implemented.
- Audio-only OTIO import still requires a usable picture track; generic third-party
  metadata-loss round trips cannot preserve every ScenePilot effect or envelope.
- Additional ripple/trim/slip/roll routes need lock, linked-sync and curve qualification.
  This increment does not certify every editing route or fix every unrelated bug.
- Native staging remains capped at 4 GB. Unknown/legacy caches are intentionally
  not deleted. Crash recovery occurs on the next PCM mix allocation, not immediately
  at process launch. PID reuse conservatively retains a cache.
- Signing/notarization, Gatekeeper/clean-machine installation, mixed-camera media
  qualification and multi-machine performance remain separate release gates.
  The current build process has neither supported notarization credential set
  configured (Apple ID/app-specific password/team, or App Store Connect API key).
  The existing Developer ID certificate alone does not satisfy notarization.
- Existing staged marketing changes and earlier uncommitted engineering changes
  were preserved. No blanket commit, public deployment or credential changes.
