#!/usr/bin/env node
// Browser check of the hub pages after the wave-4 one-suite pass.
//   HUB_BASE=https://<deploy>--momentium-creative.netlify.app node maintenance/tests/hub-suite-pass.mjs
// Every sitemap page at 1280 and 390: 200, console errors (compared with the
// live site when COMPARE_BASE is set), horizontal overflow, suite menu upgraded
// and opens, quick-launch dialog grouped Make/Film/Music/Everyday/Locker/Community.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/agentsattari/code/wave2/sattari-all/node_modules/playwright');
const CHROME = process.env.CHROME || '/Users/agentsattari/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const BASE = (process.env.HUB_BASE || 'https://thecreatingco.com').replace(/\/$/, '');
const COMPARE = (process.env.COMPARE_BASE || '').replace(/\/$/, '');

const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
const paths = [...sitemap.matchAll(/<loc>https:\/\/thecreatingco\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/')
  .filter(p => !p.startsWith('/community'));

const browser = await chromium.launch({ executablePath: CHROME });
let fails = 0;
async function visit(base, path, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const resp = await page.goto(base + path, { waitUntil: 'load', timeout: 45000 }).catch(e => null);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const m = document.querySelector('header tcc-suite-menu');
    const d = document.querySelector('.mm-launch-dialog');
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      menu: !!(m && m.shadowRoot && m.shadowRoot.querySelector('button')),
      menuVisible: !!(m && m.getBoundingClientRect().width > 0 && getComputedStyle(m).visibility !== 'hidden'),
      floating: !!document.querySelector('tcc-suite-menu[floating]'),
      groups: d ? [...d.querySelectorAll('[data-mm-launch-group]')].map(g => g.getAttribute('aria-label')) : null,
      tcc: !!window.TCC
    };
  }).catch(e => ({ err: e.message }));
  let opened = null;
  if (info.menu && info.menuVisible) {
    await page.evaluate(() => document.querySelector('header tcc-suite-menu').shadowRoot.querySelector('button').click());
    opened = await page.evaluate(() => { const p = document.querySelector('tcc-suite-layer')?.shadowRoot.querySelector('.panel'); return p && !p.hidden ? p.querySelectorAll('a').length : 0; });
    await page.keyboard.press('Escape');
  }
  await ctx.close();
  return { status: resp ? resp.status() : 0, errors, ...info, opened };
}

for (const path of paths) {
  for (const width of [1280, 390]) {
    const r = await visit(BASE, path, width);
    let base = [];
    if (COMPARE && r.errors.length) base = (await visit(COMPARE, path, width)).errors;
    const newErr = r.errors.filter(e => !base.includes(e));
    const problems = [];
    if (r.status !== 200) problems.push('status ' + r.status);
    if (r.overflow > 0) problems.push('overflow ' + r.overflow);
    if (newErr.length) problems.push('errors: ' + newErr.join(' | ').slice(0, 300));
    if (r.groups && r.groups.join(',') !== 'Make,Film,Music,Everyday,Locker,Community') problems.push('dialog groups ' + r.groups);
    const hasHeader = r.menu || r.groups;
    if (hasHeader && !r.menu) problems.push('suite menu missing');
    if (r.menu && r.menuVisible && !(r.opened >= 25)) problems.push('menu did not open');
    if (r.floating) problems.push('floating button on hub page');
    if (problems.length) fails++;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${String(width).padEnd(4)} ${path}${problems.length ? '  ' + problems.join('; ') : ''}${r.errors.length && !newErr.length ? '  (pre-existing errors: ' + r.errors.length + ')' : ''}${r.menu && !r.menuVisible ? '  (menu hidden at this width)' : ''}`);
  }
}
await browser.close();
console.log(`\n${paths.length} pages x 2 widths, ${fails} with problems`);
process.exit(fails ? 1 : 0);
