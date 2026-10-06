/* thecreateco Locker service worker. Scope: /locker/ only (never the whole site).
 * Network-first for the Locker's own shell; cached copy when offline.
 * Never caches user files (those live in IndexedDB) or anything cross-origin.
 * Updates wait for the user to click "Reload" (no silent skipWaiting).
 * Kill switch: see maintenance/locker-kill-switch-sw.js in the site repo. */
'use strict';
var CACHE = 'tcc-locker-shell-v1';
var SHELL = [
  '/locker/',
  '/locker/locker.css',
  '/locker/locker.js',
  '/locker/core.js',
  '/locker/bridge.html',
  '/locker/manifest.webmanifest',
  '/locker/icon.svg',
  '/locker/icon-192.png',
  '/locker/icon-512.png',
  '/suite/v1/suite.js',
  '/suite/v1/apps.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('tcc-locker-shell-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var key = req.mode === 'navigate' && url.pathname.indexOf('/locker/') === 0 && url.pathname.indexOf('/locker/bridge') !== 0 ? '/locker/' : url.pathname;
  if (SHELL.indexOf(key) === -1) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) { return hit || Response.error(); });
    })
  );
});
