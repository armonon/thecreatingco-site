// Suite kit + Locker check in headless Chrome with the REAL kit from
// https://thecreatingco.com/suite/v1/suite.js.
//
//   node scripts/locker-check.mjs https://scenepilot.thecreatingco.com
//   LOCAL_SITE=1 CERT_DIR=/tmp/sp-cert node scripts/locker-check.mjs
//     serves ./site over HTTPS as https://scenepilot.thecreatingco.com (Chrome
//     host-resolver mapping + self-signed cert) so the same-site bridge
//     transport is exercised before anything is published.
//
// Checks: the menu renders in <tcc-suite-menu> in the editor and tool headers;
// AutoCut "XML to Locker" saves into the Locker; a WAV in the Locker opened with
// ?tcc-open=<id> lands in AutoCut and in the editor; pages without the kit work.
import { createServer } from "node:https";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..", "site");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mediaDir = process.env.MEDIA_DIR ?? "/Users/agentsattari/code/wave4/s1/premiere-test/media";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".wasm": "application/wasm" };
let origin = process.argv[2] ?? "https://scenepilot.thecreatingco.com";
const args = [];
let server;
if (process.env.LOCAL_SITE) {
  const certDir = process.env.CERT_DIR ?? "/tmp/sp-cert";
  server = createServer({ key: readFileSync(`${certDir}/key.pem`), cert: readFileSync(`${certDir}/cert.pem`) }, (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "https://x").pathname);
    let file = path.join(root, pathname);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) { response.writeHead(404).end("not found"); return; }
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    response.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = "https://scenepilot.thecreatingco.com";
  args.push(`--host-resolver-rules=MAP scenepilot.thecreatingco.com 127.0.0.1:${server.address().port}`, "--ignore-certificate-errors");
}
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };
const browser = await chromium.launch({ executablePath: chrome, headless: true, args });
const context = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } });
const errors = [];
context.on("page", (page) => {
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${page.url()} :: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`${page.url()} :: ${error.message}`));
});
const page = await context.newPage();
const kitReady = () => page.waitForFunction(() => window.TCC && window.TCC.ready, undefined, { timeout: 20000 }).then(() => page.evaluate(() => window.TCC.ready.then((tcc) => ({ mode: tcc.locker?.mode, app: document.querySelector("script[data-app]")?.getAttribute("data-app") })))).catch(() => null);
const menuRendered = () => page.evaluate(() => {
  const host = document.querySelector("tcc-suite-menu");
  return Boolean(host && (host.shadowRoot?.childElementCount || host.childElementCount || host.getBoundingClientRect().width > 0));
});

try {
  for (const url of ["/app/", "/tools/", "/tools/autocut/", "/tools/reframe/", "/tools/captions/", "/tools/board/", "/tools/grade/"]) {
    await page.goto(`${origin}${url}`, { waitUntil: "load" });
    const kit = await kitReady();
    await page.waitForSelector("tcc-suite-menu", { timeout: 30000 }).catch(() => undefined);
    check(`suite kit + menu on ${url}`, Boolean(kit) && await menuRendered(), kit ? `app=${kit.app} mode=${kit.mode}` : "kit not ready");
  }

  // Save AutoCut's Premiere XML into the Locker.
  await page.goto(`${origin}/tools/autocut/`, { waitUntil: "load" });
  await kitReady();
  await page.setInputFiles('input[aria-label="Choose song and clips"]', ["song.wav", "clip A.mp4", "clip B.mp4", "clip C.mp4"].map((name) => path.join(mediaDir, name)));
  const lockerButton = page.locator("button", { hasText: "XML to Locker" });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("XML to Locker") && !button.disabled), undefined, { timeout: 120000 });
  await lockerButton.click();
  const saved = await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Saved"), undefined, { timeout: 30000 }).then(() => true).catch(() => false);
  const listed = await page.evaluate(async () => (await window.TCC.locker.list()).filter((entry) => entry.name.endsWith("-autocut-premiere.xml")));
  check("AutoCut XML to Locker", saved && listed.length > 0, listed[0] ? `${listed[0].name} · ${listed[0].size} B · app=${listed[0].app}` : (await page.locator(".status-line").innerText()));

  // Header "Save to Locker" for the latest export (the EDL download).
  await Promise.all([page.waitForEvent("download"), page.locator("button", { hasText: /^EDL$/ }).click()]);
  await page.locator(".tool-locker").click();
  const headerSaved = await page.waitForFunction(() => document.querySelector(".tool-locker")?.textContent?.includes("Saved"), undefined, { timeout: 30000 }).then(() => true).catch(() => false);
  check("tool header Save to Locker (latest export)", headerSaved);

  // A WAV put in the Locker, then opened in AutoCut and the editor via ?tcc-open=.
  const wav = readFileSync(path.join(mediaDir, "song.wav")).toString("base64");
  const id = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return window.TCC.locker.save({ name: "locker-song.wav", type: "audio/wav", blob: new Blob([bytes], { type: "audio/wav" }), meta: { test: "s1" } });
  }, wav);
  await page.goto(`${origin}/tools/autocut/?tcc-open=${encodeURIComponent(id)}`, { waitUntil: "load" });
  const opened = await page.waitForFunction(() => document.body.innerText.includes("locker-song.wav") || /Added 0 clips and 1 audio/.test(document.body.innerText), undefined, { timeout: 30000 }).then(() => true).catch(() => false);
  check("Locker → AutoCut (?tcc-open)", opened, page.url());
  await page.goto(`${origin}/app/?tcc-open=${encodeURIComponent(id)}`, { waitUntil: "load" });
  const editorOpened = await page.waitForFunction(() => document.body.innerText.includes("locker-song.wav"), undefined, { timeout: 45000 }).then(() => true).catch(() => false);
  check("Locker → editor (?tcc-open)", editorOpened);
  const cleanup = await page.evaluate(async (entryId) => { try { await window.TCC.ready; await window.TCC.locker.remove?.(entryId); return true; } catch { return false; } }, id);
  console.log(`  (test file removed from Locker: ${cleanup})`);

  // Kit unreachable: everything still works.
  // Fresh context without service workers, so the worker's cached copy of the kit can't stand in.
  const bare = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: "block" });
  await bare.route("https://thecreatingco.com/suite/v1/suite.js", (route) => route.abort());
  const blocked = await bare.newPage();
  blocked.on("pageerror", (error) => errors.push(`${blocked.url()} :: ${error.message}`));
  await blocked.goto(`${origin}/tools/autocut/`, { waitUntil: "load" });
  const works = await blocked.waitForFunction(() => document.body.innerText.includes("Drop a song"), undefined, { timeout: 20000 }).then(() => true).catch(() => false);
  check("AutoCut works with the kit blocked", works && !(await blocked.evaluate(() => Boolean(window.TCC))));
  await blocked.goto(`${origin}/app/`, { waitUntil: "load" });
  check("editor works with the kit blocked", await blocked.waitForSelector(".topbar, .mobile-studio", { timeout: 30000 }).then(() => true).catch(() => false));
} finally {
  const relevant = errors.filter((line) => !/suite\/v1\/suite\.js|net::ERR_FAILED|ERR_BLOCKED|Failed to load resource/.test(line));
  check("no console errors", relevant.length === 0, relevant.slice(0, 4).join(" | "));
  await browser.close();
  server?.close();
  console.log(`\n${results.filter((result) => result.ok).length}/${results.length} checks passed`);
  process.exitCode = results.every((result) => result.ok) ? 0 : 1;
}
