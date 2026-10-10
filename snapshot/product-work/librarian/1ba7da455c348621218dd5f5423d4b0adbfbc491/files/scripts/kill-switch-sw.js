// Librarian service worker KILL SWITCH — emergency use only.
// Deploy this file as /sw.js to remove Librarian's service worker and its caches from
// every browser that installed it (they pick it up on the next visit: /sw.js is served
// with Cache-Control: no-cache, see public/_headers). Your PDFs and shelf live in
// IndexedDB/localStorage and are NOT touched.
//   npm run build && cp scripts/kill-switch-sw.js dist/sw.js && <deploy dist>
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('librarian-') || k === 'tcc-suite-kit').map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.navigate(client.url));
  })());
});
