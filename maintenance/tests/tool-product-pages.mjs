import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'reports/tool-product-pages-20261006');
const products = JSON.parse(fs.readFileSync(path.join(root, 'content/tool-product-pages.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(out, 'plan.json'), 'utf8'));

test('All twelve pages have truthful destinations, metadata, one guide and real media', () => {
  assert.equal(products.length, 12);
  for (const p of products) {
    const page = new JSDOM(fs.readFileSync(plan.replace[`/products/${p.slug}/index.html`], 'utf8'));
    const d = page.window.document;
    assert.equal(d.querySelectorAll('h1').length, 1, p.slug);
    assert.equal(d.querySelector('h1').textContent, p.name);
    assert.equal(d.querySelector('link[rel=canonical]').href, `https://thecreatingco.com/products/${p.slug}/`);
    assert.equal(d.querySelectorAll('[data-tp-player]').length, 1);
    assert.equal(d.querySelectorAll('[data-tp-lesson]').length, 3);
    assert.equal(d.querySelectorAll('iframe').length, 0, 'No additional resident editors');
    assert.equal(d.querySelector('.tp-workspace img').getAttribute('src'), `/assets/tool-products/${p.asset}.webp`);
    assert.ok(d.querySelector('meta[property="og:image"]').content.endsWith(`${p.asset}-share.jpg`));
    assert.ok(d.querySelector('#limits').textContent.includes(p.limits));
    assert.ok(d.querySelector('#limits').textContent.includes('no public native downloads yet'));
    for (const id of ['top', 'what-it-does', 'how-it-works', 'limits', 'pr-next-title']) assert.ok(d.getElementById(id), `Legacy anchor ${id}`);
    for (const a of d.querySelectorAll('main a[href^="#"]')) assert.ok(d.querySelector(a.getAttribute('href')), a.href);
    page.window.close();
  }
});

test('Quick Launch accepts the product name with an ampersand and counts actual entries', () => {
  const page = new JSDOM(fs.readFileSync(plan.replace['/products/key-bpm/index.html'], 'utf8'), { runScripts: 'outside-only' });
  const d = page.window.document;
  const dialog = d.querySelector('.mm-launch-dialog');
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  page.window.eval(fs.readFileSync(plan.replace['/momentium.js'], 'utf8'));
  d.querySelector('[data-mm-launch]').click();
  const input = d.querySelector('#mm-launch-search');
  for (const query of ['Key & BPM', 'key bpm', '  KEY  &  BPM  ', 'Form Studio', 'AutoCut', 'Glyph Studio']) {
    input.value = query;
    input.dispatchEvent(new page.window.Event('input'));
    assert.ok([...d.querySelectorAll('[data-mm-search]')].some(item => !item.hidden), query);
  }
  input.value = '';
  input.dispatchEvent(new page.window.Event('input'));
  assert.ok(d.querySelector('.mm-launch-count').textContent.startsWith(`${d.querySelectorAll('[data-mm-search]').length} apps and tools`));
  page.window.close();
});

test('Cycling and direct selection retain one visible guide and do not create editors', () => {
  const script = fs.readFileSync(path.join(root, 'content/tool-products.js'), 'utf8');
  for (const p of products) {
    const page = new JSDOM(fs.readFileSync(plan.replace[`/products/${p.slug}/index.html`], 'utf8'), { runScripts: 'outside-only' });
    const d = page.window.document;
    page.window.eval(script);
    const count = d.querySelector('[data-tp-count]');
    const next = d.querySelector('[data-tp-next]');
    const previous = d.querySelector('[data-tp-previous]');
    assert.equal(d.querySelector('[data-tp-controls]').hidden, false);
    for (const expected of ['2 / 3', '3 / 3', '1 / 3']) { next.click(); assert.equal(count.textContent, expected); }
    previous.click();
    assert.equal(count.textContent, '3 / 3');
    const picker = d.querySelector('[data-tp-picker]');
    picker.value = '1';
    picker.dispatchEvent(new page.window.Event('change'));
    assert.equal(count.textContent, '2 / 3');
    assert.equal(d.querySelectorAll('[data-tp-lesson]:not([hidden])').length, 1);
    assert.equal(d.querySelectorAll('iframe').length, 0);
    page.window.close();
  }
});

test('Shared navigation, footer and Quick Launch are preserved exactly', () => {
  for (const p of products) {
    const before = new JSDOM(fs.readFileSync(path.join(out, 'base/products', p.slug, 'index.html'), 'utf8'));
    const after = new JSDOM(fs.readFileSync(plan.replace[`/products/${p.slug}/index.html`], 'utf8'));
    for (const selector of ['body>header', 'body>footer', '.mm-launch']) {
      assert.equal(after.window.document.querySelector(selector)?.outerHTML, before.window.document.querySelector(selector)?.outerHTML, `${p.slug} ${selector}`);
    }
    before.window.close();
    after.window.close();
  }
});

test('Release scope excludes app engines, homepage, server functions and routing', () => {
  assert.equal(Object.keys(plan.replace).length, 41);
  assert.equal(plan.functions, undefined);
  assert.equal(plan.remove, undefined);
  for (const route of Object.keys(plan.replace)) assert.match(route, /^(\/products\/(autocut|captions|board|grade|mockup|glyph|split|key-bpm|vox|canvas|pocket|press)\/index\.html|\/tool-products\.(css|js)|\/momentium\.js|\/assets\/tool-products\/[\w-]+\.(webp|jpg)|\/tools\/index\.html|\/sitemap\.xml)$/);
});
