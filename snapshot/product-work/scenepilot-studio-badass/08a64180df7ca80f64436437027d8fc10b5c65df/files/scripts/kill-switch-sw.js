/* global caches, self */
// ScenePilot service-worker KILL SWITCH. Dependency-free and self-unregistering.
// Use only if the installed PWA itself is broken in people's browsers:
//   cp scripts/kill-switch-sw.js site/sw.js   (or upload it as /sw.js in an overlay deploy)
// /sw.js is served `Cache-Control: no-cache`, so browsers pick this up on their
// next visit: it activates at once, deletes every scenepilot-* cache, unregisters
// itself and reloads open ScenePilot tabs straight from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("scenepilot-")).map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => undefined)));
  })());
});
