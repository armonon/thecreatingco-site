import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'reports/wave2-reconciliation-20261006');
const load = async folder => new JSDOM(await fs.readFile(path.join(out, folder, 'index.html'), 'utf8'));

test('restoration retains the new homepage cards, all search entries and signup byte for byte', async () => {
  const before = await load('base');
  const after = await load('stage');
  for (const selector of ['[data-mm-product]', '[data-mm-search]', '#join-launch']) {
    assert.deepEqual([...after.window.document.querySelectorAll(selector)].map(n => n.outerHTML), [...before.window.document.querySelectorAll(selector)].map(n => n.outerHTML));
  }
  assert.equal(after.window.document.querySelectorAll('[data-mm-search]').length, 22);
  assert.equal(after.window.document.querySelectorAll('#focused-tools').length, 1);
  assert.ok(after.window.document.querySelector('a[href="/tools/"]'));
  before.window.close(); after.window.close();
});

test('directory distinguishes standalone Glyph Studio, embedded Glyph and Cast preview', async () => {
  const dom = new JSDOM(await fs.readFile(path.join(out, 'stage/tools/index.html'), 'utf8'), { url: 'https://thecreatingco.com/tools/?family=glyph-studio', runScripts: 'outside-only' });
  dom.window.eval(await fs.readFile(path.join(root, 'content/creative-tools.js'), 'utf8'));
  const document = dom.window.document;
  assert.equal(document.querySelectorAll('[data-ct-tool]').length, 14);
  assert.equal(document.querySelectorAll('[data-ct-tool]:not([hidden])').length, 1);
  assert.equal(document.querySelector('[data-ct-tool]:not([hidden]) .ct-open').href, 'https://glyph-studio-610.netlify.app/');
  assert.equal(document.querySelector('[data-ct-count]').textContent, '1 entry');
  assert.ok(document.querySelector('[data-ct-name="Cast Form Studio"]').textContent.includes('Preview'));
  assert.ok(document.querySelector('[data-ct-name="Glyph Luma Studio"]'));
  assert.equal(document.querySelectorAll('iframe').length, 0);
  dom.window.close();
});

test('release changes no editors, routing files, server functions or existing product pages', async () => {
  const plan = JSON.parse(await fs.readFile(path.join(out, 'plan.json'), 'utf8'));
  assert.equal(Object.keys(plan.replace).length, 20);
  assert.equal(plan.remove, undefined);
  assert.equal(plan.functions, undefined);
  assert.ok(Object.keys(plan.replace).every(route => !route.startsWith('/products/') && !route.startsWith('/learn/') && !route.includes('_redirects')));
  assert.ok(plan.replace['/assets/share/autocut.jpg']);
});
