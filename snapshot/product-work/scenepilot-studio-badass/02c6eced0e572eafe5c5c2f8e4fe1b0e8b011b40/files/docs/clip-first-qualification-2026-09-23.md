# Clip-first editorial qualification — 2026-09-23

This is a verified increment, not a claim of complete Premiere / After Effects parity.
See `maturity-pass-2026-09-23.md` for the preceding timeline, interchange and packaged-app pass.

## Fixed

- Timeline picture no longer requires a main song/video: readiness, Program preview,
  delivery review and the export launch use the same sequence-content rule.
- Audio-only timelines mount their preview players without a main source. They
  remain audio-stem deliveries, not empty-picture video exports.
- The renderer accepts `mainFile: null`. Clip-first and source-free composition
  exports no longer allocate a full-duration dummy silence WAV.
- A real encode exposed the previous dummy WAV's unsupported 8 kHz AAC encoder
  configuration. Source-free picture now exports without a fabricated audio track;
  real timeline audio still uses the 48 kHz PCM mix.
- New-main-source loading always consults dirty-document protection, including
  projects that have no main file. The preservation option still bypasses replacement.
- Empty-state instructions and delivery copy explain clip-first editing.

## Evidence on this machine

- `npm run check`: pass.
- `npm run test:quick`: **801 passed, 0 failed, 0 skipped**.
- `npm run qa:main-source`: **9 pixel checks passed**, including base-track and
  overlay exports without a main file, plus existing main-source, effect, crossfade
  and nested-source regressions. Actual MP4s were decoded through FFmpeg.
- `npm run qa:pcm-worker`: pass. Worker encode now runs with `mainFile: null` and
  real mixed tracks. 48,000 frames, 47 bounded chunks, cancellation and WAV checks pass.
- `npm run build`, `npm run build:app`, `npm run desktop:renderer`: pass.
- `npm run qa:bundle`: **491,817 / 500,000 bytes**, pass.
- Browser interaction, isolated dev origin: import blue MP4 into the bin, Source
  Overwrite into an empty sequence, visible blue Program output, linked audio lane,
  playback, delivery-ready state, save, reload, explicit reopen, restored picture,
  duplicate and undo. No console warnings/errors at the inspected point.
- Observed layouts: default 1280×720 and overridden 1440×900. The later viewport
  override did not change the target tab's measured dimensions; do not count that
  as a successful 1280×800 or 1920×1080 regression check.

Logs: `outputs/clip-first-{tests,render,pcm,build,app-build,bundle,desktop-build}.log`.

## Inconclusive / not performed

- Browser automation stalled on source replacement; the confirmation could not be
  inspected reliably. The guard is implemented, but this interaction is **not** a
  verified manual cancellation pass.
- The browser blocked the new production-preview URL. Production builds passed;
  the browser workflow above exercised the development renderer, not a production mount.
- No new installer, signing, notarization, deployment or public release was made.
  The preceding packaged-app certificate does not certify this changed renderer.
- No new cross-machine, long real-camera playback or receiving-editor interchange
  round-trip qualification was performed in this increment.

## Remaining engineering work found during inspection

1. Source Insert inside an existing V1 clip needs a proper split-and-ripple transaction;
   the existing base placement helper only shifts clips starting at/after the insert.
2. Source Overwrite currently removes whole intersecting audio clips instead of
   preserving their audible head/tail remnants. Insert must also split crossing audio
   and preserve locked tracks, automation, fades and video-link identities.
3. Fit-to-fill video edits need matching audio retiming: `AudioClip` has no playback-rate
   field today, while the source edit sets a video playback rate. Do not call these
   linked edits sync-qualified until preview, PCM export and native export agree.
4. The 7,179-line shell remains a substantial maintenance risk despite extracted
   boundaries and the now-passing entry-bundle budget.

These are specific qualification gaps, not reasons to assign a higher numerical score.
