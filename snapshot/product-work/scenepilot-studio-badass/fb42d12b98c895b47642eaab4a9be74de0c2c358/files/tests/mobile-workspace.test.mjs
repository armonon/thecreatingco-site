import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["app/mobile-studio.tsx"], bundle: true, write: false, platform: "node", format: "esm", jsx: "automatic", logLevel: "silent",
  loader: { ".css": "empty" },
  define: { "import.meta.url": JSON.stringify(new URL("../app/mobile-studio.tsx", import.meta.url).href) },
  plugins: [{ name: "mobile-hooks", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, args => args.importer.endsWith("mobile-studio.tsx") ? { path: "react", namespace: "test" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const useRef = current => ({current}); export const useState = initial => [initial === 'create' ? globalThis.__mobileTab : initial, () => {}];" }));
  } }],
});
const { MobileStudio } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function text(value) {
  if (value == null || typeof value === "boolean") return "";
  if (Array.isArray(value)) return value.map(text).join("");
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const button = (tree, name) => nodes(tree).find(n => n.type === "button" && (n.props["aria-label"] === name || text(n).trim() === name));
function render(tab, extra = {}) {
  globalThis.__mobileTab = tab;
  return MobileStudio({ mainName: "Sample.mp4", mainUrl: "blob:sample", mainIsAudio: false, assets: [], baseCuts: [], duration: 4, currentTime: 1, aspect: "source", styleId: "auto", titles: [], energyBars: [], titleDraft: "", status: "", previewStage: () => null, dimensions: { width: 1920, height: 1080 }, mainInputRef: { current: null }, assetInputRef: { current: null }, ...extra });
}

test("mobile exposes shared draft review, rules and lighting instead of an alternate engine", () => {
  const controls = { marker: "rules" }, review = { marker: "draft" }, lighting = { marker: "lights" };
  let generated = 0;
  const create = render("create", { automationControls: controls, draftReview: review, onGenerate: () => generated++ });
  assert.ok(nodes(create).includes(controls));
  assert.ok(nodes(create).includes(review));
  button(create, "Make my first cut").props.onClick();
  assert.equal(generated, 1);
  assert.ok(nodes(render("looks", { lightingControls: lighting })).includes(lighting));
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /onGenerate=\{runAutoCut\}/);
  assert.match(page, /mobileViewport && !isPro/);
  assert.doesNotMatch(page, /generateMobileCut|usePreviewPlayback/);
});

test("phone split, undo and redo invoke shared callbacks and respect busy state", () => {
  const calls = [];
  const props = { canUndo: true, canRedo: true, onUndo: () => calls.push("undo"), onRedo: () => calls.push("redo"), onSplit: () => calls.push("split") };
  const edit = render("edit", props);
  for (const name of ["Undo edit", "Redo edit"]) button(edit, name).props.onClick();
  nodes(edit).find(n => n.type === "button" && text(n).trim().startsWith("Split at playhead")).props.onClick();
  assert.deepEqual(calls, ["undo", "redo", "split"]);
  const busy = render("edit", { ...props, rendering: true });
  assert.equal(button(busy, "Undo edit").props.disabled, true);
  assert.equal(button(busy, "Redo edit").props.disabled, true);
});

test("phone timeline preserves imported clip positions, gaps and trailing empty time", () => {
  const edit = render("edit", { duration: 8, baseCuts: [{ id: "late", start: 2, duration: 1 }, { id: "end", start: 6, duration: 1 }] });
  const clips = nodes(edit).filter(n => n.type === "button" && n.props["aria-label"]?.startsWith("Seek to clip"));
  assert.deepEqual(clips.map(n => n.props.style), [{ left: "25%", width: "12.5%" }, { left: "75%", width: "12.5%" }]);
});

test("phone split is unavailable in gaps and at clip boundaries", () => {
  const baseCuts = [{ id: "a", start: 1, duration: 1 }, { id: "b", start: 3, duration: 1 }];
  const split = tree => nodes(tree).find(n => n.type === "button" && text(n).trim().startsWith("Split at playhead"));
  for (const currentTime of [0, 1, 2, 2.5, 3, 4]) assert.equal(split(render("edit", { baseCuts, currentTime })).props.disabled, true);
  assert.equal(split(render("edit", { baseCuts, currentTime: 1.5 })).props.disabled, false);
});

test("offline projects remain downloadable and their master is not counted twice", () => {
  const offline = { mainUrl: "", assets: [{ id: "__main__", name: "Sample.mp4", url: "" }], baseCuts: [{ id: "a", start: 0, duration: 1 }] };
  assert.equal(button(render("export", offline), "Download editable project").props.disabled, false);
  assert.ok(button(render("create", offline), "Save project"));
  assert.match(text(render("create", offline)), /1 SOURCE/);
  assert.doesNotMatch(text(render("create", offline)), /2 SOURCES|1 clips in your library/);
});

test("completed mobile renders expose a persistent named download and dismissal", () => {
  let cleared = false;
  const tree = render("export", { browserDownload: { url: "blob:render", name: "movie.mp4", size: 1048576 }, onDismissDownload: () => { cleared = true; } });
  const link = nodes(tree).find(n => n.type === "a" && n.props.download);
  assert.equal(link.props.href, "blob:render"); assert.equal(link.props.download, "movie.mp4");
  button(tree, "Discard rendered file").props.onClick(); assert.equal(cleared, true);
});

test("busy file actions reject duplicate requests and unlock after completion", async () => {
  let finish, calls = 0;
  const tree = render("edit", { onSave: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  button(tree, "Save project").props.onClick(); button(tree, "Save project").props.onClick();
  assert.equal(calls, 1);
  finish(); await Promise.resolve(); await Promise.resolve();
  button(tree, "Save project").props.onClick(); assert.equal(calls, 2); finish();
});

test("phone export is gated on encoder support and renderable content", () => {
  for (const props of [{ exportReady: false, renderableSequence: true }, { exportReady: true, renderableSequence: false }, { exportReady: true, renderableSequence: true, analyzing: true }, { exportReady: true, renderableSequence: true, missingMediaCount: 1 }]) {
    assert.equal(button(render("export", props), "Export video").props.disabled, true);
  }
  let count = 0;
  button(render("export", { exportReady: true, renderableSequence: true, onExport: () => count++ }), "Export video").props.onClick();
  assert.equal(count, 1);
});

test("mobile relinks audio and video, keeps offline projects openable, and cancels supported work", () => {
  const tree = render("create", { assets: [{ id: "missing", name: "Song.wav", url: "" }], transcribing: true, canCancelTranscription: true });
  assert.ok(button(tree, "Relink source files"));
  assert.ok(nodes(tree).some(n => n.type === "input" && n.props.accept === "video/*,audio/*,image/*"));
  assert.equal(button(tree, "Cancel").props.disabled, false);
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /missingMedia = relink\.unresolved\.length \+ unresolvedMain\.length/);
  assert.match(page, /onImportProject=\{async file => \{ if \(await projectSafety\.confirmReplace\(\)\)/);
});
