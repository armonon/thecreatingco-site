import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStudioComposition } from "../lib/composition-creation.ts";

const require = createRequire(import.meta.url);
async function component(file, name) {
  const bundled = await build({ entryPoints: [new URL(`../app/${file}.tsx`, import.meta.url).pathname], bundle: true, format: "cjs", platform: "node", jsx: "automatic", external: ["react", "react/*"], write: false, logLevel: "silent" });
  const bundledModule = { exports: {} };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(require, bundledModule, bundledModule.exports);
  return bundledModule.exports[name];
}
const Graph = await component("composition-graph-editor", "CompositionGraphEditor");
const Timeline = await component("composition-timeline", "CompositionTimeline");
const Properties = await component("composition-properties", "CompositionProperties");
const Drop = await component("composition-drop-surface", "CompositionDropSurface");
const c = createStudioComposition("c", { name: "Shot", width: 1920, height: 1080, duration: 86400, background: "#000000" }, { id: "s", name: "Source", kind: "video" });
const layer = { ...c.layers[0], start: 1, keyframes: [{ id: "k", time: .42, x: 50, y: 50, rotation: 0, opacity: 100, scale: 108 }] };
function nodes(element) { return !element || typeof element !== "object" ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)]; }

test("graph labels and positions reflect composition time, and track lock disables every point", () => {
  const html = renderToStaticMarkup(createElement(Graph, { layer, duration: 10, locked: true }));
  assert.match(html, /scale 108.0 at 1.42 seconds/);
  assert.equal((html.match(/<button disabled=""/g) ?? []).length, 5);
  assert.match(html, /left:14\.2/);
});
test("graph keyboard movement uses one composition frame at the layer playback rate", () => {
  const changes = []; let stopped = false;
  const tree = Graph.type({ layer: { ...layer, playbackRate: 2 }, duration: 10, frameRate: 60, onCheckpoint() {}, onValue(id, patch) { changes.push({ id, patch }); } });
  const button = nodes(tree).find(node => node.type === "button");
  button.props.onKeyDown({ key: "ArrowRight", preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.equal(changes[0].patch.time, .42 + 2 / 60); assert.ok(stopped);
});
test("graph pointer movement maps composition seconds back to trimmed source seconds", () => {
  const changes = [];
  const tree = Graph.type({ layer: { ...layer, start: 3, sourceStart: 8, playbackRate: 2 }, duration: 10, onValue(id, patch) { changes.push(patch); } });
  const button = nodes(tree).find(node => node.type === "button");
  button.props.onPointerMove({ pointerId: 1, clientX: 50, clientY: 50, altKey: true, currentTarget: { hasPointerCapture() { return true; }, parentElement: { getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; } } } });
  assert.deepEqual(changes, [{ time: 12 }]);
});
test("timeline initially hides graph, exposes zoom, and renders bounded long-comp ticks", () => {
  const html = renderToStaticMarkup(createElement(Timeline, { composition: c, selectedLayer: layer, time: 0, frameRate: 30 }));
  assert.doesNotMatch(html, /VALUE GRAPH/); assert.match(html, /Graph editor/);
  assert.match(html, /Composition timeline zoom/); assert.ok(html.length < 20000);
});
test("locked inspector visibly disables edits while keeping its unlock control reachable", () => {
  const lockedComp = { ...c, tracks: c.tracks.map(track => ({ ...track, locked: true })) };
  const html = renderToStaticMarkup(createElement(Properties, { composition: lockedComp, compositions: [lockedComp], layer, time: 0, selectedTrackKind: "video", mediaAssets: [], visualAssets: [], capabilities: {}, savedPresets: [], continuousEditHandlers: {} }));
  assert.match(html, /fieldset class="comp-edit-fields" disabled=""/);
  assert.match(html, /unlock the layer or its track/);
  assert.match(html, /<summary>Transform<\/summary>/); assert.match(html, /<summary>Masks &amp; motion blur<\/summary>/);
});
test("viewer offers real Fit and pixel zoom plus direct file-drop guidance", () => {
  const html = renderToStaticMarkup(createElement(Drop, { composition: { ...c, layers: [] }, time: 0 }, createElement("div", { className: "composition-stage" })));
  assert.match(html, /Composition viewer zoom/); assert.match(html, /100%/);
  assert.match(html, /Drop files here/);
});
