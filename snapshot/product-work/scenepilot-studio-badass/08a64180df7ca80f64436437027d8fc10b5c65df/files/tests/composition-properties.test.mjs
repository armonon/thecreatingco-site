import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const bundled = await build({ entryPoints: [new URL("../app/composition-properties.tsx", import.meta.url).pathname], bundle: true, format: "cjs", platform: "node", jsx: "automatic", external: ["react", "react/*"], write: false, logLevel: "silent" });
const bundledModule = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(require, bundledModule, bundledModule.exports);
const { CompositionProperties } = bundledModule.exports;
const layer = { id: "audio", name: "Tone", kind: "media", assetId: "tone", enabled: true, keyframes: [], color: "#ffffff" };
const props = { composition: { id: "c", layers: [layer], duration: 6 }, compositions: [], layer, selectedTrackKind: "audio", mediaAssets: [{ id: "tone", name: "Tone.wav", kind: "audio" }], visualAssets: [], capabilities: {}, continuousEditHandlers: {}, savedPresets: [], time: 0 };

test("audio-only composition inspector enables media and exposes sound/timing, not unsupported visual controls", () => {
  const html = renderToStaticMarkup(createElement(CompositionProperties, props));
  assert.match(html, /Clip gain/); assert.match(html, /Fade in/); assert.match(html, /Source in/); assert.match(html, /Speed/);
  assert.match(html, /Delete layer/);
  assert.doesNotMatch(html, /Position X|Track matte source|Mask shape|Save current look|Add keyframe at/);
  assert.doesNotMatch(html, /<button disabled="">[^<]*(?:<[^>]+>)*[^<]*Media/);
  const mediaButton = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*? Media<\/button>/g)?.at(-1);
  assert.ok(mediaButton); assert.doesNotMatch(mediaButton, /disabled/);
});

test("visual composition groups expose audio fades as well as their visual controls", () => {
  const html = renderToStaticMarkup(createElement(CompositionProperties, { ...props, selectedTrackKind: "video", layer: { ...layer, kind: "composition" } }));
  assert.match(html, /Clip gain/); assert.match(html, /Fade out/);
  assert.match(html, /Position X/); assert.match(html, /Track matte source/);
});
