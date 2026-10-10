# Browser release qualification

The browser player is separate from the native JUCE application. Native code,
licensing/distribution gates and physical devices are not qualified by this suite.
No stable-release certification is implied. Current status: **alpha**, with a
reviewed save-consistency fix prepared for public browser release.

## Save consistency repair

Saving now captures the queue, playlist name and EQ together before reading file
bytes. If the listener changes title, EQ or queue during that asynchronous save,
the earlier snapshot is saved and the app explains that newer edits still need
another save. Previously later metadata could be mixed with an earlier queue and
the app could incorrectly report all current work saved. Playback/editing stays
available; originals and previous library remain unchanged on storage failure.

## Reproduce

Serve this checkout: `python3 -m http.server 4318 --bind 127.0.0.1 --directory web`.
Run `node pwa/workflow-check.mjs`; point `PLAYWRIGHT_PATH` to an installed Playwright
index.mjs when it is not locally installed. `BOUNCE_BROWSER` selects chromium
(default), firefox or webkit; `BOUNCE_REPORT_DIR` selects evidence output.
The harness owns a new temporary profile; it never opens a personal browser profile.
It uses generated reference PCM, the published original musical studies, actual
media playback/IndexedDB/downloads and an independent binary archive parser.
Audio SHA-256 checks ensure the portable library does not silently change bytes.

Coverage includes reorder, save/reload/restore, fresh-tab portable reopen, damaged
archive rejection, edit-during-save race, phone-width layout and actual Chromium
quota rejection while preserving the old saved library and unsaved current queue.
For quota, Chromium is restarted on its owned profile and the override applied
before opening the origin, avoiding cached storage grants. Firefox/WebKit quota
denial remains explicitly unverified. This is not physical disk exhaustion.

`node pwa/build-sw.mjs` regenerates the service worker after shell changes.
`node pwa/pwa-check.mjs` checks installability, offline local audio, media-cache
exclusion and the explicit update/reload flow. Browser checks are headless on the
host Mac; WebKit is not proof of real iPhone/Safari hardware behavior. MP3, FLAC,
AAC codec coverage, 200-track/300MB stress, assistive-technology use, long listening,
physical/mobile platforms and native distribution remain additional release gates.
