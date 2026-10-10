# Editor workflow hardening — 23 September 2026

## Scope and implementation

1. **Shared commands.** Keyboard shortcuts, Electron action messages, DOM clipboard events, the command palette, clip context menus and primary editor controls now use the editor command registry for core transport/edit actions. Native cut/copy/paste roles retain ordinary text-field behavior; editor-owned clipboard events use one typed clipboard. Multi-cut copies remap linked audio IDs. Composition copies regenerate keyframe IDs and reject circular nesting. Mutations honor selection, busy and lock guards. The obsolete page-level clip clipboard and duplicate-layer implementation were removed.
2. **Export lifecycle.** Jobs distinguish preparation, destination selection, encoding and finalization. Preparation no longer displays misleading 0% encoding progress. Cancellation is registered before preflight and remains effective while a destination picker is pending; a later picker resolution cannot start a canceled encoder. Native jobs reserve their cancellation token before spawning FFmpeg. Picker/write errors fail explicitly rather than silently falling back to downloading. Interrupted jobs recover as retryable failures.
3. **Edit workspace.** Rhythm/analysis controls are collapsed by default, with a compact status and Auto Cut entry point. The inspector identifies its target and explains empty/no-selection states. An empty sequence shows a drop invitation instead of a synthetic source clip. Clip-effect loading has its own Suspense boundary so selecting a clip does not blank the whole workspace. Unsupported source audio insertion directs the user to an audio track.
4. **Responsibility boundaries.** `sequence-inspector.tsx` is a lazy chunk; editing/clipboard actions, key routing and Source/Program transport live in separate modules. The shell retains ownership of project state and the unified `videoClips` model. The 500,000-byte entry budget is unchanged.

## Interactive evidence

An isolated local QA origin was used, not the user's existing editor project.

- Imported the repository's red/blue six-second media fixtures.
- Source forward/reverse shuttle and stop affected the Source playhead, not the sequence.
- Keyboard split produced two cuts; toolbar undo/redo restored/reapplied it.
- Context-menu Copy followed by palette Paste used the same clipboard.
- Keyboard Cut removed one selected clip; Undo restored it.
- Select-all and Backspace in media search edited the text, not timeline clips.
- Inspected the Edit layout at 1280×800, 1440×900 and 1920×1080; reset the viewport afterward.
- Production desktop-renderer preview mounted with no console warnings/errors. Development HMR emitted dependency-array warnings while hooks were being edited; these were not present in the production mount.

## Limits of this pass

- This is a targeted shell decomposition, not a claim that the remaining roughly 7,250-line coordinator is now a small component. Project persistence, composition operations and timeline state orchestration remain candidates for separate, tested extraction.
- Browser/production-renderer checks do not certify OS-level Electron menu accelerators or macOS save dialogs. Run a packaged Electron smoke test before publishing a new desktop installer.
- Browser save dialogs cannot be forcibly dismissed by the application. Cancellation is remembered; dismissing or resolving the dialog afterward must not start work.
- The sequence still has an explicit fixed duration. Copy/duplicate now rejects edits that would silently land past its end, with an actionable status message; this pass does not introduce automatic sequence extension.
- No new signed installer, notarization, deployment or Git commit was performed by this pass. Existing unrelated working-tree changes were preserved.
- The bundle gate concerns the editor entry chunk, not total downloaded code or the intentionally self-contained render worker. General large-chunk warnings can therefore remain.

## Verification

- Bundle audit: **488,857 bytes** for `page-zqJREA-l.js` against an unchanged **500,000-byte** budget (11,143 bytes / 2.23% headroom). The review baseline was 521,130 bytes; this is a 32,273-byte / 6.19% reduction. The built chunk contains the final clipboard bounds guard and abort-aware stem reads.
- Shell size: **7,246 lines**, versus 7,628 in the checked-in HEAD. Some working-tree changes predated this pass; this is not a claim of exclusive ownership of every line in the diff.
- `npm run check`: passed. Final `tsc --noEmit` and targeted lint also passed after the last audio/clipboard changes.
- `npm run build`: passed; `npm run qa:bundle`: passed.
- `npm run test:quick`: **790/790 passed**, no failures/skips (82.1 seconds on this run).
- `npm run desktop:renderer`: passed (17.2 seconds on this run).
- `node --check electron/main.js` and `git diff --check`: passed.
- Reloaded the final production desktop-renderer preview, verified empty-state text, opened the command palette and confirmed Copy was disabled without a selection. Console warnings/errors: none. One browser-control mouse event timed out during project setup; subsequent dialog close and palette interactions succeeded, with no application console error.

The Photoshop-class app-shell skill guided the shared-command boundaries, explicit selection states and three-size layout validation. No unrelated marketing or release changes were staged or committed.
