# Media-grid and native destination regression

This checkpoint repairs four independently reproduced defects:

- The scrollable media grid compressed its row tracks below the cards' actual
  height. Neighboring cards overlapped and intercepted ordinary pointer actions.
  Grid tracks now size to their content; the grid does not apply list-sized
  offscreen containment estimates. List-view containment remains unchanged.
- First native export used `app.getPath("movies")`, which is not an Electron
  path name. It now uses the supported `videos` directory before the Save dialog.
- The desktop in-app Open control read the browser library even though Save
  writes disk documents. Open now uses the same desktop-versus-browser routing
  as Save; browser library behavior remains available in browser editions.
- Silent video insertion created an embedded-audio clip, making later export
  fail because there was no audio track to decode. Import/reopen now probes
  container track presence without decoding whole-file PCM. Verified absence
  prevents new audio attachments; failed/unknown probes retain prior behavior.
  Existing saved audio clips are not silently removed or rewritten. For an old
  project containing an erroneous embedded-audio clip from a known silent video,
  keep a backup and explicitly remove that nonexistent audio clip before export.

## Repeatable focused check

Use Node 22, installed dependencies, FFprobe on PATH, and a usable local Electron
runtime. Prepare five license-safe fixtures in one directory:

- `sp-golden-main-30fps.mp4`: 12 seconds, 1920×1080, 30 fps H.264.
- `sp-golden-broll-24fps.mp4`: 8 seconds, 1280×720, 24 fps H.264.
- `sp-golden-overlay.png`: RGBA still.
- `sp-golden-music-48k.wav`: 20 seconds, 48 kHz PCM.
- `sp-golden-sfx-44k.wav`: 3 seconds, 44.1 kHz PCM.

```sh
npm run desktop:renderer
node scripts/certify-media-grid.mjs /absolute/fixtures /absolute/evidence
npm run check
npm run test:quick
```

The script records source revision, dirty state, timestamps, card bounds,
screen capture and independent FFprobe output. It uses an isolated profile,
imports actual files, performs ordinary double-click/Insert actions, writes
project JSON through the UI, and renders a one-second native H.264 file through
the real preload/IPC/FFmpeg path. It closes the process, starts a fresh profile,
opens the actual saved file through the in-app menu and compares re-saved clip,
settings and media identities. It also verifies silent versus audio-bearing
insertion and exports a real mixed 13-second 1080p/30 fps timeline through the UI;
FFprobe and decoded PCM verify the output. The parity-render destination is a
real OPFS disk handle selected by the harness, not a fake writable or encoder.
It leaves its owned profiles and artifacts for
inspection and removes only its temporary launch wrapper.

**Scope limits:** the harness supplies OS dialog choices, not the encoder or
file implementation. Native dialog interaction, full save/reopen fidelity,
visual render comparison, large media-bin performance, Lite/browser behavior,
signed packages and the complete golden workflow are not certified by this
check. Local results are not hosted-CI success or release authorization.
