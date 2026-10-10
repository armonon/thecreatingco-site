import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const TOOLS = ["captions", "board", "grade"];

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
