# ScenePilot PWA, suite kit and Locker (wave 4)

ScenePilot (editor at `/app/`, film tools at `/tools/`) installs as one app named
**ScenePilot** and works offline after the first visit. Same pattern as Glyph Studio
(`armonon/glyph-studio` commit `4dbb3c3`).

## Pieces

| File | What it does |
| --- | --- |
| `public/manifest.webmanifest` | `name`/`short_name` "ScenePilot", `id` `/app/` (kept from the old "ScenePilot Lite" manifest so existing installs update in place), `start_url` `/app/`, `scope` `/`, any + maskable icons (192/512), shortcuts to the tools. |
| `public/sw.js` | Hand-written worker (source of truth). Precache app shell + code; network-first navigations under `/app/` and `/tools/` (3 s) with cached page → cached shell fallback; MediaPipe WASM/models cached on first use; user media and cross-origin requests never cached (only exception: the suite kit script, so the shared menu renders offline). New versions wait for `{type: "SKIP_WAITING"}`. Paths outside `/app/` and `/tools/` are not intercepted. |
| `scripts/build-pwa.mjs` | `npm run build:pwa`: writes `site/sw.js` with the precache list + build id from the current `site/app` and `site/tools`, copies the manifest and icons. `npm run build:site` = app + tools + pwa. |
| `lib/pwa-client.ts` | Registers `/sw.js` with scope `/` (removing the old `/app/`-scoped registration), reports "offline ready" / "update available". Skipped on localhost unless `?pwa` is passed once. |
| `app/suite-ui.tsx` | `PwaStatus` toast ("Update available — reload"), `InstallAppButton`, `SuiteMenu` (`<tcc-suite-menu>`), `LockerSaveButton`, `useLockerOpen`. |
| `lib/tcc-suite.ts` | Optional glue for `https://thecreatingco.com/suite/v1/suite.js` (`window.TCC.locker`). Everything works when the kit is missing. |
| `scripts/kill-switch-sw.js` | Emergency self-unregistering worker. |

`/sw.js` must be served `Cache-Control: no-cache` (production overlay adds a `/_headers` rule) so normal updates and the kill switch reach browsers immediately.

## Kill switch

If the PWA itself breaks for people (not just app content):

```
cp scripts/kill-switch-sw.js site/sw.js
```

and publish that single file as `/sw.js` in an additive overlay deploy (never a wholesale `site/` deploy — see WAVE2.md PARITY WARNING). On their next visit browsers install it, it deletes every `scenepilot-*` cache, unregisters and reloads open tabs from the network. Restoring an older Netlify deploy alone does **not** remove an installed worker.

## Suite kit + Locker

Each page loads `<script src="https://thecreatingco.com/suite/v1/suite.js" data-app="scenepilot" defer>` **after** the app's own module script, so a slow or unreachable kit never delays the editor. The menu renders in `<tcc-suite-menu>` in the editor top bar and the tool headers (mobile editor: the kit's floating button).

- Save to Locker: editor top bar (latest render or Premiere XML/EDL), mobile "Your video is ready", every tool header (latest export: video, SRT/VTT, `.cube`, XML/EDL, JSON, CSV), AutoCut's export panel.
- Open from Locker (`?tcc-open=`): editor (audio → song, video → main/clips, `.cube` → LUT, `.srt/.vtt` → captions), AutoCut (song/clips), Reframe (video), Captions (video/audio), Grade (target video/still).

Locker files live in this browser on this device (no cloud, no account).

## Premiere export

`lib/premiere-xml.ts` builds Final Cut Pro 7 XML (`xmeml` v4; Premiere Pro: File → Import) and a CMX3600 EDL. AutoCut: Export panel → **Export for Premiere** / **EDL**. Editor (Auto Director): **Export for Premiere** / **EDL** next to Export cut. Unit tests: `tests/premiere-xml.test.mjs`.
