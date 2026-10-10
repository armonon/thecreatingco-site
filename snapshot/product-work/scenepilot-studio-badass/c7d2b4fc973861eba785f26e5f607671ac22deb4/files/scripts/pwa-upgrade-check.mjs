// Proves the opt-in update path: v1 worker installs and controls the page, a
// new /sw.js is published at the same URL (as an overlay deploy would), the page
// shows "Update available — reload", nothing switches until the user clicks, and
// after the click the new worker controls the page. Also proves migration from
// the old live worker (scenepilot-standalone-v3, scope /app/).
//   node scripts/pwa-upgrade-check.mjs   (needs a built site/: npm run build:site)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..", "site");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".wasm": "application/wasm" };
const current = readFileSync(path.join(root, "sw.js"), "utf8");
// The worker that is live before wave 4 (auto-activating, /app/ scope).
const legacy = `const CACHE_NAME = "scenepilot-standalone-v3";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add("/app/")).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => { if (new URL(event.request.url).pathname.startsWith("/app/")) event.respondWith(fetch(event.request).catch(() => caches.match("/app/"))); });`;
let swBody = legacy;
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
  if (pathname === "/sw.js") { response.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-cache" }); response.end(swBody); return; }
  let file = path.join(root, pathname);
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  // 0. A returning visitor controlled by the old /app/-scoped worker.
  await page.goto(`${origin}/tools/`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/app/" });
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker && worker.state !== "activated") await new Promise((resolve) => worker.addEventListener("statechange", () => worker.state === "activated" && resolve(undefined)));
  });
  await page.goto(`${origin}/app/`, { waitUntil: "load" });
  console.log("  legacy:", JSON.stringify(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => [r.scope, r.active?.state]))));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20000 });
  check("legacy /app/ worker controls the page", true);

  // 1. New build is deployed: the page migrates to the single / worker.
  swBody = current;
  await page.goto(`${origin}/app/?pwa`, { waitUntil: "load" });
  await page.waitForFunction(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length === 1 && new URL(registrations[0].scope).pathname === "/" && registrations[0].active;
  }, undefined, { timeout: 30000, polling: 500 });
  await page.reload({ waitUntil: "load" });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  const caches1 = await page.evaluate(() => caches.keys());
  check("migrated to one worker at scope /, legacy cache dropped", scope === `${origin}/` && !caches1.includes("scenepilot-standalone-v3"), `${scope} · ${caches1.join(", ")}`);

  // 2. Another deploy: same URL, new bytes. No silent swap; the toast appears.
  swBody = current.replace(/const BUILD_ID = "([^"]+)";/, 'const BUILD_ID = "$1-next";');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20000 });
  const before = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  const toast = await page.waitForSelector('[data-pwa="update"]', { timeout: 30000 }).then(() => true).catch(() => false);
  check("update toast appears", toast);
  await page.waitForTimeout(2000);
  const stillOld = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.waiting) && navigator.serviceWorker.controller?.state === "activated";
  });
  const detail = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return JSON.stringify({ waiting: r?.waiting?.state, active: r?.active?.state, installing: r?.installing?.state, controller: navigator.serviceWorker.controller?.state }); });
  check("new worker waits (no silent takeover)", stillOld && Boolean(before), detail);
  await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.getByRole("button", { name: "Update available — reload" }).click()]);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20000 });
  const caches2 = await page.evaluate(() => caches.keys());
  const waiting = await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
  check("after the click the new version controls the page", !waiting && caches2.some((key) => key.endsWith("-next")), caches2.join(", "));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
