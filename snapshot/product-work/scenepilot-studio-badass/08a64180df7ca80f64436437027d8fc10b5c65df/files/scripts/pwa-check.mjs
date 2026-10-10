// Headless-Chrome check of the installable/offline PWA and the AutoCut →
// Premiere export, against a built site/ (npm run build:site) or a live URL.
//
//   node scripts/pwa-check.mjs                       # serves ./site on 127.0.0.1
//   node scripts/pwa-check.mjs https://example.org   # checks a deployed origin
//   MEDIA_DIR=/path/with/song.wav+clips node scripts/pwa-check.mjs
//
// 1. Manifest is installable (name, id, start_url, scope, display, 192/512 + maskable icons resolve).
// 2. The service worker installs and controls /app/; /sw.js is not long-cached.
// 3. Offline: /app/ reloads into the editor, /tools/ + every tool page render.
// 4. Offline: AutoCut analyses a real song + clips and exports Premiere XML + EDL.
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..", "site");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mediaDir = process.env.MEDIA_DIR;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".tflite": "application/octet-stream", ".txt": "text/plain", ".woff2": "font/woff2" };

let origin = process.argv[2];
let server;
if (!origin) {
  server = createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, "http://x").pathname);
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    else if (!existsSync(file) && existsSync(`${file}/index.html`)) { response.writeHead(301, { location: `${pathname}/` }).end(); return; }
    if (!existsSync(file)) { response.writeHead(404, { "content-type": "text/plain" }).end("not found"); return; }
    const headers = { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": pathname === "/sw.js" ? "no-cache" : "public, max-age=0, must-revalidate" };
    response.writeHead(200, headers);
    response.end(request.method === "HEAD" ? undefined : readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
const errors = [];
context.on("page", (page) => {
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${page.url()} :: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`${page.url()} :: pageerror ${error.message}`));
});
const page = await context.newPage();

try {
  // 1. Manifest
  const manifestResponse = await page.request.get(`${origin}/manifest.webmanifest`);
  const manifest = await manifestResponse.json();
  check("manifest fields", manifest.name === "ScenePilot" && manifest.short_name === "ScenePilot" && manifest.id === "/app/" && manifest.start_url === "/app/" && manifest.scope === "/" && manifest.display === "standalone", JSON.stringify({ name: manifest.name, id: manifest.id, scope: manifest.scope }));
  const icons = await Promise.all(manifest.icons.map(async (icon) => ({ ...icon, status: (await page.request.get(new URL(icon.src, origin).toString())).status() })));
  check("manifest icons resolve (any + maskable, 192 + 512)", icons.every((icon) => icon.status === 200) && icons.some((icon) => icon.purpose === "maskable" && icon.sizes === "512x512") && icons.some((icon) => icon.purpose === "any" && icon.sizes === "192x192"), icons.map((icon) => `${icon.src}:${icon.status}`).join(" "));
  const swHead = await page.request.get(`${origin}/sw.js`);
  const swCache = swHead.headers()["cache-control"] ?? "";
  check("/sw.js is not long-cached", /no-cache|max-age=0/.test(swCache), swCache);

  // 2. Install + control
  await page.goto(`${origin}/app/?pwa`, { waitUntil: "load" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: "load" });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  check("service worker controls /app/", controlled, scope);
  const cacheInfo = await page.evaluate(async () => {
    const keys = await caches.keys();
    const precache = keys.find((key) => key.startsWith("scenepilot-precache-"));
    return { keys, entries: precache ? (await (await caches.open(precache)).keys()).length : 0 };
  });
  check("precache populated", cacheInfo.entries > 50, `${cacheInfo.entries} entries in ${cacheInfo.keys.join(", ")}`);
  await page.goto(`${origin}/tools/autocut/`, { waitUntil: "load" });
  check("service worker controls /tools/", await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));

  // 3. Offline navigation
  await context.setOffline(true);
  for (const [url, text] of [["/app/", "SCENEPILOT"], ["/app", "SCENEPILOT"], ["/tools/", "Film tools."], ["/tools/autocut/", "Drop a song"], ["/tools/reframe/", "Reframe"], ["/tools/captions/", "Captions"], ["/tools/board/", "Board"], ["/tools/grade/", "Grade"], ["/app/?tcc-open=missing", "SCENEPILOT"]]) {
    const response = await page.goto(`${origin}${url}`, { waitUntil: "load" }).catch((error) => error);
    await page.waitForFunction((needle) => document.body.innerText.toLowerCase().includes(needle.toLowerCase()), text, { timeout: 20000 }).catch(() => undefined);
    const body = await page.evaluate(() => document.body.innerText).catch(() => "");
    check(`offline ${url}`, body.toLowerCase().includes(text.toLowerCase()), response instanceof Error ? response.message : `status ${response?.status()}`);
  }
  // The editor's lazily loaded workspace chunk must also come from the cache.
  await page.goto(`${origin}/app/`, { waitUntil: "load" });
  const editorReady = await page.waitForSelector(".topbar, .mobile-studio", { timeout: 30000 }).then(() => true).catch(() => false);
  check("offline editor workspace renders (lazy chunks from cache)", editorReady);
  const premiereButtonInEditorSource = await page.evaluate(async () => (await fetch("/app/").then((r) => r.text())).length > 0);
  check("offline fetch of /app/ from the worker", premiereButtonInEditorSource);

  // 4. Offline AutoCut run + Premiere export
  if (mediaDir) {
    await page.goto(`${origin}/tools/autocut/`, { waitUntil: "load" });
    const files = readdirSync(mediaDir).filter((name) => /\.(wav|mp3|mp4|mov)$/i.test(name)).map((name) => path.join(mediaDir, name));
    await page.setInputFiles('input[aria-label="Choose song and clips"]', files);
    const ready = await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Export for Premiere"));
      return button && !button.disabled;
    }, undefined, { timeout: 120000 }).then(() => true).catch(() => false);
    check("offline AutoCut analyses the song + clips and cuts", ready, (await page.locator(".status-line").innerText().catch(() => "")).slice(0, 160));
    if (ready) {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export for Premiere" }).click()]);
      const xml = readFileSync(await download.path(), "utf8");
      const clipItems = (xml.match(/<clipitem /g) ?? []).length;
      check("offline Export for Premiere downloads xmeml v4", xml.includes('<xmeml version="4">') && clipItems > 1 && xml.includes("<mediatype>audio</mediatype>"), `${download.suggestedFilename()} · ${clipItems} clipitems · ${(xml.match(/<marker>/g) ?? []).length} markers`);
      const [edl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "EDL", exact: true }).click()]);
      const edlText = readFileSync(await edl.path(), "utf8");
      check("offline EDL export (CMX3600)", /^TITLE: /.test(edlText) && /FCM: /.test(edlText), `${edl.suggestedFilename()} · ${(edlText.match(/^\d{3} /gm) ?? []).length} events`);
    }
  }
  await context.setOffline(false);
} finally {
  const relevant = errors.filter((line) => !/suite\/v1\/suite\.js|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED|Failed to load resource/.test(line));
  check("no console errors (excluding expected offline network failures / missing suite kit)", relevant.length === 0, relevant.slice(0, 5).join(" | "));
  if (errors.length !== relevant.length) console.log(`  (ignored ${errors.length - relevant.length} expected network errors)`);
  await browser.close();
  server?.close();
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}
