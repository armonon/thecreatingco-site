import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const TOOLS = ["autocut", "captions", "board", "grade"];

test("the site links every film tool and the tool pages are published under site/tools", async () => {
  const landing = await read("site/index.html");
  assert.match(landing, /href="#film-tools"/);
  assert.match(landing, /FILM TOOLS · ALPHA/);
  for (const tool of TOOLS) {
    assert.match(landing, new RegExp(`href="tools/${tool}/"`));
    await access(new URL(`../site/tools/${tool}/index.html`, import.meta.url));
    const built = await read(`site/tools/${tool}/index.html`);
    assert.match(built, /src="\/tools\/assets\//, `${tool} page loads its bundle from /tools/`);
  }
  await access(new URL("../site/tools/index.html", import.meta.url));
});

test("every tool page is labelled alpha and lists its limits", async () => {
  const shell = await read("tools/src/shell.tsx");
  assert.match(shell, />ALPHA</);
  assert.match(shell, /what works and what doesn’t yet/);
  for (const tool of TOOLS) {
    const source = await read(`tools/src/${tool}/main.tsx`);
    assert.match(source, /<ToolShell tool="/);
    assert.match(source, /const LIMITS = \[/);
  }
});

test("the embedded editor links to the film tools, the build keeps them out of the editor bundle", async () => {
  const topbar = await read("app/studio-topbar.tsx");
  assert.match(topbar, /props\.embedded && <a className="icon-button" href="\.\.\/tools\/"/);
  const config = await read("vite.tools.config.ts");
  assert.match(config, /base: "\/tools\/"/);
  assert.match(config, /site\/tools/);
  const pkg = JSON.parse(await read("package.json"));
  assert.match(pkg.scripts["build:tools"], /vite\.tools\.config\.ts/);
  assert.match(pkg.scripts.lint, /--ignore-pattern site\/tools/);
});

test("on-device ASR stays opt-in, CDN-loaded and license-compatible", async () => {
  const worker = await read("app/transcribe.worker.ts");
  assert.match(worker, /@huggingface\/transformers@3\.0\.2/);
  assert.match(worker, /device === "webgpu"/);
  const captions = await read("tools/src/captions/main.tsx");
  for (const model of ["Xenova/whisper-tiny.en", "Xenova/whisper-base.en", "Xenova/whisper-tiny"]) assert.ok(captions.includes(model));
  assert.match(captions, /MIT/);
  assert.match(captions, /Apache-2\.0/);
});

test("AutoCut reuses the editor's beat engine and finds faces by default with a self-hosted model", async () => {
  const music = await read("lib/autocut-music.ts");
  for (const engine of ["./beat-tracker.ts", "./downbeat-model.ts", "./onset-dsp.ts", "./tempo.ts", "./structure.ts", "./arc.ts"]) assert.ok(music.includes(engine), `uses ${engine}`);
  const faces = await read("tools/src/autocut/faces.ts");
  assert.match(faces, /blaze_face_short_range/);
  assert.match(faces, /Apache-2\.0/);
  assert.match(faces, /FACE_MODEL_PATH = "models\/blaze_face_short_range\.tflite"/, "self-hosted model is tried first");
  assert.ok(faces.indexOf("modelUrls()") > 0 && faces.includes("FACE_MODEL_FALLBACK_URL]"), "Google's bucket is only the fallback");
  const main = await read("tools/src/autocut/main.tsx");
  assert.match(main, /const \[faces, setFaces\] = useState\(true\)/, "faces default on");
  assert.match(main, /if \(faces && !faceFinder\.current\)/);
  assert.match(main, /setFaceState\("failed"\);\s*return null;/, "a model that fails to load degrades to no faces");
  const model = await readFile(new URL("../tools/public/models/blaze_face_short_range.tflite", import.meta.url));
  assert.equal(createHash("sha256").update(model).digest("hex"), "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f");
  const notice = await read("tools/public/models/NOTICE.txt");
  assert.match(notice, /Apache License/);
  assert.match(notice, /b4578f35940bf5a1/);
  await access(new URL("../site/tools/models/blaze_face_short_range.tflite", import.meta.url));
  await access(new URL("../site/tools/models/NOTICE.txt", import.meta.url));
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.dependencies["@mediapipe/tasks-vision"].replace(/^\^/, ""), JSON.parse(await read("node_modules/@mediapipe/tasks-vision/package.json")).version, "face WASM CDN fallback matches the installed runtime");
  assert.match(faces, new RegExp(`TASKS_VERSION = "${JSON.parse(await read("node_modules/@mediapipe/tasks-vision/package.json")).version.replaceAll(".", "\\.")}"`));
});

test("film tool pages are indexable with real titles, descriptions, canonicals and a sitemap", async () => {
  const sitemap = await read("site/sitemap.xml");
  const robots = await read("site/robots.txt");
  assert.match(robots, /Sitemap: https:\/\/scenepilot\.thecreatingco\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow: \/tools/);
  for (const page of ["tools/index.html", ...TOOLS.map((tool) => `tools/${tool}/index.html`)]) {
    for (const html of [await read(page), await read(`site/${page}`)]) {
      assert.doesNotMatch(html, /noindex/, `${page} is indexable`);
      assert.match(html, /<title>[^<]{30,80}\| ScenePilot<\/title>/, `${page} has a descriptive title`);
      assert.match(html, /<meta name="description" content="[^"]{80,}"/, `${page} has a description`);
      assert.match(html, /<link rel="canonical" href="https:\/\/scenepilot\.thecreatingco\.com\/tools\//);
      assert.match(html, /"@type": "WebApplication"/);
    }
    const url = `https://scenepilot.thecreatingco.com/${page.replace(/index\.html$/, "")}`;
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${url} is in the sitemap`);
  }
});

test("AutoCut is the featured film tool: first in the list, in the site nav and hero", async () => {
  const shell = await read("tools/src/shell.tsx");
  assert.match(shell, /TOOLS[^=]*= \[\s*\{ id: "autocut"/);
  const landing = await read("site/index.html");
  assert.match(landing, /<div class="nav-links" id="nav-links"><a class="nav-autocut" href="tools\/autocut\/">/);
  assert.match(landing, /class="hero-new" href="tools\/autocut\/"/);
  assert.match(landing, /<div class="tool-index">\s*<div class="tool-feature"><span>AUTOCUT/);
  const hub = await read("tools/src/hub.tsx");
  assert.match(hub, /hub-card-featured/);
});

test("Browser Lite imports a .cube LUT (Grade's output) from the Auto Director look section", async () => {
  const workspace = await read("app/auto-director-workspace.tsx");
  assert.match(workspace, /creativeLut: \{ name: string; detail: string; mix: number \} \| null; openLutImport\(\): void;/);
  assert.match(workspace, /onClick=\{openLutImport\}/);
  assert.match(workspace, /Import \.cube LUT/);
  const page = await read("app/page.tsx");
  assert.match(page, /creativeLut=\{creativeLut\.summary\} openLutImport=\{creativeLut\.open\}/);
  const hook = await read("app/use-creative-lut.ts");
  assert.match(hook, /parseCubeLut\(await file\.text\(\)\)/);
  assert.match(hook, /const open = \(\) => inputRef\.current\?\.click\(\);/);
  assert.match(page, /<input ref=\{lutInputRef\} hidden type="file" accept="\.cube"/, "the hidden picker is outside the Pro-only colour panel");
  const grade = await read("tools/src/grade/main.tsx");
  assert.doesNotMatch(grade, /no LUT import yet|doesn’t expose LUT import/);
});
