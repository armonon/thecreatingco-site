import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'reports/wave2-reconciliation-20261006');
const draft = JSON.parse(await fs.readFile(path.join(out, 'plan.draft.json'), 'utf8'));
const origin = process.argv[2] || draft.deploy_ssl_url;
const require = createRequire('/Users/lillypad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const routes = ['/', '/tools/', '/products/autocut/', '/products/glyph-studio/', '/products/form/', '/products/luma/', '/products/stemdeck/', '/products/scenepilot/', '/products/bounce/', '/products/reclaim/', '/products/librarian/', '/community/network', '/about/', '/kickstarter/', '/learn/'];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 1000 : 844 } });
    for (const route of routes) {
      const errors = [];
      const handler = error => errors.push(error.message);
      page.on('pageerror', handler);
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200, route);
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${width} ${route} overflows by ${overflow}px`);
      if (route === '/tools/') {
        assert.equal(await page.locator('[data-ct-tool]:visible').count(), 14);
        await page.locator('[data-ct-family]:not([data-ct-tool])').selectOption('glyph-studio');
        assert.equal(await page.locator('[data-ct-tool]:visible').count(), 1);
        assert.equal(await page.locator('[data-ct-tool]:visible .ct-open').getAttribute('href'), 'https://glyph-studio-610.netlify.app/');
        await page.locator('[data-ct-family]:not([data-ct-tool])').selectOption('form');
        assert.ok((await page.locator('[data-ct-tool]:visible').innerText()).includes('Preview'));
        await page.locator('[data-ct-family]:not([data-ct-tool])').selectOption('all');
        await page.locator('[data-ct-search]').fill('autocut');
        assert.equal(await page.locator('[data-ct-tool]:visible').count(), 1);
        await page.locator('[data-ct-search]').fill('');
      }
      if (route === '/') {
        await page.getByRole('button', { name: 'Quick launch', exact: true }).click();
        const search = page.locator('#mm-launch-search');
        for (const name of ['autocut', 'captions', 'board', 'grade', 'mockup', 'glyph', 'cast', 'split', 'key bpm', 'vox', 'canvas', 'pocket', 'press']) {
          await search.fill(name);
          assert.ok(await page.locator('[data-mm-search]:visible').count() > 0, `Search cannot find ${name}`);
        }
        await page.keyboard.press('Escape');
      }
      if (['/', '/tools/', '/products/autocut/', '/products/glyph-studio/'].includes(route)) {
        await page.screenshot({ path: path.join(out, `browser-${width}-${route === '/' ? 'home' : route.split('/').filter(Boolean).join('-')}.png`) });
      }
      assert.deepEqual(errors, [], `${width} ${route} JavaScript errors`);
      results.push({ route, width, status: response.status(), overflow, errors });
      page.off('pageerror', handler);
    }
    await page.close();
  }
  await fs.writeFile(path.join(out, 'browser-verification.json'), JSON.stringify({ origin, passed: true, checks: results.length, physicalIPhoneQualified: false, exportWorkflowsQualified: false, results }, null, 2) + '\n');
  console.log(JSON.stringify({ origin, passed: true, checks: results.length }));
} finally { await browser.close(); }
