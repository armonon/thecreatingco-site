# Auto Cut: six-part upgrade

## Workflow

Open Auto Cut, import the main song/video and any additional footage, then use
**Plan → Review → Apply**. File type suggests a starting workspace, not a claim
that a video contains dialogue or music. Choose timing explicitly or allow the
measured soundtrack/transcript evidence to recommend it.

1. **Safe generation.** Analysis, story assemblies, cinematic assemblies,
   variations, rerolls, pace rebuilds and analyzed style changes produce drafts.
   Up to eight drafts persist with project state. Applying is one undoable edit.
   A stale-draft guard refuses to overwrite subsequently changed editorial state.
   Applying changes only the draft's fields, not unrelated current settings.
2. **Timing intent.** Music uses measured beat positions. Scenes/action uses
   visual shots without requiring music. Dialogue transcribes sources and keeps
   speech regions. Hybrid puts whole speech regions on available musical entry
   points rather than cutting words to meet the beat. Missing rhythm or failed
   speech recognition produces an explicit message, not fabricated evidence.
3. **Boundary review.** Coarse analysis proposes regions, which are rescanned
   with decoded frame timestamps. Flash returns and gradual transitions are
   distinguished from abrupt cuts. The boundary panel previews the original
   source; boundaries can be added/removed and survive reanalysis/project saves.
   Reset returns to detector output on the next analysis. Compatibility fallback
   is labeled coarse rather than frame precision.
4. **Constraints.** Target duration, min/max shots, source priorities,
   source keep/exclude ranges, no-repeat, protected edits and region rebuilding
   are enforced by the draft transaction. Linked audio and generated captions
   follow retained cuts. Protected tracks survive generated overlay replacement.
   Constraints can produce gaps/shortfalls; the draft reports them rather than
   silently changing beat positions or violating source handles.
5. **Explanations.** Each cut has a reason, heuristic confidence and alternative
   candidate identifiers. Users can change priorities/boundaries and generate
   versions to compare. Confidence is not a calibrated probability.
6. **Moment selection.** Candidate windows inside shots are scored using sampled
   motion, sharpness and exposure. Transcript-aware windows avoid crossing spoken
   boundaries. Dialogue regions are indivisible when phrase preservation is on.

## Evidence and limits

- Final automated run: TypeScript and ESLint passed; all **875 tests passed**;
  production web build and desktop renderer build passed. Bundle audit passed
  with a **497,642-byte** editor entry against the 500,000-byte budget.
  These are build/engineering checks, not signed-package or perceptual sign-off.
- Regression coverage includes explicit timing, beat-position retention, invalid
  constraints, source handles, locked regions, no-repeat, flashes, moment choice,
  audio/caption retiming, immutable/serializable drafts and UI wiring.
- A generated 12-second 30-fps three-scene MP4 was decoded through FFmpeg into
  the boundary engine. The revised detector returned cuts at 4.000 and 8.000 s,
  matching that fixture's known boundaries. This is a limited synthetic test,
  not proof of arbitrary footage accuracy or the complete browser decode path.
- A fresh UI mount showed the new Auto Cut controls. The subsequent media-import
  UI test could not complete while the Mac was locked; browser focus/file upload
  calls timed out. Full interactive import → generate → apply → undo → export
  qualification remains pending an unlocked session.
- No real speech-model run or subjective long-form narrative benchmark is claimed
  by this pass. Transcription depends on the existing local speech runtime/model.
- Scene detection and moment ranking remain heuristics, not semantic story
  understanding. A coarse proposal pass can miss rapid transitions between
  samples; frame precision applies to refined detections, not detection recall.
- A region crossing reversed/time-remapped footage fails explicitly. There is no
  claim of universal retime-aware region replacement.
- Draft review exposes decisions and durations. It does not yet provide two
  simultaneously playing A/B viewers; apply and undo remain the visual review path.
- No deployment, signed desktop package or new release was made in this pass.

## Interactive acceptance pass

1. Silent footage: generate a scenes draft, preview/edit a boundary, regenerate,
   apply, verify original sound (if present), undo, save/reopen and check versions.
2. Music + footage: explicit music timing, test target/min/max/no-repeat, exclude
   a source and verify it cannot reappear as a generated overlay. Inspect gaps.
3. Video with soundtrack: compare explicit scenes with explicit music. Confirm
   aspect, manual pace and selected look are not reset just by launching analysis.
4. Clear dialogue: generate twice, compare drafts, cancel recognition, ensure no
   duplicate audio and verify words/captions are in sync after source exclusion.
5. Hybrid: use reliable music and spoken takes; verify phrase boundaries and beat
   entrances. Confirm low-confidence music fails visibly instead of inventing BPM.
6. Protect a clip/track, rebuild a middle region, inspect both exterior pieces and
   their audio/captions. Edit the timeline after drafting; stale apply must refuse.
7. Export each accepted draft and compare picture, audio sync and captions with
   preview. Record media, device, durations, timings and failures.
