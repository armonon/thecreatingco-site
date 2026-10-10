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

const BUILD_ID = "dev";
const PRECACHE = [];

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
