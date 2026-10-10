import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Script } from "node:vm";
import test from "node:test";

const landing = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
const download = await readFile(new URL("../site/download.html", import.meta.url), "utf8");

test("the public site distinguishes Browser Lite from Desktop Pro", () => {
  assert.match(landing, /Try Browser Lite/);
  assert.match(landing, /Desktop Pro/);
  assert.match(landing, /Multi-track video \+ audio editing/);
  assert.match(landing, /Waveforms and volume automation/);
  assert.match(landing, /Three real first cuts/);
  assert.match(landing, /professional Master Sequence/i);
  assert.match(landing, /Local semantic subject isolation/);
  assert.match(landing, /True pixel alpha and luma mattes/);
  assert.match(landing, /resilient desktop engine/i);
  assert.match(landing, /BS\.1770 integrated LUFS/);
  assert.match(landing, /green\/magenta tint/);
  assert.match(landing, /https:\/\/scene-pilot\.netlify\.app/);
  assert.doesNotMatch(landing, /full studio in your browser/i);
});

test("the download page describes Pro without distributing an unqualified installer", () => {
  assert.match(download, /Publication pending/);
  assert.match(download, /Native downloads are withheld pending release qualification/);
  assert.match(download, /Open Browser Lite/);
  assert.doesNotMatch(download, /id="dl-btn"|href="[^"]*(?:\.dmg|releases\/latest)/i);
  assert.match(download, /multi-track timeline/i);
  assert.match(download, /semantic Roto Subject/i);
  assert.match(download, /pixel alpha\/luma mattes/i);
  assert.match(download, /hybrid render queue/i);
  assert.match(download, /offline LUFS\/LRA\/true-peak analysis/i);
  assert.match(download, /Try Browser Lite/);
});

test("marketing pages have valid local assets, links and fragment targets", async () => {
  for (const [name, html] of [["index.html", landing], ["download.html", download]]) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${name}`);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      if (/^(https?:|data:)/.test(url)) continue;
      const [path, fragment] = url.split("#");
      const clean = path.split("?")[0];
      const target = new URL(`../site/${clean || name}`, import.meta.url);
      await access(target);
      if (fragment) {
        const text = clean ? await readFile(target, "utf8") : html;
        assert.ok(text.includes(`id="${fragment}"`), `${name}: missing target ${url}`);
      }
    }
  }
});

test("workspace tour connects each keyboard tab to a real product screenshot", async () => {
  for (const mode of ["edit", "compose", "effects"]) {
    assert.match(landing, new RegExp(`id="tab-${mode}"[^>]+aria-controls="panel-${mode}"`));
    assert.match(landing, new RegExp(`id="panel-${mode}"[^>]+aria-labelledby="tab-${mode}"`));
  }
  for (const file of ["studio-edit", "studio-motion", "studio-effects"]) {
    const bytes = await readFile(new URL(`../site/assets/${file}-20260911.jpg`, import.meta.url));
    assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
    assert.ok(bytes.length > 10000, "capture should contain a real workspace");
  }
  assert.match(landing, /Public downloads may be an earlier version/);
  assert.match(landing, /Actual ScenePilot renders/);
  assert.match(landing, /Three pre-rendered strengths/);
  assert.match(landing, /Silent, illustrative timing demo/);
  assert.doesNotMatch(landing, /class="(?:fake-slider|subject-silhouette|timeline-ui)"/);
});

test("marketing interactions parse without reopening the native release gate", async () => {
  const js = await readFile(new URL("../site/studio-site.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => new Script(js));
  assert.match(js, /ArrowRight/);
  assert.match(js, /showModal/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /visibilitychange/);
  assert.doesNotMatch(js, /api\.github\.com\/repos\/armonon\/scenepilot-releases/);
  assert.doesNotMatch(download, /Signed DMG|Apple-notarized/i);
  assert.match(download, /It must not be distributed/);
});

test("the gated download page never fetches or rewrites installer destinations", async () => {
  let fetches = 0;
  const status = { textContent: "Native downloads are withheld pending release qualification. Browser testing is available." };
  const nodes = { "release-status": status };
  const js = await readFile(new URL("../site/studio-site.js", import.meta.url), "utf8");
  new Script(js).runInNewContext({
    document: { querySelector: () => null, querySelectorAll: () => [], getElementById: id => nodes[id] ?? null, addEventListener() {} },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    cancelAnimationFrame() {},
    setTimeout, clearTimeout, AbortController, URL,
    fetch: async () => { fetches++; throw new Error("Installer lookup is not permitted while gated"); }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetches, 0);
  assert.match(status.textContent, /withheld pending release qualification/);
});

test("effects gallery assets have renderer provenance and three distinct real strengths", async () => {
  const { createHash } = await import("node:crypto");
  const context = {};
  new Script(await readFile(new URL("../site/assets/effects-gallery/gallery-data.js", import.meta.url), "utf8")).runInNewContext(context);
  const gallery = context.ScenePilotGallery;
  const provenance = JSON.parse(await readFile(new URL("../site/assets/effects-gallery/provenance.json", import.meta.url), "utf8"));
  assert.equal(gallery.recipes.length, 9);
  assert.match(provenance.renderer, /effectPreviewPlan \+ paintFramePlan/);
  for (const recipe of gallery.recipes) {
    const hashes = [];
    assert.ok(landing.includes(`data-effect="${recipe.id}"`));
    for (const level of [25, 60, 100]) {
      const url = recipe.variants[level];
      const bytes = await readFile(new URL(`../site/${url}`, import.meta.url));
      assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
      const hash = createHash("sha256").update(bytes).digest("hex");
      assert.equal(hash, provenance.hashes[url.split("/").at(-1)]);
      assert.notEqual(hash, provenance.hashes["original.jpg"]);
      hashes.push(hash);
    }
    assert.equal(new Set(hashes).size, 3);
  }
});

test("gallery covers every registered clip effect and built-in preset, with real paired samples", async () => {
  const { marketingEffectCatalog } = await import("../scripts/marketing-effect-catalog.ts");
  const { CLIP_EFFECT_DEFINITIONS } = await import("../lib/clip-effects.ts");
  const { createHash } = await import("node:crypto");
  const context = {};
  new Script(await readFile(new URL("../site/assets/effects-gallery/gallery-data.js", import.meta.url), "utf8")).runInNewContext(context);
  const entries = context.ScenePilotGallery.entries;
  assert.deepEqual(Array.from(entries, entry => entry.id), marketingEffectCatalog().map(entry => entry.id));
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  for (const type of Object.keys(CLIP_EFFECT_DEFINITIONS)) assert.ok(entries.some(entry => entry.id === `fx-${type}`));
  const provenance = JSON.parse(await readFile(new URL("../site/assets/effects-gallery/provenance.json", import.meta.url), "utf8"));
  for (const [file, hash] of Object.entries(provenance.rendererSources)) {
    assert.equal(createHash("sha256").update(await readFile(new URL(`../${file}`, import.meta.url))).digest("hex"), hash, `Regenerate gallery after changing ${file}`);
  }
  const paths = new Set();
  for (const entry of entries) {
    paths.add(entry.original); paths.add(entry.thumbnail);
    Object.values(entry.variants).forEach(path => paths.add(path));
    const frames = entry.frames;
    if (frames.length) {
      assert.equal(frames.length, 61);
      assert.ok(frames.every((frame, index) => !index || frame.time > frames[index - 1].time));
      const interval = frames[1].time - frames[0].time;
      assert.ok(frames.every((frame, index) => Math.abs(frame.time - frames[0].time - index * interval) < 1e-9), "scrub distance maps uniformly to time");
      assert.ok(frames.some(frame => provenance.hashes[frame.src.split("/").at(-1)] !== provenance.hashes[frame.original.split("/").at(-1)]), `${entry.id} must visibly change its source`);
      frames.forEach(frame => { paths.add(frame.src); paths.add(frame.original); });
    } else assert.deepEqual(Object.keys(entry.variants).sort(), ["100", "25", "60"]);
  }
  for (const path of paths) {
    const bytes = await readFile(new URL(`../site/${path}`, import.meta.url));
    assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), provenance.hashes[path.split("/").at(-1)]);
  }
});

test("gallery switching is race-safe, failed renders preserve the image, and comparison controls work", async () => {
  const node = (dataset = {}) => ({ dataset, value: "", textContent: "", attrs: {}, listeners: {}, style: { setProperty(key, value) { this[key] = value; } },
    addEventListener(key, action) { this.listeners[key] = action; }, setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; }, replaceChildren(...items) { this.children = items; } });
  const cards = ["noir", "glitch", "heat"].map(effect => node({ effect }));
  const views = ["original", "split", "result"].map(effectView => node({ effectView }));
  const image = node(), stage = node(), eyebrow = node(); image.src = "noir-100.jpg";
  const nodes = Object.fromEntries(["effect-strength", "look-split", "effect-status", "effect-name", "effect-description", "effect-image-label", "effect-stack"].map(id => [id, node()]));
  nodes["effect-strength"].value = "100"; nodes["look-split"].value = "50";
  const pending = [];
  const context = { document: {
    querySelector: selector => ({ ".look-treated": image, ".look-image": stage, ".look-controls .eyebrow": eyebrow })[selector] ?? null,
    querySelectorAll: selector => selector === "[data-effect]" ? cards : selector === "[data-effect-view]" ? views : [],
    getElementById: id => nodes[id] ?? null, createElement: () => node(), addEventListener() {},
  }, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) }, cancelAnimationFrame() {},
  Image: class { decode() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } } };
  new Script(await readFile(new URL("../site/assets/effects-gallery/gallery-data.js", import.meta.url), "utf8")).runInNewContext(context);
  new Script(await readFile(new URL("../site/studio-site.js", import.meta.url), "utf8")).runInNewContext(context);
  const slow = cards[1].listeners.click(), fast = cards[2].listeners.click();
  pending[1].resolve(); await fast; pending[0].resolve(); await slow;
  assert.equal(nodes["effect-name"].textContent, "Heat"); assert.match(image.src, /heat-100/);
  nodes["effect-strength"].value = "25";
  const failed = nodes["effect-strength"].listeners.change(); pending[2].reject(new Error("offline")); await failed;
  assert.match(image.src, /heat-100/); assert.equal(nodes["effect-strength"].value, "100");
  assert.match(nodes["effect-status"].textContent, /could not load/);
  views[0].listeners.click(); assert.equal(stage.style["--split"], "100%");
  views[2].listeners.click(); assert.equal(stage.style["--split"], "0%");
  views[1].listeners.click(); assert.equal(stage.style["--split"], "50%");
  nodes["look-split"].value = "72"; nodes["look-split"].listeners.input();
  assert.equal(nodes["look-split"].attrs["aria-valuetext"], "28 percent effect visible");
});

test("full gallery filters by family and keywords and loads temporal comparison pairs atomically", async () => {
  const node = () => ({ dataset: {}, attrs: {}, listeners: {}, children: [], value: "", textContent: "", style: { setProperty() {} },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    addEventListener(key, action) { this.listeners[key] = action; }, setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; } });
  const ids = ["effect-cards", "effect-category", "effect-search", "effect-count", "effect-empty", "effect-frame", "effect-scrub", "effect-time", "effect-strength", "look-split", "effect-status", "effect-name", "effect-description", "effect-image-label", "effect-stack"];
  const nodes = Object.fromEntries(ids.map(id => [id, node()]));
  nodes["effect-category"].value = "all"; nodes["effect-strength"].value = "100";
  const original = node(), treated = node(), eyebrow = node(); original.src = "original.jpg"; treated.src = "noir.jpg";
  const pending = [];
  const context = { document: {
    getElementById: id => nodes[id] ?? null, createElement: node, addEventListener() {},
    querySelector: key => ({ ".look-original": original, ".look-treated": treated, ".look-controls .eyebrow": eyebrow })[key] ?? null,
    querySelectorAll: key => key === "[data-effect]" ? nodes["effect-cards"].children : [],
  }, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) }, cancelAnimationFrame() {},
  Image: class { decode() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } } };
  new Script(await readFile(new URL("../site/assets/effects-gallery/gallery-data.js", import.meta.url), "utf8")).runInNewContext(context);
  // Distinct URLs make it possible to deliberately fail either half of a pair.
  const police = context.ScenePilotGallery.entries.find(entry => entry.id === "lights-police");
  police.frames = police.frames.map((sample, index) => ({ ...sample, src: `result-${index}.jpg`, original: `original-${index}.jpg` }));
  new Script(await readFile(new URL("../site/studio-site.js", import.meta.url), "utf8")).runInNewContext(context);
  const cards = nodes["effect-cards"].children;
  assert.equal(cards.length, context.ScenePilotGallery.entries.length);
  nodes["effect-search"].value = "glow"; nodes["effect-search"].listeners.input();
  assert.equal(cards.find(card => card.dataset.effect === "heat").hidden, false, "search finds recipe ingredients too");
  nodes["effect-search"].value = "";
  nodes["effect-category"].value = "lights"; nodes["effect-category"].listeners.change();
  assert.equal(cards.filter(card => !card.hidden).length, 6);
  nodes["effect-search"].value = "not-a-real-effect"; nodes["effect-search"].listeners.input(); assert.equal(nodes["effect-empty"].hidden, false);
  nodes["effect-search"].value = ""; nodes["effect-search"].listeners.input();
  const selected = cards.find(card => card.dataset.effect === "lights-police").listeners.click();
  const samples = context.ScenePilotGallery.entries.find(entry => entry.id === "lights-police").frames;
  pending[0].resolve(); await Promise.resolve(); assert.equal(treated.src, "noir.jpg", "must await original too");
  pending[1].resolve(); await selected;
  assert.equal(treated.src, samples[2].src); assert.equal(original.src, samples[2].original);
  assert.equal(nodes["effect-strength"].disabled, true); assert.equal(nodes["effect-scrub"].hidden, false);
  nodes["effect-frame"].value = "6";
  const scrub = nodes["effect-frame"].listeners.input(); pending[2].resolve(); pending[3].resolve(); await scrub;
  assert.equal(treated.src, samples[6].src); assert.equal(nodes["effect-time"].textContent, `${samples[6].time.toFixed(3)} s`);
  nodes["effect-frame"].value = "7";
  const failed = nodes["effect-frame"].listeners.input(); pending[4].resolve(); pending[5].reject(new Error("missing original")); await failed;
  assert.equal(treated.src, samples[6].src); assert.equal(original.src, samples[6].original); assert.equal(nodes["effect-frame"].value, "6");
  const decodes = pending.length;
  nodes["effect-frame"].value = "2"; await nodes["effect-frame"].listeners.input();
  assert.equal(pending.length, decodes, "revisiting decoded frames requires no new decode");
  assert.equal(treated.src, samples[2].src);
  const scheduled = new Map(); let tick = 0;
  context.window.requestAnimationFrame = callback => { scheduled.set(++tick, callback); return tick; };
  context.window.cancelAnimationFrame = id => scheduled.delete(id);
  nodes["effect-frame"].value = "20"; nodes["effect-frame"].listeners.input();
  nodes["effect-frame"].value = "21"; nodes["effect-frame"].listeners.input();
  assert.equal(scheduled.size, 1, "rapid input coalesces to one screen refresh");
  assert.equal(pending.length, decodes);
  scheduled.values().next().value(); pending[decodes].resolve(); pending[decodes + 1].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(treated.src, samples[21].src, "only the latest requested sample is painted");
});
