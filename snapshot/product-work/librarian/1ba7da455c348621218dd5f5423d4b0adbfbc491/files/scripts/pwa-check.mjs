#!/usr/bin/env node
/**
 * PWA verification for Librarian (headless Chromium). `npm run build` first.
 *
 *   PWA_CHECK_URL=https://… node scripts/pwa-check.mjs   → offline checks against a deployed site
 *   node scripts/pwa-check.mjs                            → offline checks + update-prompt cycle on dist/
 *
 * 1. Installability: manifest linked, name "Librarian", standalone, 192/512 + maskable icons resolve.
 * 2. Service worker registers and controls the page after a reload.
 * 3. Imports a PDF into the Library, goes fully offline (context.setOffline): reload, the
 *    Library still lists it, the reader opens and paints the page (PDF.js worker precached).
 * 4. Cache audit: no cached response is a PDF/user file, nothing cross-origin except the
 *    suite kit script, no Netlify function responses.
 * 5. (local only) Update cycle: v1 installed → v2 goes live at the same URL → "Update available"
 *    toast → Reload → v2 controls the page. Never swaps silently.
 * Zero console errors throughout (a failed load of the optional suite kit is ignored).
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fail = msg => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const ok = msg => console.log(`ok — ${msg}`);
const isSuiteKit = (url = '') => /^https:\/\/thecreatingco\.com\/(suite|locker)\//.test(url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Minimal valid one-page PDF with a big black square, built with correct xref offsets.
function tinyPdf() {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>'];
  const stream = '0 0 0 rg 50 50 200 200 re f';
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// Static server standing in for Netlify: one fixed origin whose content can be swapped (a deploy).
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.json': 'application/json' };
function serve() {
  let dir = null;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(dir, decodeURIComponent(url.pathname));
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    if (url.pathname === '/sw.js') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers).end(readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, () => resolve({ server, base: `http://localhost:${server.address().port}/`, setDir: d => { dir = d; } })));
}

const remote = process.env.PWA_CHECK_URL;
let local = null, tmp = null;
if (!remote) {
  tmp = mkdtempSync(path.join(tmpdir(), 'librarian-pwa-'));
  cpSync(path.join(root, 'dist'), path.join(tmp, 'v1'), { recursive: true });
  cpSync(path.join(root, 'dist'), path.join(tmp, 'v2'), { recursive: true });
  // v2 = a "new deploy": different shell HTML and therefore a different precache VERSION / sw.js bytes.
  const v2Html = path.join(tmp, 'v2', 'index.html');
  writeFileSync(v2Html, readFileSync(v2Html, 'utf8').replace('</body>', '<!-- pwa-check-v2 --></body>'));
  const v2Sw = path.join(tmp, 'v2', 'sw.js');
  writeFileSync(v2Sw, readFileSync(v2Sw, 'utf8').replace(/const VERSION = "([0-9a-f]+)"/, 'const VERSION = "$1v2"'));
  local = await serve(); local.setDir(path.join(tmp, 'v1'));
}
const base = remote || local.base;
console.log(`${remote ? 'remote site' : 'local static server'} at ${base}`);

const consoleErrors = [];
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !isSuiteKit(m.location().url)) consoleErrors.push(`${m.text()} @ ${m.location().url}`); });
  page.on('pageerror', e => consoleErrors.push(String(e)));

  await page.goto(base, { waitUntil: 'load' });
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(new URL(href, base).toString())).json();
  if (manifest.name !== 'Librarian' || manifest.short_name !== 'Librarian') fail(`manifest name/short_name: ${manifest.name}/${manifest.short_name}`);
  if (manifest.display !== 'standalone' || !manifest.start_url) fail('manifest display/start_url');
  const icons = manifest.icons || [];
  if (!icons.some(i => i.sizes === '192x192') || !icons.some(i => i.sizes === '512x512') || !icons.some(i => (i.purpose || '').includes('maskable'))) fail('manifest icons incomplete');
  for (const i of icons) if (!(await page.request.get(new URL(i.src, base).toString())).ok()) fail(`icon ${i.src} does not resolve`);
  ok(`manifest "${manifest.name}" (standalone, ${icons.length} icons incl. maskable, all resolve)`);
  const swHeaders = (await page.request.get(new URL('/sw.js', base).toString())).headers();
  if (!/no-cache/.test(swHeaders['cache-control'] || '')) fail(`/sw.js Cache-Control is "${swHeaders['cache-control']}", expected no-cache`); else ok('/sw.js served Cache-Control: no-cache');

  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 20000 });
  await page.reload({ waitUntil: 'load' });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) fail('page not controlled by the service worker after reload'); else ok('service worker controls the page');

  // Import a PDF into the Library.
  await page.getByRole('button', { name: /^Library/ }).first().click();
  await page.locator('input[data-import]').first().setInputFiles({ name: 'pwa-check-book.pdf', mimeType: 'application/pdf', buffer: tinyPdf() });
  await page.getByText('pwa-check-book').first().waitFor({ timeout: 15000 });
  ok('imported a PDF into the Library');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.getByRole('button', { name: /^Library/ }).first().click();
  await page.getByText('pwa-check-book').first().waitFor({ timeout: 15000 });
  ok('offline reload: app shell loads and the Library still lists the PDF');
  await page.locator('[data-read]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(c => c.width > 50 && c.height > 50), null, { timeout: 20000 });
  ok('offline: the reader opened and painted the PDF page (PDF.js worker served from the precache)');
  await context.setOffline(false);

  const audit = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        const res = await cache.match(req);
        out.push({ cache: name, url: req.url, type: res.headers.get('content-type') || '', opaque: res.type === 'opaque' });
      }
    }
    return out;
  });
  const origin = new URL(base).origin;
  const bad = audit.filter(e => /pdf/i.test(e.type) || e.url.includes('/.netlify/') || e.url.startsWith('blob:') || (!e.url.startsWith(origin) && !/^https:\/\/thecreatingco\.com\/suite\//.test(e.url)));
  if (bad.length) fail(`caches hold user/cross-origin/function data:\n${bad.map(b => `${b.cache} ${b.url} ${b.type}`).join('\n')}`);
  else ok(`cache audit: ${audit.length} entries, all same-origin app assets (or the suite kit) — no PDFs, no function responses, nothing else cross-origin`);

  if (local) {
    local.setDir(path.join(tmp, 'v2'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await page.getByText('Update available.').waitFor({ timeout: 20000 }).catch(() => fail('no "Update available" prompt after v2 went live'));
    const stillV1 = !(await page.content()).includes('pwa-check-v2');
    if (stillV1) ok('"Update available" prompt shown; page still on v1 (no silent swap)'); else fail('page swapped to v2 before the user clicked Reload');
    await Promise.all([page.waitForNavigation({ timeout: 20000 }), page.locator('.pwa-toast').getByRole('button', { name: 'Reload' }).click()]);
    await page.waitForLoadState('load');
    if ((await page.content()).includes('pwa-check-v2')) ok('after Reload the page serves v2 via the new worker'); else fail('after Reload the page is not on v2');
  }

  if (consoleErrors.length) fail(`${consoleErrors.length} console error(s):\n${consoleErrors.join('\n')}`); else ok('zero console errors');
} finally {
  await browser.close();
  local?.server.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
