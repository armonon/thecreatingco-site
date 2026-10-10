/** Real-browser regression. Start desktop:web:dev first; requires Playwright.
 * FORM_BROWSER_URL=http://127.0.0.1:1420 FORM_PLAYWRIGHT_MODULE=playwright node scripts/verify-project-menu.mjs
 * Does not mock OCCT, native APIs, downloads or layout; uses synthetic geometry.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.FORM_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.FORM_BROWSER_REPORT_DIR || await mkdtemp(join(tmpdir(), 'form-menu-'));
const browser = await chromium.launch({ channel: process.env.FORM_BROWSER_CHANNEL || undefined, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const touch = process.env.FORM_BROWSER_TOUCH === '1';
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, hasTouch: touch });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(process.env.FORM_BROWSER_URL || 'http://127.0.0.1:1420');
  await page.getByRole('button', { name: /Blank precision part/ }).click();
  await page.getByLabel('Import SVG file').setInputFiles({ name: 'menu-fixture.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect x="5" y="5" width="20" height="20"/></svg>') });
  const tools = page.getByRole('region', { name: 'Sketch and vector tools' });
  await tools.getByLabel('Quick extrusion depth').fill('12 mm');
  await tools.getByLabel('Quick extrusion depth').press('Enter');
  await tools.getByRole('button', { name: 'Make 3D', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.cad-status-exact')?.textContent === '1 exact body');
  const project = () => page.evaluate(() => window.formCAD.getProject());
  // JSON project format omits undefined optional fields and canonicalizes -0.
  const expected = JSON.parse(JSON.stringify(await project()));
  const summary = page.locator('.cad-project-menu > summary');
  const grab = async action => { const event = page.waitForEvent('download'); await action(); return await event; };
  for (const width of [1440, 1280, 1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const box = await summary.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 1000, `Project trigger outside ${width}px viewport`);
    assert.ok(await page.locator('.cad-brand .form-brand-logo').isVisible(), 'Form identity retained');
    const saved = await grab(() => page.getByRole('button', { name: 'Save', exact: true }).click());
    const path = join(output, `fixture-${width}.form`); await saved.saveAs(path);
    await (touch ? summary.tap() : summary.click());
    const chooserEvent = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Open project…', exact: true }).click();
    await (await chooserEvent).setFiles(path);
    await page.getByRole('status', { name: 'Workspace status' }).filter({ hasText: 'Project opened' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.cad-status-exact')?.textContent === '1 exact body');
    const reopened = await project();
    for (const field of ['entities', 'features', 'appearance', 'geometricConstraints', 'modelState', 'layers']) assert.deepEqual(reopened[field], expected[field], `${field} at${width}`);
    // Native details keyboard activation; Tab through the actual menu, not forced clicks.
    await summary.focus(); await page.keyboard.press('Enter');
    let found = false;
    for (let i = 0; i < 35; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.textContent === 'Export STEP')) { found = true; break; } }
    assert.ok(found, `STEP reachable through keyboard menu at${width}`);
    const step = await grab(() => page.keyboard.press('Enter'));
    const stepBytes = await readFile(await step.path()); assert.match(stepBytes.toString(), /^ISO-10303-21/);
    await (touch ? summary.tap() : summary.click()); await page.getByRole('menuitem', { name: 'Export for Blender…', exact: true }).click();
    const glb = await grab(() => page.getByRole('button', { name: 'Download .glb ↓', exact: true }).click());
    const glbBytes = await readFile(await glb.path()); assert.equal(glbBytes.readUInt32LE(0), 0x46546c67); assert.equal(glbBytes.readUInt32LE(8), glbBytes.length);
    await page.getByRole('button', { name: 'Close Export for Blender', exact: true }).click();
    await (touch ? summary.tap() : summary.click()); await page.keyboard.press('Escape'); assert.equal(await page.locator('.cad-project-menu').getAttribute('open'), null); assert.ok(await summary.evaluate(e => e === document.activeElement));
    await page.screenshot({ path: join(output, `viewport-${width}.png`) });
    results.push({ width, menu: 'PASS', mouse_save_open: 'PASS', keyboard_step: 'PASS', glb: 'PASS', step_bytes: stepBytes.length, glb_bytes: glbBytes.length });
  }
  assert.deepEqual(errors, []); await writeFile(join(output, 'browser-results.json'), JSON.stringify({ touch, results, errors }, null, 2)); console.log(JSON.stringify({ touch, results, errors, output }));
} finally { await browser.close(); }
