/** Local production-build regression: generated reference video survives all opens.
 * npm run build && node scripts/video-reopen-check.mjs
 * Locker is a local API contract stub; no live handoff or release is claimed.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { preview } from 'vite';
import JSZip from 'jszip';

const dir = mkdtempSync(path.join(tmpdir(), 'animate-video-reopen-'));
const fixture = path.join(dir, 'red.mp4');
execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=red:s=160x90:d=1','-c:v','libx264','-pix_fmt','yuv420p', fixture]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(readFileSync(fixture));
const server = await preview({ preview: { host: '127.0.0.1', port: 4337, strictPort: true } });
const base = 'http://127.0.0.1:4337';
let context;
const checks = [];
const errors = [];
async function openContext() {
  const ctx = await chromium.launchPersistentContext(path.join(dir, 'profile'), { headless: true, acceptDownloads: true });
  await ctx.route('https://thecreatingco.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await ctx.addInitScript(() => {
    window.TCC = { locker: { save: async () => 'local-test', sendTo: async () => {}, onOpen: handler => { window.testLockerOpen = handler; } } };
    window.mediaCleanup = 0;
    window.testVideos = [];
    const create = document.createElement.bind(document);
    document.createElement = function(tag, options) { const el = create(tag, options); if(tag === 'video') window.testVideos.push(el); return el; };
    const load = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () { if (!this.getAttribute('src')) window.mediaCleanup++; return load.call(this); };
  });
  const page = ctx.pages()[0];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(base + '/');
  const stored = await page.evaluate(() => new Promise(resolve => {
    const req = indexedDB.open('animate-autosave', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('autosave', { keyPath: 'id' }); };
    req.onsuccess = () => { const db = req.result; const read = db.transaction('autosave').objectStore('autosave').get('current'); read.onsuccess = () => { resolve(read.result ?? null); db.close(); }; };
  }));
  writeFileSync(path.join(dir, `stored-before-studio-${checks.length}.json`), JSON.stringify(stored, null, 2));
  await page.goto(base + '/studio');
  await page.locator('[data-testid="studio-canvas"]').waitFor();
  return { ctx, page };
}
async function red(page, label) {
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="studio-canvas"]');
    const p = c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data;
    return p[0] > 240 && p[1] < 10 && p[2] < 10 && p[3] === 255;
  }, null, { timeout: 15000 }).catch(async err => {
    writeFileSync(path.join(dir, 'failure-diagnostics.json'), JSON.stringify(await page.evaluate(() => ({
      text: document.body.innerText,
      videos: window.testVideos.map(v => ({ srcPrefix: v.src.slice(0,100), state: v.readyState, error: v.error?.message, paused: v.paused, time: v.currentTime })),
      cleanup: window.mediaCleanup,
    })), null, 2));
    throw err;
  });
  checks.push({ label, pixel: await page.locator('canvas').first().evaluate(c => [...c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data]) });
}
async function download(page, button, filename) {
  const pending = page.waitForEvent('download');
  await button.click();
  const d = await pending;
  await d.saveAs(path.join(dir, filename));
  return path.join(dir, filename);
}
async function saved(page, label) {
  const file = await download(page, page.getByRole('button', { name: 'Save .animate', exact: true }), label + '.animate');
  const p = JSON.parse(readFileSync(file, 'utf8'));
  const video = p.layers.find(l => l.referenceKind === 'video');
  assert(video?.referenceSrc.startsWith('data:'));
  assert.equal(hash(Buffer.from(video.referenceSrc.split(',')[1], 'base64')), sourceHash);
  checks.push({ label: label + ' original video byte identity', passed: true });
  return { file, text: JSON.stringify(p) };
}
try {
  let session = await openContext(); context = session.ctx;
  let page = session.page;
  // Allow the initial autosave loader to finish before importing.
  await page.waitForTimeout(1000);
  await page.locator('input[accept="image/*,video/*"]').setInputFiles(fixture);
  await red(page, 'fresh video import');
  const project = await saved(page, 'before-reopen');
  // Wait for the actual debounced IndexedDB record, not an arbitrary reload delay.
  let record;
  for (let attempt = 0; attempt < 30; attempt++) {
    record = await page.evaluate(() => new Promise(resolve => {
      const req = indexedDB.open('animate-autosave', 1);
      req.onsuccess = () => { const db = req.result; const tx = db.transaction('autosave'); const read = tx.objectStore('autosave').get('current'); tx.oncomplete = () => { resolve(read.result ?? null); db.close(); }; };
    }));
    if (record?.json.includes('data:video')) break;
    await page.waitForTimeout(100);
  }
  writeFileSync(path.join(dir, 'record-before-reload.json'), JSON.stringify(record, null, 2));
  assert(record?.json.includes('data:video'), 'actual committed autosave must contain video before restart');
  // Exercise ordinary reload first, and allow Chromium's relaxed-durability
  // backing store to settle before a full process shutdown.
  await page.reload();
  await red(page, 'autosave page reload');
  await page.waitForTimeout(1000);
  await page.goto('about:blank');
  await context.close(); context = null;
  session = await openContext(); context = session.ctx; page = session.page;
  await red(page, 'full Chromium process restart/autosave reopen');
  await saved(page, 'after-process-reopen');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => window.mediaCleanup > 0);
  checks.push({ label: 'project replacement releases decoder', passed: true });
  await page.locator('input[accept=".animate,application/json"]').setInputFiles(project.file);
  await red(page, '.animate file reopen');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => window.testLockerOpen != null);
  await page.evaluate(text => window.testLockerOpen({ id: 'test', name: 'red.animate', type: 'application/json', blob: new Blob([text], { type: 'application/json' }) }), project.text);
  await red(page, 'Locker project-open contract stub');
  await saved(page, 'after-locker-reopen');
  await page.locator('[data-testid="open-export"]').click();
  await page.locator('[data-testid="export-png-zip"]').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="export-result"] p')?.textContent.startsWith('PNG sequence ready'));
  const zipFile = await download(page, page.locator('[data-testid="export-download"]'), 'reopened-frames.zip');
  const zip = await JSZip.loadAsync(readFileSync(zipFile));
  const pngs = Object.values(zip.files).filter(f => f.name.endsWith('.png'));
  assert(pngs.length > 0);
  for (const file of pngs) {
    const bytes = await file.async('base64');
    const pixel = await page.evaluate(async b64 => {
      const image = new Image(); image.src = 'data:image/png;base64,' + b64; await image.decode();
      const c = document.createElement('canvas'); c.width=image.width; c.height=image.height;
      const ctx=c.getContext('2d'); ctx.drawImage(image,0,0); return [...ctx.getImageData(c.width/2,c.height/2,1,1).data];
    }, bytes);
    assert(pixel[0]>240 && pixel[1]<10 && pixel[2]<10 && pixel[3]===255, `${file.name}: ${pixel}`);
  }
  checks.push({ label: 'every reopened exported PNG contains red video', frames: pngs.length, passed: true });
  await page.locator('.modal-header button').click();
  const before = await page.evaluate(() => window.mediaCleanup);
  await page.locator('.layer-list li').filter({ has: page.locator('input[value="red.mp4"]') }).getByRole('button', { name: 'Delete layer' }).click();
  await page.waitForFunction(n => window.mediaCleanup > n, before);
  checks.push({ label: 'layer removal releases decoder', passed: true });
  const imagePath = path.join(dir, 'red.png');
  writeFileSync(imagePath, await pngs[0].async('nodebuffer'));
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.locator('input[accept="image/*,video/*"]').setInputFiles(imagePath);
  await red(page, 'valid image import');
  const imageProject = await download(page, page.getByRole('button', { name: 'Save .animate', exact: true }), 'image.animate');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.locator('input[accept=".animate,application/json"]').setInputFiles(imageProject);
  await red(page, 'valid image save/file reopen');
  await page.locator('input[accept=".animate,application/json"]').setInputFiles(project.file);
  await red(page, 'video project replacement of image project');
  const beforeUnmount = await page.evaluate(() => window.mediaCleanup);
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await page.waitForFunction(n => window.mediaCleanup > n, beforeUnmount);
  checks.push({ label: 'Studio unmount releases decoder', passed: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ observed_at: new Date().toISOString(), fixture_sha256: sourceHash, checks, pageerrors: errors, artifacts: dir }, null, 2));
} finally {
  if (context) await context.close();
  await server.close();
  writeFileSync(path.join(dir, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
}
