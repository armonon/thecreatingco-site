// Live end-to-end Locker check: save from a live app, Locker page → Send to → another live app.
// node maintenance/tests/locker-e2e-live.cjs   (writes screenshots to ~/code/wave4/k-shots/, removes its test files)
const { chromium } = require('/Users/agentsattari/code/wave2/sattari-all/node_modules/playwright');
const fs = require('fs'), crypto = require('crypto');
const CHROME = '/Users/agentsattari/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const shots = '/Users/agentsattari/code/wave4/k-shots/';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => {
    addEventListener('tcc:open', async e => {
      const buf = await e.detail.blob.arrayBuffer();
      const h = await crypto.subtle.digest('SHA-256', buf);
      window.__tccOpened = { name: e.detail.name, type: e.detail.type, size: e.detail.size, app: e.detail.app, sha: [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('') };
    });
  });
  const errs = {};
  ctx.on('page', p => p.on('pageerror', e => (errs[p.url()] = errs[p.url()] || []).push(e.message)));

  async function saveFrom(url, file, type) {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => window.TCC, null, { timeout: 30000 });
    const st = await p.evaluate(() => TCC.ready.then(t => t.status));
    const bytes = fs.readFileSync(file);
    const name = 'k-e2e-' + Date.now() + '-' + file.split('/').pop().replace('k-e2e-', '');
    const id = await p.evaluate(async ({ b64, name, type }) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return TCC.locker.save({ name, type, blob: new Blob([bin], { type }), meta: { test: 'k-e2e' } });
    }, { b64: bytes.toString('base64'), name, type });
    console.log(`saved from ${url} (app=${st.app}, mode=${st.mode}) → ${id} ${name}`);
    await p.close();
    return { id, name, sha: sha(bytes), size: bytes.length };
  }

  async function sendViaLocker(file, targetLabel, targetHost) {
    const lp = await ctx.newPage();
    await lp.goto('https://thecreatingco.com/locker/');
    await lp.waitForFunction(() => window.TCC, null, { timeout: 20000 });
    const card = lp.locator('.card', { hasText: file.name });
    await card.waitFor({ timeout: 15000 });
    const badge = await card.locator('.badge').textContent();
    await card.getByRole('button', { name: /^Send/ }).click();
    const options = await card.locator('.send li').allTextContents();
    const [tp] = await Promise.all([
      ctx.waitForEvent('page', p => p.url().includes(targetHost), { timeout: 30000 }),
      card.locator('.send li button', { hasText: new RegExp('^' + targetLabel) }).first().click()
    ]);
    await tp.waitForLoadState('load', { timeout: 90000 }).catch(() => {});
    const got = await tp.waitForFunction(() => window.__tccOpened, null, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => null);
    await tp.waitForTimeout(4000);
    // ScenePilot shows its new-project dialog first; the delivered file lands in the project after it.
    if (/scenepilot/.test(targetHost)) { await tp.getByRole('button', { name: /Start editing/ }).click().catch(() => {}); await tp.waitForTimeout(6000); }
    const url = tp.url();
    const visible = await tp.evaluate(n => document.body.innerText.includes(n) || document.body.innerHTML.includes(n) || [...document.querySelectorAll('*')].some(el => el.shadowRoot && el.shadowRoot.textContent.includes(n)), file.name).catch(() => false);
    const shot = shots + 'e2e-' + targetLabel.replace(/\W/g, '') + '.png';
    await tp.screenshot({ path: shot });
    console.log(JSON.stringify({ badge, sendToOptions: options, target: url, delivered: got && { name: got.name, type: got.type, size: got.size }, byteIdentical: !!got && got.sha === file.sha, nameVisibleInApp: visible, shot }, null, 1));
    await tp.close(); await lp.close();
    return !!got && got.sha === file.sha;
  }

  // same-site: Luma → ScenePilot (image)
  const img = await saveFrom('https://luma.thecreatingco.com/studio', __dirname + '/fixtures/k-e2e-art.jpg', 'image/jpeg');
  const ok1 = await sendViaLocker(img, 'ScenePilot', 'scenepilot.thecreatingco.com');
  // cross-site: ScenePilot (audio) → Split on sattarimusic.com
  const wav = await saveFrom('https://scenepilot.thecreatingco.com/app/', __dirname + '/fixtures/k-e2e-tone.wav', 'audio/wav');
  const ok2 = await sendViaLocker(wav, 'Split', 'sattarimusic.com');
  // cleanup
  const lp = await ctx.newPage(); await lp.goto('https://thecreatingco.com/locker/');
  await lp.waitForFunction(() => window.TCCLockerCore);
  const n = await lp.evaluate(async () => { let n = 0; for (const e of await TCCLockerCore.list({})) if (/^k-e2e-/.test(e.name)) { await TCCLockerCore.remove({ id: e.id }); n++; } return n; });
  console.log('cleaned', n, 'test files; page errors:', JSON.stringify(errs).slice(0, 800));
  console.log(ok1 && ok2 ? 'E2E PASS' : 'E2E FAIL');
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
