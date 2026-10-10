// Librarian service worker — installable + offline app shell (thecreateco Wave 4 PWA pattern).
//
// - Precaches the built app shell (HTML, JS, CSS, icons, manifest). The list and
//   VERSION are injected at build time by vite.config.js (pwaPrecache plugin), so a
//   deploy that changes any file produces a new worker and a new cache.
// - Navigations are network-first (3 s timeout) so a fresh deploy wins while online,
//   falling back to the cached copy and then the precached shell ("/") offline.
// - PDF.js support files under /pdfjs/ (cmaps, standard fonts, wasm decoders — static,
//   versioned app assets) are cached on first use so the reader renders offline.
// - NEVER cached: your PDFs (they live in IndexedDB, never fetched through here),
//   Netlify functions (/.netlify/*: search proxy, AI), and every other cross-origin
//   request (catalog APIs, book downloads, Google Fonts). The one cross-origin exception
//   is the public thecreateco suite kit script (shared app menu), so it draws offline.
// - Updates never take over mid-session: the waiting worker only calls skipWaiting()
//   when the page posts {type:'SKIP_WAITING'}, which happens only after the user taps
//   "Reload" on the "Update available" prompt (src/pwa.js).
// Kill switch: scripts/kill-switch-sw.js (see README "Service worker kill switch").
const VERSION = '__LIBRARIAN_SW_VERSION__';
const PRECACHE_URLS = self.__LIBRARIAN_PRECACHE || [];
const SHELL = `librarian-shell-${VERSION}`;
const PAGES = 'librarian-pages';
const PDFJS = 'librarian-pdfjs';
const SUITE = 'tcc-suite-kit';
const KEEP = new Set([SHELL, PAGES, PDFJS, SUITE]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith('librarian-') || key === SUITE) && !KEEP.has(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function navigation(request) {
  const url = new URL(request.url);
  const pageKey = url.origin + url.pathname; // ?q= searches share one cached page
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response.ok && !response.redirected && (response.headers.get('content-type') || '').includes('text/html')) {
      const copy = response.clone();
      caches.open(PAGES).then(cache => cache.put(pageKey, copy)).catch(() => {});
    }
    return response;
  } catch {
    return (await caches.match(pageKey, { cacheName: PAGES })) || (await caches.match('/', { cacheName: SHELL })) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request, { cacheName });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) { const copy = response.clone(); caches.open(cacheName).then(cache => cache.put(request, copy)).catch(() => {}); }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then(response => { if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).catch(() => {}); return response; }).catch(() => hit || Response.error());
  return hit || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://thecreatingco.com' && url.pathname.startsWith('/suite/v1/') && /\.(js|json|css)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SUITE));
    return;
  }
  if (url.origin !== self.location.origin) return; // cross-origin: straight to the network, never cached
  if (url.pathname.startsWith('/.netlify/')) return; // functions: always live
  if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
  if (url.pathname.startsWith('/pdfjs/')) { event.respondWith(cacheFirst(request, PDFJS)); return; }
  if (PRECACHE_URLS.includes(url.pathname)) { event.respondWith(cacheFirst(request, SHELL)); return; }
  // anything else same-origin: network only
});
