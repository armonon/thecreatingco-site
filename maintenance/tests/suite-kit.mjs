#!/usr/bin/env node
// Headless-Chrome test for the suite kit (/suite/v1/) and Locker (/locker/).
//
//   SUITE_BASE=https://<deploy>--momentium-creative.netlify.app node maintenance/tests/suite-kit.mjs
//   SUITE_BASE=https://thecreatingco.com node maintenance/tests/suite-kit.mjs
//
// Env: PLAYWRIGHT (path to a playwright package), CHROME (Chrome executable).
// When SUITE_BASE is a draft, requests to https://thecreatingco.com/{suite,locker}/
// are proxied to the draft so the same-site (bridge) path can be tested pre-publish.
import { createRequire } from 'node:module';
import http from 'node:http';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/agentsattari/code/wave2/sattari-all/node_modules/playwright');
const CHROME = process.env.CHROME || '/Users/agentsattari/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const BASE = (process.env.SUITE_BASE || 'https://thecreatingco.com').replace(/\/$/, '');
const PROD = 'https://thecreatingco.com';
const proxying = BASE !== PROD;

let failures = 0, passes = 0;
function check(name, ok, info = '') {
  if (ok) { passes++; console.log(`  ok   ${name}${info ? ' — ' + info : ''}`); }
  else { failures++; console.log(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

function testPage({ base = BASE, app = 'split', locker = '', menu = true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>suite kit test</title>
<style>body{margin:0;font:16px system-ui}header{display:flex;gap:8px;align-items:center;height:48px;padding:0 12px;background:#eee;color:#111}
tcc-suite-menu{display:inline-block;width:36px;height:36px;flex:none}</style>
<script>window.__cls=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})}catch(e){}</script>
</head><body>
<header>${menu ? '<tcc-suite-menu></tcc-suite-menu>' : ''}<span id="title">Test app</span><button id="other">other</button></header>
<main><p id="para">Body text that must not move.</p>
<button id="save">save</button><button id="list">list</button><button id="get">get</button><button id="send">send</button><button id="senddirect">senddirect</button></main>
<script src="${base}/suite/v1/suite.js" data-app="${app}" ${locker ? `data-locker="${locker}"` : ''} defer></script>
<script>
const bytes = new Uint8Array(300000); for (let i = 0; i < bytes.length; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
window.__expected = null;
async function sha(b){ const d = await crypto.subtle.digest('SHA-256', b instanceof Blob ? await b.arrayBuffer() : b); return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
sha(bytes).then(h => window.__expected = h);
const wrap = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, code: e.code, msg: e.message }));
document.getElementById('save').onclick = () => { window.__p = wrap(TCC.locker.save({ name: 'k-test-' + Date.now() + '.bin', type: 'application/octet-stream', blob: new Blob([bytes]), meta: { test: 'k' } })); };
document.getElementById('list').onclick = () => { window.__p = wrap(TCC.locker.list({ types: ['application/octet-stream'] })); };
document.getElementById('get').onclick = () => { window.__p = wrap(TCC.locker.get(window.__id).then(async e => ({ name: e.name, app: e.app, size: e.size, meta: e.meta, sha: await sha(e.blob) }))); };
document.getElementById('send').onclick = () => { window.__p = wrap(TCC.locker.sendTo(window.__target || 'split', window.__id)); };
document.getElementById('senddirect').onclick = () => { window.__p = wrap(TCC.locker.sendTo(window.__target || 'split', { name: 'direct.wav', type: 'audio/wav', blob: new Blob([bytes], { type: 'audio/wav' }) })); };
</script></body></html>`;
}

function receiverPage(base, app) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>receiver</title></head><body><h1>receiver ${app}</h1>
<script src="${base}/suite/v1/suite.js" data-app="${app}" defer></script>
<script>
window.__got = new Promise(res => {
  const go = () => TCC.locker.onOpen(async e => {
    const d = await crypto.subtle.digest('SHA-256', await e.blob.arrayBuffer());
    res({ name: e.name, type: e.type, size: e.size, sha: [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join(''), search: location.search });
  });
  if (window.TCC) go(); else addEventListener('tcc:ready', go, { once: true });
});
</script></body></html>`;
}

async function main() {
  console.log(`suite kit test against ${BASE}${proxying ? ' (thecreatingco.com/{suite,locker} proxied to it)' : ''}`);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (u.pathname === '/app') return res.end(testPage({ locker: u.searchParams.get('locker') || '', menu: u.searchParams.get('menu') !== '0' }));
    res.statusCode = 404; res.end('nope');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const LOCAL = `http://localhost:${port}`;

  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: proxying ? 'block' : 'allow' });
  const errors = [];
  context.on('page', p => p.on('pageerror', e => errors.push(`${p.url()}: ${e.message}`)));

  // Fake app origins (route fulfills them inside the browser; no DNS involved).
  await context.route('https://sattarimusic.com/studio/split*', r => r.fulfill({ contentType: 'text/html', body: receiverPage(BASE, 'split') }));
  await context.route('https://evilthecreatingco.com/**', r => r.fulfill({ contentType: 'text/html', body: testPage({ locker: new URL(r.request().url()).searchParams.get('locker') || 'bridge' }) }));
  await context.route('https://scenepilot.thecreatingco.com/__tcc_k_test*', r => r.fulfill({ contentType: 'text/html', body: testPage({ base: PROD, app: 'scenepilot' }) }));
  await context.route('https://luma.thecreatingco.com/studio*', r => r.fulfill({ contentType: 'text/html', body: receiverPage(PROD, 'luma') }));
  if (proxying) {
    await context.route(/^https:\/\/thecreatingco\.com\/(suite|locker)\//, async r => {
      const target = r.request().url().replace(PROD, BASE);
      const resp = await r.fetch({ url: target });
      let body = await resp.body();
      await r.fulfill({ response: resp, body });
    });
  }

  // ---- 1. menu renders, no layout shift, keyboard -------------------------
  console.log('\n[menu] localhost page, <tcc-suite-menu> in header');
  // Baseline: same page with suite.js unreachable (simulates offline). Must not error.
  const offCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await offCtx.route(/\/suite\/v1\/suite\.js/, r => r.abort('internetdisconnected'));
  const offPage = await offCtx.newPage();
  const offErrors = [];
  offPage.on('pageerror', e => offErrors.push(e.message));
  await offPage.goto(`${LOCAL}/app`);
  await offPage.waitForTimeout(500);
  const before = await offPage.evaluate(() => ['#title', '#para', '#other'].map(s => JSON.stringify(document.querySelector(s).getBoundingClientRect())));
  check('suite.js unreachable: page still works, no errors, no TCC', offErrors.length === 0 && await offPage.evaluate(() => !window.TCC && document.querySelector('#save') !== null));
  await offCtx.close();
  const page = await context.newPage();
  await page.goto(`${LOCAL}/app`);
  await page.waitForFunction(() => window.TCC && document.querySelector('tcc-suite-menu').shadowRoot);
  await page.evaluate(() => window.TCC.ready);
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => ['#title', '#para', '#other'].map(s => JSON.stringify(document.querySelector(s).getBoundingClientRect())));
  check('menu upgraded (shadow root + button)', await page.evaluate(() => !!document.querySelector('tcc-suite-menu').shadowRoot.querySelector('button[aria-label]')));
  check('no layout movement of surrounding elements', JSON.stringify(before) === JSON.stringify(after));
  const cls = await page.evaluate(() => window.__cls);
  check('CLS == 0', cls === 0, `cls=${cls}`);
  check('no floating button when header menu exists', await page.evaluate(() => !document.querySelector('tcc-suite-menu[floating]')));
  await page.focus('tcc-suite-menu');
  await page.keyboard.press('Tab'); // into shadow button if not focused
  await page.evaluate(() => document.querySelector('tcc-suite-menu').shadowRoot.querySelector('button').focus());
  await page.keyboard.press('Enter');
  const panel = await page.evaluate(() => {
    const host = document.querySelector('tcc-suite-layer');
    const p = host && host.shadowRoot.querySelector('.panel');
    if (!p || p.hidden) return null;
    const r = p.getBoundingClientRect();
    return { groups: [...p.querySelectorAll('h2')].map(h => h.textContent), links: p.querySelectorAll('a').length,
      current: (p.querySelector('a[aria-current=page]') || {}).textContent, focused: host.shadowRoot.activeElement && host.shadowRoot.activeElement.textContent,
      expanded: document.querySelector('tcc-suite-menu').shadowRoot.querySelector('button').getAttribute('aria-expanded'), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 };
  });
  check('panel opens with Make/Film/Music/Everyday', panel && panel.groups.join(',') === 'Make,Film,Music,Everyday', JSON.stringify(panel && panel.groups));
  check('panel lists all apps + Locker + home', panel && panel.links >= 25, `links=${panel && panel.links}`);
  check('current app marked aria-current', panel && /Split/.test(panel.current || ''), panel && panel.current);
  check('focus moved into panel', panel && !!panel.focused);
  check('aria-expanded=true', panel && panel.expanded === 'true');
  check('panel inside viewport', panel && panel.inView);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => ({ hidden: document.querySelector('tcc-suite-layer').shadowRoot.querySelector('.panel').hidden,
    focus: document.activeElement && document.activeElement.tagName, expanded: document.querySelector('tcc-suite-menu').shadowRoot.querySelector('button').getAttribute('aria-expanded') }));
  check('Escape closes and returns focus to trigger', closed.hidden && closed.focus === 'TCC-SUITE-MENU' && closed.expanded === 'false', JSON.stringify(closed));
  const afterMenu = await page.evaluate(() => ['#title', '#para', '#other'].map(s => JSON.stringify(document.querySelector(s).getBoundingClientRect())));
  check('opening/closing panel did not move layout', JSON.stringify(afterMenu) === JSON.stringify(before));

  // mobile: bottom sheet
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mpage.goto(`${LOCAL}/app`);
  await mpage.waitForFunction(() => window.TCC && document.querySelector('tcc-suite-menu').shadowRoot);
  await mpage.evaluate(() => document.querySelector('tcc-suite-menu').shadowRoot.querySelector('button').click());
  const sheet = await mpage.evaluate(() => { const p = document.querySelector('tcc-suite-layer').shadowRoot.querySelector('.panel'); const r = p.getBoundingClientRect(); return { cls: p.className, l: r.left, r: innerWidth - r.right, b: innerHeight - r.bottom, w: r.width, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  check('mobile: panel is a bottom sheet within the viewport, no horizontal overflow', /sheet/.test(sheet.cls) && sheet.l >= 0 && sheet.r >= 0 && sheet.sw <= sheet.iw, JSON.stringify(sheet));
  await mpage.close();

  // floating fallback
  const fpage = await context.newPage();
  await fpage.goto(`${LOCAL}/app?menu=0`);
  await fpage.waitForFunction(() => document.querySelector('tcc-suite-menu[floating]'), null, { timeout: 8000 }).catch(() => {});
  const fl = await fpage.evaluate(() => { const m = document.querySelector('tcc-suite-menu[floating]'); if (!m) return null; const r = m.getBoundingClientRect(); return { pos: getComputedStyle(m).position, x: r.left, y: innerHeight - r.bottom }; });
  check('floating fallback button appears when no <tcc-suite-menu> in page', fl && fl.pos === 'fixed', JSON.stringify(fl));
  await fpage.close();

  // ---- 2. Locker from a partitioned origin (localhost) → popup handoff ----
  console.log('\n[locker] localhost (partitioned) → popup handoff');
  check('mode is popup on localhost', (await page.evaluate(() => TCC.locker.mode)) === 'popup');
  async function act(p, sel) { await p.click(sel); return p.evaluate(() => window.__p); }
  const saved = await act(page, '#save');
  check('save() resolves to an id', saved.ok && typeof saved.v === 'string', JSON.stringify(saved));
  await page.evaluate(id => { window.__id = id; }, saved.v);
  const listed = await act(page, '#list');
  check('list() includes the saved file (filtered by type)', listed.ok && listed.v.some(e => e.id === saved.v && e.app === 'split' && e.size === 300000), listed.ok ? `${listed.v.length} entries` : listed.msg);
  const got = await act(page, '#get');
  const expected = await page.evaluate(() => window.__expected);
  check('get() returns byte-identical blob (sha256)', got.ok && got.v.sha === expected, got.ok ? got.v.sha.slice(0, 16) : got.msg);
  check('get() keeps meta + app', got.ok && got.v.meta.test === 'k' && got.v.app === 'split');

  // sendTo by id → partitioned receiver (sattarimusic.com/studio/split), served via opener
  const [recv] = await Promise.all([context.waitForEvent('page', p => p.url().includes('sattarimusic.com/studio/split')), act(page, '#send')]);
  const r1 = await recv.evaluate(() => Promise.race([window.__got, new Promise(r => setTimeout(() => r(null), 15000))]));
  check('sendTo(id) → onOpen in target gets byte-identical file', r1 && r1.sha === expected, r1 ? r1.name : 'nothing delivered');
  check('tcc-open param removed from target URL after delivery', r1 && !/tcc-open/.test(r1.search));
  await recv.close();
  const [recv2] = await Promise.all([context.waitForEvent('page', p => p.url().includes('sattarimusic.com/studio/split')), act(page, '#senddirect')]);
  const r2 = await recv2.evaluate(() => Promise.race([window.__got, new Promise(r => setTimeout(() => r(null), 15000))]));
  check('sendTo(app, {blob}) direct handoff → onOpen gets it', r2 && r2.sha === expected && r2.name === 'direct.wav', r2 ? r2.type : 'nothing');
  await recv2.close();

  // ---- 3. bridge iframe from localhost (forced) — protocol + frame-ancestors/XFO
  console.log('\n[locker] forced bridge iframe on localhost (CSP frame-ancestors vs X-Frame-Options)');
  const bpage = await context.newPage();
  await bpage.goto(`${LOCAL}/app?locker=bridge`);
  const bstatus = await bpage.evaluate(() => window.TCC ? TCC.ready.then(t => t.status) : new Promise(r => addEventListener('tcc:ready', e => r(e.detail))));
  check('bridge iframe loads cross-origin and connects', bstatus.available === true && bstatus.mode === 'bridge', JSON.stringify(bstatus));
  const bs = await act(bpage, '#save');
  await bpage.evaluate(id => { window.__id = id; }, bs.v);
  const bg = await act(bpage, '#get');
  const bexp = await bpage.evaluate(() => window.__expected);
  check('bridge save/get byte-identical', bs.ok && bg.ok && bg.v.sha === bexp);
  await bpage.close();

  // ---- 4. foreign origin is rejected ---------------------------------------
  console.log('\n[allowlist] foreign origin https://evilthecreatingco.com');
  const epage = await context.newPage();
  await epage.goto('https://evilthecreatingco.com/app?locker=bridge');
  const es = await epage.evaluate(() => window.TCC ? TCC.ready.then(t => t.status) : new Promise(r => addEventListener('tcc:ready', e => r(e.detail))));
  check('bridge refuses to connect (frame-ancestors blocks iframe)', es.available === false, JSON.stringify(es));
  const esave = await act(epage, '#save');
  check('save() from foreign origin rejected', !esave.ok, esave.code);
  await epage.goto('https://evilthecreatingco.com/app?locker=popup');
  await epage.waitForFunction(() => window.TCC);
  const psave = await act(epage, '#save');
  check('popup handoff answers foreign origin with forbidden', !psave.ok && psave.code === 'forbidden', psave.code);
  // raw probe: message the bridge directly from a foreign window
  const probe = await epage.evaluate(base => new Promise(res => {
    const w = window.open(base + '/locker/bridge.html', 'probe');
    // bridge.html opened top-level has no parent → stays silent; also try the handoff page
    const h = window.open(base + '/locker/?handoff', 'probe2');
    const t = setTimeout(() => res({ reply: null }), 8000);
    addEventListener('message', ev => {
      if (ev.data && ev.data.kind === 'ready') h.postMessage({ tcc: 1, kind: 'req', id: 'p1', op: 'list', args: {} }, base);
      if (ev.data && ev.data.kind === 'reply') { clearTimeout(t); res({ reply: ev.data }); try { w.close(); h.close(); } catch (e) {} }
    });
  }), BASE);
  check('raw list request from foreign origin returns no data', probe.reply && probe.reply.ok === false && probe.reply.error.code === 'forbidden' && !probe.reply.result, JSON.stringify(probe.reply && probe.reply.error));
  await epage.close();

  // ---- 5. same-site bridge (scenepilot.thecreatingco.com) shares the Locker page's storage
  console.log('\n[same-site] scenepilot.thecreatingco.com → thecreatingco.com/locker/');
  const spage = await context.newPage();
  await spage.goto('https://scenepilot.thecreatingco.com/__tcc_k_test');
  const ss = await spage.evaluate(() => window.TCC ? TCC.ready.then(t => t.status) : new Promise(r => addEventListener('tcc:ready', e => r(e.detail))));
  check('mode bridge on *.thecreatingco.com, available', ss.mode === 'bridge' && ss.available === true, JSON.stringify(ss));
  const s1 = await act(spage, '#save');
  check('save from scenepilot origin', s1.ok, s1.msg || '');
  await spage.evaluate(id => { window.__id = id; window.__target = 'luma'; }, s1.v);
  // sendTo same-site by id: receiver fetches from bridge itself
  const [lrecv] = await Promise.all([context.waitForEvent('page', p => p.url().includes('luma.thecreatingco.com')), act(spage, '#send')]);
  const lr = await lrecv.evaluate(() => Promise.race([window.__got, new Promise(r => setTimeout(() => r(null), 15000))]));
  const sexp = await spage.evaluate(() => window.__expected);
  check('sendTo(luma, id) same-site → onOpen byte-identical', lr && lr.sha === sexp, lr ? lr.name : 'nothing');
  await lrecv.close();

  const lpage = await context.newPage();
  await lpage.goto(`${PROD}/locker/`);
  await lpage.waitForSelector('.card', { timeout: 10000 }).catch(() => {});
  const cards = await lpage.evaluate(() => [...document.querySelectorAll('.card')].map(c => ({ name: c.querySelector('.fname').textContent, badge: c.querySelector('.badge').textContent })));
  const mine = cards.find(c => c.badge === 'ScenePilot');
  check('Locker page shows the file saved from ScenePilot with app badge', !!mine, JSON.stringify(cards.slice(0, 3)));

  // Locker page UI: add an image, preview, send-to filter, rename, delete
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDEgARQOACVpAgQf0b2pAAAAAElFTkSuQmCC', 'base64');
  await lpage.setInputFiles('#add', { name: 'k-test-image.png', mimeType: 'image/png', buffer: png });
  await lpage.waitForFunction(() => [...document.querySelectorAll('.fname')].some(n => n.textContent === 'k-test-image.png'), null, { timeout: 10000 });
  const imgCard = lpage.locator('.card', { hasText: 'k-test-image.png' });
  await imgCard.locator('img').waitFor({ timeout: 10000 }).catch(() => {});
  check('image card shows a preview + Locker badge', await imgCard.locator('img').count() === 1 && (await imgCard.locator('.badge').textContent()) === 'Locker');
  await imgCard.getByRole('button', { name: /^Send/ }).click();
  const targets = await imgCard.locator('.send li').allTextContents();
  check('Send to menu is filtered by accepts (image → Luma yes, Bounce no)', targets.some(t => /^Luma/.test(t)) && !targets.some(t => /Bounce|Split/.test(t)), targets.join(', '));
  await lpage.keyboard.press('Escape');
  await imgCard.getByRole('button', { name: /^Rename/ }).click();
  await lpage.keyboard.press('ControlOrMeta+a');
  await lpage.keyboard.type('k-test-renamed.png');
  await lpage.keyboard.press('Enter');
  await lpage.waitForFunction(() => [...document.querySelectorAll('.fname')].some(n => n.textContent === 'k-test-renamed.png'), null, { timeout: 10000 }).then(() => check('rename works', true), () => check('rename works', false));
  const dl = await Promise.all([lpage.waitForEvent('download'), lpage.locator('.card', { hasText: 'k-test-renamed.png' }).getByRole('button', { name: /^Download/ }).click()]).then(([d]) => d.suggestedFilename()).catch(e => 'ERR ' + e.message);
  check('download works', dl === 'k-test-renamed.png', dl);
  lpage.on('dialog', d => d.accept());
  for (const name of ['k-test-renamed.png']) {
    await lpage.locator('.card', { hasText: name }).getByRole('button', { name: /^Delete/ }).click();
  }
  // clean up test files saved from the scenepilot origin too
  await lpage.evaluate(async () => { const all = await TCCLockerCore.list({}); for (const e of all) if (/^k-test-/.test(e.name)) await TCCLockerCore.remove({ id: e.id }); });
  await lpage.waitForTimeout(500);
  const left = await lpage.evaluate(async () => (await TCCLockerCore.list({})).filter(e => /^k-test-/.test(e.name)).length);
  check('delete works (test files cleaned up)', left === 0, `left=${left}`);

  // installable + offline: manifest, SW scoped to /locker/ only
  const man = await lpage.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  check('manifest has name/scope/start_url/maskable icon', man.name === 'Locker' && man.scope === '/locker/' && man.start_url === '/locker/' && man.icons.some(i => i.purpose === 'maskable'));
  if (!proxying) {
    const sw = await lpage.evaluate(async () => { await navigator.serviceWorker.ready; const r = await navigator.serviceWorker.getRegistration('/locker/'); const top = await navigator.serviceWorker.getRegistration('/'); return { scope: r && r.scope, top: top ? top.scope : null }; });
    check('Locker SW registered with scope /locker/ only', !!sw.scope && sw.scope.endsWith('/locker/') && sw.top === null, JSON.stringify(sw));
    await lpage.reload(); await lpage.waitForTimeout(800);
    await context.setOffline(true);
    await lpage.reload().catch(() => {});
    const offline = await lpage.evaluate(() => !!document.querySelector('#grid') && document.title).catch(() => null);
    check('Locker page loads offline after first visit', !!offline, String(offline));
    await context.setOffline(false);
    const home = await context.newPage();
    await home.goto(`${PROD}/`);
    const ctl = await home.evaluate(() => !!navigator.serviceWorker.controller);
    check('marketing home is NOT controlled by a service worker', ctl === false);
    await home.close();
  } else {
    console.log('  (offline + SW-scope-vs-home checks need the real origin; run again with SUITE_BASE=https://thecreatingco.com after publish)');
  }

  const realErrors = errors.filter(e => !/evilthecreatingco/.test(e));
  check('no uncaught page errors', realErrors.length === 0, realErrors.join(' | '));
  await browser.close();
  server.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
