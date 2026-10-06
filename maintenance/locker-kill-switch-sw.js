/* Locker kill switch. If /locker/sw.js ever misbehaves, deploy THIS file as
 * /locker/sw.js (same path, same no-cache header) via the usual parity/draft/
 * restore method. Browsers that check for an update (every navigation to
 * /locker/, at most ~24h with no-cache) install it; it clears the Locker
 * shell caches, unregisters itself and reloads open Locker tabs.
 * It does NOT touch IndexedDB, so users' Locker files are kept. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf('tcc-locker-shell-') === 0; }).map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(function (c) { c.navigate(c.url); });
  })());
});
