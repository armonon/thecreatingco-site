# Song-sync implementation and qualification

## Delivered

- Editable per-source beat maps: fractional BPM, measured beats, downbeats, meter, confidence, individual beat timing and 5 ms phase nudges. Maps travel with project media and timeline audio clips; snapshot/undo carries source maps.
- Audio workspace → **Song sync · beats & transitions**: select an incoming song, analyze both songs, select the master and place the playhead at a master downbeat. Align only, or prepare a 4/8/16-bar handoff. A handoff trims the master at its end; Undo restores the edit.
- Beat-by-beat mapping follows measured master timing rather than a single average BPM. Missing transition handles, mismatched meters, locked tracks and unreviewed low-confidence maps produce explicit feedback.
- Cancelable worker-based, stereo-linked WSOLA pitch-preserving preparation. The result is a new WAV asset; the source stays in the media bin. Existing clip gain/fades/automation are remapped rather than accidentally baked through the mix processing twice.
- Standalone timeline audio sources and the transport use one AudioContext clock. Songs are scheduled from the same clock anchor; active/look-ahead buffers prepare before transport begins. Audio decoding has explicit memory limits and visible failures.
- Native generated audio has a hashed, atomic disk-backed store and trusted IPC route. The Electron runtime file list includes the new module.

## Review corrections

1. Beat-grid edits preserve measured spacing instead of flattening it, and no longer regenerate or overwrite the user's cut/overlay arrangement.
2. Tempo retains fractional precision and is refined over tracked multi-beat spans.
3. Stutter and speed-ramp timing can follow the measured beat map rather than accumulate average-tempo drift.
4. Equal-power crossfades span the complete overlap, avoiding an unintended full-volume overlap plateau.
5. Song-to-song tempo/phase matching now has a user-facing workflow, worker-safe decoding/preparation, cancellation and shared-clock standalone-audio playback.

## Verification

- `npm run check`: passed.
- `npm run test:quick`: **852 passed, 0 failed**.
- `npm run build` and `npm run desktop:renderer`: passed.
- `npm run qa:bundle`: passed, **492,291 / 500,000 bytes** for the editor entry.
- `npm run qa:pcm-worker`: passed. A 440 Hz source remained 440 Hz at 0.5×, 1.0666667× and 2× stretch; worker audio analysis, native PCM parity, cancellation and cleanup passed. Native AAC comparison RMSE: 0.0018632.
- Browser workflow: imported generated 120/128 BPM rhythmic WAVs; analyzed both; corrected bar one; prepared alignment; played; undid; prepared a four-bar handoff; saved the project. No console errors were reported by the test page.
- Browser restore verification is **pending**. Automation stalled during restore and the clean-tab retry. A fresh snapshot-map allocation was found and memoized to prevent spurious dirty state, but successful interactive restore after that fix was not observed. Do not count this as a passed persistence qualification.
- The renderer change required regeneration of the marketing-effects provenance/assets. Existing generated image hashes were checked first; the generated gallery was rebuilt using its existing script.

## Boundaries and pending gates

- This is not a claim of transparent, artifact-free commercial time-stretch quality. Tests use synthetic tones/pulse tracks, not a blind listening corpus. Audit drums, sustained vocals, dense stereo mixes and large tempo changes before a release-quality claim.
- Prepared song-sync sections are limited to eight minutes and 0.5–2× local stretch. Preview is limited to 192 MiB decoded PCM per source and 384 MiB total reservations. Export remains streaming; long preview sources currently need shorter source files, not merely timeline trims.
- Precise scheduled playback covers standalone audio assets. Video-backed audio retains its existing media-element path; linked-picture retiming is rejected. This does not claim that all media playback has been converted to sample-scheduled audio.
- Automatic tempo detection still has its existing 72–176 BPM search range and may choose half/double tempo. Manual beat-map BPM supports 20–400. Downbeat/confidence estimates require user review.
- Four/eight/sixteen-bar handoffs are beat-aligned equal-power crossfades, not harmonic-key matching, automatic phrase understanding or stem-aware DJ transitions.
- Source/preload and desktop renderer were updated, but no DMG was rebuilt/installed, signed, notarized or deployed in this pass. An older running desktop app must be updated/restarted before durable generated-audio IPC is available.

## Next qualification steps

1. Reopen the saved generated-media project in a fresh browser session and a rebuilt desktop app; confirm maps, automation, media linkage and playback.
2. Audition at least ten licensed/user-owned songs across steady electronic, live drums, rubato, sparse intros, vocals and dense mixes. Compare matched transients and stereo phase at modest and extreme tempo changes.
3. Validate a mixed video/audio export against preview, especially handoff boundaries, seeks, loops, cancel/retry, and non-default track/master processing.
4. Add streamed/worklet preview for long sources and bring video-backed audio onto the same scheduling model before claiming a fully unified sample-clock media engine.
