import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'reports/tool-product-pages-20261006');
const require = createRequire('/Users/lillypad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const products = JSON.parse(await fs.readFile(path.join(root, 'content/tool-product-pages.json'), 'utf8'));
const draft = JSON.parse(await fs.readFile(path.join(out, 'plan.draft.json'), 'utf8'));
const origin = process.argv[2] || draft.deploy_ssl_url;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const failures = [];
const publicRun = origin === 'https://thecreatingco.com';
try {
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce' });
    for (const product of products) {
      const route = `/products/${product.slug}/`;
      const errors = [];
      const failedAssets = [];
      const onError = error => errors.push(error.message);
      const onResponse = response => { if (response.url().startsWith(origin) && response.status() >= 400) failedAssets.push({ url: response.url(), status: response.status() }); };
      page.on('pageerror', onError);
      page.on('response', onResponse);
      try {
        const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response.status(), 200, route);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('h1').innerText(), product.name);
        assert.equal(await page.locator('.tp-workspace img').evaluate(img => img.complete && img.naturalWidth > 0), true, 'Workspace image is missing');
        assert.equal(await page.locator('iframe').count(), 0);
        await page.getByRole('button', { name: `Enlarge ${product.name} preview`, exact: true }).click();
        assert.equal(await page.locator('[data-tp-preview-dialog]').evaluate(d => d.open), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-tp-preview-dialog]').evaluate(d => d.open), false);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `${width} ${route}: ${overflow}px overflow`);
        const clipped = await page.locator('main a, main button, main select').evaluateAll(nodes => nodes.filter(n => {
          const b = n.getBoundingClientRect();
          return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1 || n.scrollWidth > n.clientWidth + 2);
        }).map(n => ({ tag: n.tagName, label: n.getAttribute('aria-label') || n.textContent, width: n.clientWidth, scroll: n.scrollWidth })));
        assert.deepEqual(clipped, [], 'Clipped controls');
        const player = page.locator('[data-tp-player]');
        const height = (await player.boundingBox()).height;
        await page.getByRole('button', { name: 'Next project', exact: true }).click();
        assert.equal(await page.locator('[data-tp-count]').innerText(), '2 / 3');
        assert.equal(await page.locator('[data-tp-lesson]:visible').count(), 1);
        await page.getByRole('button', { name: 'Previous project', exact: true }).click();
        assert.equal(await page.locator('[data-tp-count]').innerText(), '1 / 3');
        await page.locator('[data-tp-picker]').selectOption('2');
        assert.equal(await page.locator('[data-tp-count]').innerText(), '3 / 3');
        assert.ok(Math.abs((await player.boundingBox()).height - height) < 2, 'Guide cycling changed the layout');
        await page.locator('[data-tp-picker]').focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Next project', exact: true }).focus();
        const prior = await page.locator('[data-tp-count]').innerText();
        await page.keyboard.press('Enter');
        assert.notEqual(await page.locator('[data-tp-count]').innerText(), prior, 'Keyboard cycling failed');
        await page.locator('[data-tp-picker]').selectOption('0');
        await page.locator('#limits details').nth(1).locator('summary').click();
        assert.equal(await page.locator('#limits details').nth(1).evaluate(n => n.open), true);
        await page.getByRole('button', { name: 'Quick launch', exact: true }).click();
        await page.locator('#mm-launch-search').fill(product.name);
        assert.ok(await page.locator('[data-mm-search]:visible').count() > 0);
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.scrollTo(0, 0));
        if (width === 1440 || width === 390) await page.screenshot({ path: path.join(out, `${publicRun ? 'public' : 'draft'}-${width}-${product.slug}.png`) });
        if (width === 390 && ['autocut', 'mockup', 'press'].includes(product.slug)) await page.screenshot({ path: path.join(out, `${publicRun ? 'public' : 'draft'}-${width}-${product.slug}-full.png`), fullPage: true });
        assert.deepEqual(errors, [], 'Page JavaScript errors');
        assert.deepEqual(failedAssets, [], 'Failed local assets');
        results.push({ route, width, passed: true, overflow, guideCycling: true, keyboard: true, imageLoaded: true, errors, failedAssets });
      } catch (error) {
        failures.push({ route, width, error: error.message });
        console.log(JSON.stringify(failures.at(-1)));
      } finally {
        page.off('pageerror', onError);
        page.off('response', onResponse);
      }
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const route of ['/', '/tools/', '/community/network', '/about/', '/learn/', '/products/luma/', '/products/stemdeck/']) {
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200, `Preserved route ${route}`);
    if (route === '/tools/') {
      assert.equal(await page.locator('.ct-product-details').count(), 12);
      assert.equal(await page.locator('[data-ct-tool]').count(), 14);
    }
    results.push({ route, width: 390, passed: true, preservedRoute: true });
  }
  await page.close();
  await fs.writeFile(path.join(out, `${publicRun ? 'public' : 'draft'}-browser-verification.json`), JSON.stringify({ origin, passed: failures.length === 0, checks: results.length, failures, results, physicalIPhoneQualified: false, exportWorkflowsQualified: false }, null, 2));
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ origin, passed: true, checks: results.length, physicalIPhoneQualified: false }));
} finally { await browser.close(); }
