import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'reports/tool-product-pages-20261006');
const require = createRequire('/Users/lillypad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');
const tools = JSON.parse(await fs.readFile(path.join(root, 'content/creative-tools.json'), 'utf8')).filter(t => t.id !== 'cast');
await fs.mkdir(path.join(out, 'captures'), { recursive: true });
await fs.mkdir(path.join(out, 'stage/assets/tool-products'), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const evidence = process.argv[2] ? JSON.parse(await fs.readFile(path.join(out, 'capture-evidence.json'), 'utf8')) : [];
const media = path.join(out, 'demo-media');
await fs.mkdir(media, { recursive: true });
const audio = path.join(root, 'reports/site-overhaul-20261002/stage/assets/stemdeck-studio/full-mix.wav');
const vocal = path.join(root, 'reports/site-overhaul-20261002/stage/assets/stemdeck-studio/vocals.wav');
const art = path.join(root, 'reports/site-overhaul-20261002/stage/assets/luma-workshops/campaign-example.jpg');
const photo = path.join(root, 'luma-workshops/public/film-mountain.jpg');
const reference = path.join(root, 'luma-workshops/public/film-sun.jpg');
const video = path.join(root, 'scenepilot-workshops/site/assets/scenepilot-loop.mp4');
const demoVideos = [path.join(media, 'mountain-demo.mp4'), path.join(media, 'sun-demo.mp4')];
for (const [i, image] of [photo, reference].entries()) {
  if (!await fs.stat(demoVideos[i]).catch(() => null)) execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loop', '1', '-i', image, '-t', '4', '-vf', 'scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-r', '12', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '12', '-movflags', '+faststart', demoVideos[i]], { stdio: 'ignore' });
}
const shortAudio = path.join(media, 'demo-groove.wav');
if (!await fs.stat(shortAudio).catch(() => null)) execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', audio, '-t', '8', '-ar', '44100', shortAudio], { stdio: 'ignore' });
const srt = path.join(media, 'example.srt');
await fs.writeFile(srt, '1\n00:00:00,000 --> 00:00:01,300\nMake something of your own.\n\n2\n00:00:01,300 --> 00:00:02,700\nA new look. A new rhythm.\n\n3\n00:00:02,700 --> 00:00:04,000\nKeep the idea moving.\n');

async function populate(page, tool) {
  if (tool.id === 'board') {
    await page.locator('textarea').fill('EXT. MOUNTAIN - DAWN\n\nA figure reaches the ridge. The sun clears the peak.\n\nCLOSE ON: a hand holding a small silver pendant.\n\nWIDE: the figure looks across the valley.');
    await page.getByRole('button', { name: 'Build shot list', exact: true }).click();
    await page.waitForTimeout(700);
  } else if (tool.id === 'grade') {
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(reference);
    await page.locator('input[type=file][accept="video/*,image/*"]').setInputFiles(photo);
    await page.getByRole('button', { name: 'Graded still (PNG)', exact: true }).waitFor({ state: 'visible' });
    await page.waitForTimeout(1200);
  } else if (tool.id === 'captions') {
    await page.locator('input[type=file]').nth(0).setInputFiles(video);
    await page.locator('input[type=file]').nth(1).setInputFiles(srt);
    await page.waitForTimeout(1200);
  } else if (tool.id === 'autocut') {
    await page.getByLabel('Choose song and clips', { exact: true }).setInputFiles([shortAudio, ...demoVideos]);
    await page.waitForFunction(() => document.body.innerText.includes('2 ANALYSED'), { timeout: 45000 });
    const generate = page.getByRole('button', { name: /Generate|Build cut|Make cut/i }).first();
    if (await generate.count() && await generate.isEnabled()) { await generate.click(); await page.waitForTimeout(5000); }
  } else if (tool.id === 'keybpm') {
    await page.locator('input[type=file]').setInputFiles([shortAudio, path.join(root, 'reports/site-overhaul-20261002/stage/assets/stemdeck-studio/bass.wav')]);
    await page.waitForTimeout(8000);
  } else if (tool.id === 'vox') {
    await page.locator('input[type=file]').setInputFiles(vocal);
    await page.waitForTimeout(5000);
  } else if (tool.id === 'split') {
    await page.getByRole('button', { name: 'Try the 8-second demo', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => /Download.*WAV|Download all/.test(document.body.innerText), null, { timeout: 120000 });
  } else if (tool.id === 'canvas') {
    await page.locator('input[type=file]').nth(0).setInputFiles(shortAudio);
    await page.locator('input[type=file]').nth(1).setInputFiles(path.join(root, 'dist/assets/after-hours/outputs/after-hours-poster.png'));
    await page.getByLabel('Title', { exact: true }).fill('AFTER HOURS');
    await page.getByLabel('Artist', { exact: true }).fill('Example project');
    await page.waitForTimeout(800);
  } else if (tool.id === 'pocket') {
    await page.getByRole('button', { name: 'Starter', exact: true }).click();
  } else if (tool.id === 'press') {
    await page.getByLabel('Artist or band name', { exact: true }).fill('NIGHT CURRENT');
    await page.getByLabel('Tagline', { exact: true }).fill('Electronic music for the hours between.');
    await page.getByLabel('Location', { exact: true }).fill('Fictional artist / example project');
    await page.locator('main textarea').first().fill('Night Current is a fictional artist used to demonstrate Press.\n\nA compact identity, one release and a place to tell the story.');
    await page.getByLabel('Artist photo', { exact: true }).setInputFiles(photo);
    await page.getByLabel('Label 1', { exact: true }).fill('Explore the tools');
    await page.getByLabel('https://… 1', { exact: true }).fill('https://thecreatingco.com/tools/');
    await page.waitForTimeout(500);
  } else if (tool.id === 'mockups') {
    const file = page.locator('[role=dialog] input[type=file]').first();
    await file.setInputFiles(art);
    await page.getByRole('button', { name: 'Download T-shirt', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Download T-shirt') && !b.disabled), { timeout: 30000 });
    await page.waitForTimeout(5000);
    console.log(JSON.stringify({ mockupImages: await page.locator('[role=dialog] img').evaluateAll(nodes => nodes.map(n => ({ src: n.src.slice(0, 140), complete: n.complete, width: n.naturalWidth, height: n.naturalHeight }))), mockupCanvases: await page.locator('[role=dialog] canvas').evaluateAll(nodes => nodes.map(n => ({ width: n.width, height: n.height }))) }));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download T-shirt', exact: true }).click();
    const download = await downloadPromise;
    const exportFile = path.join(media, 'actual-mockup-export.png');
    await download.saveAs(exportFile);
    console.log(JSON.stringify({ mockupExport: exportFile, statistics: (await sharp(exportFile).stats()).channels.map(c => ({ min: c.min, max: c.max, stdev: c.stdev })) }));
  } else if (tool.id === 'glyph') {
    const canvases = page.locator('[role=dialog] canvas');
    const canvas = page.locator('[role=dialog] canvas.gl-editor');
    const box = await canvas.boundingBox();
    if (!box || box.width < 100) throw new Error('Glyph drawing surface not found');
    const stroke = async points => {
      await page.mouse.move(box.x + points[0][0] * box.width, box.y + points[0][1] * box.height);
      await page.mouse.down();
      for (const [x, y] of points.slice(1)) await page.mouse.move(box.x + x * box.width, box.y + y * box.height, { steps: 15 });
      await page.mouse.up();
    };
    await stroke([[0.25, 0.75], [0.5, 0.22], [0.75, 0.75]]);
    await stroke([[0.37, 0.52], [0.63, 0.52]]);
    await page.getByLabel('Preview text', { exact: true }).fill('AAA');
    await page.waitForTimeout(600);
  }
}
try {
  for (const tool of tools.filter(t => !process.argv[2] || process.argv.slice(2).includes(t.id))) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      const response = await page.goto(tool.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
      if (tool.product === 'luma') {
        const button = page.locator('button').filter({ hasText: tool.id === 'mockups' ? /^Mockups/ : /^Glyph font maker/ }).first();
        await button.evaluate(node => { const parent = node.closest('details'); if (parent) parent.open = true; });
        await button.click();
        await page.waitForTimeout(800);
        if (tool.id === 'mockups') await page.getByText('Preparing artwork...', { exact: true }).waitFor({ state: 'hidden', timeout: 45000 });
      }
      let populated = false;
      if (process.env.POPULATE === '1') { await populate(page, tool); populated = true; }
      await page.evaluate(() => window.scrollTo(0, 0));
      const body = await page.locator('body').innerText();
      const controls = await page.locator('input,textarea,select,button').evaluateAll(nodes => nodes.map(n => ({ tag: n.tagName, type: n.getAttribute('type'), label: n.getAttribute('aria-label'), text: n.textContent?.slice(0, 80), placeholder: n.getAttribute('placeholder'), accept: n.getAttribute('accept') })));
      await fs.writeFile(path.join(out, 'captures', `${tool.id}.json`), JSON.stringify({ body, controls }, null, 2));
      const png = path.join(out, 'captures', `${tool.id}.png`);
      await page.screenshot({ path: png });
      await sharp(png).resize({ width: 1440 }).webp({ quality: 88 }).toFile(path.join(out, 'stage/assets/tool-products', `${tool.id}.webp`));
      const previous = evidence.findIndex(item => item.id === tool.id);
      if (previous !== -1) evidence.splice(previous, 1);
      evidence.push({ id: tool.id, url: tool.url, status: response.status(), errors, capturedAt: new Date().toISOString(), populated, exportQualified: false });
      console.log(JSON.stringify({ id: tool.id, body: body.slice(0, 11000) }));
    } catch (error) {
      evidence.push({ id: tool.id, url: tool.url, error: error.message });
      console.log(JSON.stringify(evidence.at(-1)));
    } finally { await page.close(); }
  }
  await fs.writeFile(path.join(out, 'capture-evidence.json'), JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
