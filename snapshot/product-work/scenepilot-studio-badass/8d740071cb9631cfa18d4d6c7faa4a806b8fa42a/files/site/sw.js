/* global caches, self, fetch, URL, Response */
// ScenePilot service worker — editor (/app/) and film tools (/tools/).
//
// Source of truth: public/sw.js. `npm run build:pwa` (scripts/build-pwa.mjs)
// copies it to site/sw.js and fills in BUILD_ID + PRECACHE from the built
// site/app and site/tools bundles. Rules:
// - Precache the app shell + code (HTML, JS, CSS, icons, small models).
// - HTML navigations under /app/ and /tools/ are network-first (3 s), falling
//   back to the cached page, then the cached shell, so they work offline.
// - Same-origin runtime files that are app code (MediaPipe WASM, models) are
//   cached on first use (stale-while-revalidate).
// - Never cache user media or anything cross-origin (except the suite kit
//   script, so the shared menu also renders offline). Media is opened from
//   local files / blob: URLs and never passes through here.
// - New versions wait. They only take over when the page posts
//   {type: "SKIP_WAITING"} after the user clicks "Update available — reload".
// - Everything outside /app/ and /tools/ (marketing pages, /learn, …) is left
//   to the network untouched.
// Kill switch: scripts/kill-switch-sw.js (see docs/pwa.md).

const BUILD_ID = "2c82a57131d9";
const PRECACHE = ["/app/assets/aac-output-CKLWm-uw.js",
  "/app/assets/activity-NiqQ1-Wd.js",
  "/app/assets/alpine-source-20260911-CRIbuppy.jpg",
  "/app/assets/arrow-right-Ap9fy9tJ.js",
  "/app/assets/aspect-BoiGJcdw.js",
  "/app/assets/audio-mixer-BkTMxuWn.js",
  "/app/assets/audio-mixer-sidebar-Ya3a71W9.js",
  "/app/assets/auto-director-workspace-CIl7Hpgx.js",
  "/app/assets/auto-edit-policy-DkKmhcd5.js",
  "/app/assets/auto-edit-review-panel-BIRME2TE.js",
  "/app/assets/box-BtYsb2Qa.js",
  "/app/assets/camera-F8FGUoQz.js",
  "/app/assets/canvas-preview-1G9JvrZS.js",
  "/app/assets/chunk-QTnfLwEv.js",
  "/app/assets/circle-DPYod_n9.js",
  "/app/assets/clapperboard-hCZUyz7_.js",
  "/app/assets/clip-effect-stack-BI0x96ae.js",
  "/app/assets/clip-effects-Dj9lS-4p.js",
  "/app/assets/clock-3-IKYXk8V6.js",
  "/app/assets/color-management-BbbrKGmE.js",
  "/app/assets/command-palette-Du1PgTjb.js",
  "/app/assets/composition-3d-0w6rTV12.js",
  "/app/assets/composition-editing-DusONg7M.js",
  "/app/assets/composition-effects-browser-Dc40gjED.js",
  "/app/assets/composition-properties-QBmDXQjD.js",
  "/app/assets/composition-stage-controls-TzT_E7L5.js",
  "/app/assets/composition-timeline-lBMPWw6i.js",
  "/app/assets/compositor-CTBuqH_1.js",
  "/app/assets/delivery-workspace-D8JM2kMZ.js",
  "/app/assets/diamond-DLF8Blgq.js",
  "/app/assets/download-CRyw3Gn3.js",
  "/app/assets/editor-preview-stage-Sg_hoA1n.js",
  "/app/assets/effect-audition-store-Bu_XNC1X.js",
  "/app/assets/effects-browser-B1XiruTw.js",
  "/app/assets/filler-DnH6M3Pn.js",
  "/app/assets/film-D9bFh5Wj.js",
  "/app/assets/folder-open-BYSDsqWe.js",
  "/app/assets/format-BM5q1oyU.js",
  "/app/assets/gauge-KQtUMGH2.js",
  "/app/assets/grade-PN0GyzWv.js",
  "/app/assets/graph-profiler-2E57EuYe.js",
  "/app/assets/grid-2x2-ByATumUp.js",
  "/app/assets/index-C6CpanVh.css",
  "/app/assets/index-CGoBnuvH.js",
  "/app/assets/inspector-section-C9_NVNwu.js",
  "/app/assets/jsx-runtime-Dxo5pGJX.js",
  "/app/assets/keyframes-B4JxcWvw.js",
  "/app/assets/live-audio-meter-BZYb690x.js",
  "/app/assets/lock-BaQR999l.js",
  "/app/assets/lock-open-_SiU7Bm4.js",
  "/app/assets/maximize-2-DgzhsWID.js",
  "/app/assets/media-browser-Cmd_C87y.js",
  "/app/assets/media-file-utils-DOzPRPEP.js",
  "/app/assets/mobile-studio-DhcWWbU-.css",
  "/app/assets/mobile-studio-Drk0jjVZ.js",
  "/app/assets/move-CmnwDGUR.js",
  "/app/assets/music-2-DnGOkpUL.js",
  "/app/assets/native-audio-preparation-ClSSKMBe.js",
  "/app/assets/new-project-dialog-B18mvakt.js",
  "/app/assets/page-CpzRr_gZ.js",
  "/app/assets/palette-BRwnXdrC.js",
  "/app/assets/pcm-stretch-BGF5Ivpy.js",
  "/app/assets/play-DLJZyWp4.js",
  "/app/assets/plus-lPzJ9PKd.js",
  "/app/assets/power-BCE-40YX.js",
  "/app/assets/prepare-auto-draft-DdYciGZb.js",
  "/app/assets/prepare-story-draft-yzqT3557.js",
  "/app/assets/pro-editor-DH1mv2oV.js",
  "/app/assets/recovery-history-panel-CsHlGY_m.js",
  "/app/assets/render-client-C9lNe0aB.js",
  "/app/assets/render-engine-_X9AO1wu.js",
  "/app/assets/render-job-state-CBlRNY0o.js",
  "/app/assets/render.worker-DWqTXVGz.js",
  "/app/assets/rotate-ccw-CVBJFQtA.js",
  "/app/assets/roto-review-CcUCKA2Z.js",
  "/app/assets/roto-subject-panel-Ce6KVCBQ.js",
  "/app/assets/rotoscope-CqcNxn5w.js",
  "/app/assets/save-BvchXgTK.js",
  "/app/assets/scenepilot-loop-BKPo0rC7.mp4",
  "/app/assets/scheduling-Cuz68iC2.js",
  "/app/assets/scissors-BYY-ZjSY.js",
  "/app/assets/search-D6CRg9yP.js",
  "/app/assets/semantic-segmenter-Cl5l0jKr.js",
  "/app/assets/sequence-inspector-SVUAVZlw.js",
  "/app/assets/sequence-readiness-K7tSIbHG.js",
  "/app/assets/settings-2-DEMU8_1S.js",
  "/app/assets/shell-disclosure-CyO69Kaa.js",
  "/app/assets/sliders-horizontal-DzrkXtic.js",
  "/app/assets/song-analysis.worker-Dx31y1So.js",
  "/app/assets/song-beat-map-CuXkjrK0.js",
  "/app/assets/song-sync-panel-DfAppFWQ.js",
  "/app/assets/source-edit-B4FYkHes.js",
  "/app/assets/source-program-monitor-CyATCQTU.js",
  "/app/assets/sparkles-BV7X64rN.js",
  "/app/assets/split-CwewslTt.js",
  "/app/assets/src-BmVtqiNZ.js",
  "/app/assets/story-edit-DPDchcPM.js",
  "/app/assets/strobe-DEtyMFLI.js",
  "/app/assets/strobe-timing-controls-CostNtPc.js",
  "/app/assets/studio-shell-D9Wz7_g4.js",
  "/app/assets/styles-B-PqUzjt.js",
  "/app/assets/take-select-D3u0eO_f.js",
  "/app/assets/text-animate-E7z3pVhD.js",
  "/app/assets/timeline-playhead-DYqDsoNb.js",
  "/app/assets/transcribe-client-Bd86HevR.js",
  "/app/assets/transcribe.worker-C3Sg3qRy.js",
  "/app/assets/transcript-edit-BaIW3-GZ.js",
  "/app/assets/transcript-editor-CctAOg6K.js",
  "/app/assets/trash-2-JYIfWcMb.js",
  "/app/assets/type-Bg5lxVoE.js",
  "/app/assets/undo-2-CLMqaIJt.js",
  "/app/assets/use-timeline-scrub-IH8Ovcjd.js",
  "/app/assets/video-BZkeOI90.js",
  "/app/assets/vision_bundle-DOpPu9mF.js",
  "/app/assets/volume-x-CMEDmDMt.js",
  "/app/assets/wand-sparkles-BPmnJKzj.js",
  "/app/assets/waves-horizontal-D7HisBzl.js",
  "/app/",
  "/app/models/selfie_segmenter.tflite",
  "/tools/assets/analysis-engine-B9VZ7SfX.js",
  "/tools/assets/autocut-ClFAvKVV.js",
  "/tools/assets/board-M4EO_Njq.js",
  "/tools/assets/captions-Ci8o9fi_.js",
  "/tools/assets/file-text-CUrACGAu.js",
  "/tools/assets/grade-CGZwAu5v.js",
  "/tools/assets/hub-DXGlKQe3.js",
  "/tools/assets/image-plus-WgazOpco.js",
  "/tools/assets/play-DNUZWirb.js",
  "/tools/assets/plus-DXVidStj.js",
  "/tools/assets/project-store-D3pCI8eS.js",
  "/tools/assets/reframe-CbAGKDbS.js",
  "/tools/assets/src-DxFvLwkK.js",
  "/tools/assets/tools-DkT23Eq7.js",
  "/tools/assets/tools-uQJ6zS25.css",
  "/tools/assets/transcribe.worker-CJEiCU9P.js",
  "/tools/assets/trash-2-H1dqPSki.js",
  "/tools/assets/upload-CVjPLQEY.js",
  "/tools/assets/vision_bundle-BRn9_t6m.js",
  "/tools/autocut/",
  "/tools/board/",
  "/tools/captions/",
  "/tools/grade/",
  "/tools/",
  "/tools/models/blaze_face_short_range.tflite",
  "/tools/reframe/",
  "/manifest.webmanifest",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/app-icon-maskable-512.png",
  "/app-icon-maskable-192.png"];

const PREFIX = "scenepilot-";
const PRECACHE_NAME = `${PREFIX}precache-${BUILD_ID}`;
const RUNTIME_NAME = `${PREFIX}runtime-v1`;
const SUITE_NAME = `${PREFIX}suite-kit-v1`;
const SUITE_KIT = "https://thecreatingco.com/suite/v1/suite.js";
const NAVIGATION_TIMEOUT_MS = 3000;
const APP_ROOTS = ["/app/", "/tools/"];
const RUNTIME_PATHS = ["/app/mediapipe/", "/app/models/", "/tools/models/"];

const inAppScope = (pathname) => pathname === "/app" || pathname === "/tools" || APP_ROOTS.some((root) => pathname.startsWith(root));

/** /tools/autocut → /tools/autocut/, /tools/autocut/index.html → /tools/autocut/ */
function pageKey(pathname) {
  let path = pathname.replace(/index\.html$/, "");
  if (!path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
  return path;
}

function shellFor(pathname) {
  return pathname.startsWith("/tools") ? "/tools/" : "/app/";
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE_NAME);
    // Small batches, bypassing the HTTP cache so a deploy is never mixed with
    // stale files. A missing optional file must not block the install.
    for (let index = 0; index < PRECACHE.length; index += 8) {
      await Promise.all(PRECACHE.slice(index, index + 8).map(async (url) => {
        const response = await fetch(new Request(url, { cache: "reload", credentials: "same-origin" }));
        if (!response.ok) throw new Error(`Precache failed for ${url}: ${response.status}`);
        await cache.put(url, response);
      }));
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE_NAME, RUNTIME_NAME, SUITE_NAME]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && !keep.has(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function precached(request) {
  const cache = await caches.open(PRECACHE_NAME);
  return cache.match(request, { ignoreSearch: true });
}

async function navigation(request, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    const cache = await caches.open(PRECACHE_NAME);
    const cached = await cache.match(pageKey(url.pathname)) || await cache.match(shellFor(url.pathname));
    if (cached) return cached;
    throw error;
  }
}

async function runtime(request) {
  const cache = await caches.open(RUNTIME_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((response) => {
    if (response.ok && response.type === "basic") void cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    network.catch(() => undefined);
    return cached;
  }
  return network;
}

async function runtimeHead(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await (await caches.open(RUNTIME_NAME)).match(request.url, { ignoreSearch: true, ignoreMethod: true });
    if (cached) return new Response(null, { status: 200, headers: cached.headers });
    throw error;
  }
}

async function suiteKit(request) {
  const cache = await caches.open(SUITE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(SUITE_KIT, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(SUITE_KIT);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.href === SUITE_KIT && request.method === "GET") {
    event.respondWith(suiteKit(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.method === "HEAD" && RUNTIME_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(runtimeHead(request));
    return;
  }
  if (request.method !== "GET" || request.headers.has("range")) return;
  if (!inAppScope(url.pathname)) return;
  if (request.mode === "navigate") {
    event.respondWith(navigation(request, url));
    return;
  }
  if (RUNTIME_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(runtime(request));
    return;
  }
  event.respondWith(precached(request).then((cached) => cached || fetch(request)));
});
