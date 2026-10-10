import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({ entryPoints: ["app/video-delivery.ts"], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent",
  plugins: [{ name: "mobile-delivery-boundary", setup(builder) {
    builder.onLoad({ filter: /app\/render-client\.ts$/ }, () => ({ contents: `
      export const workerRenderSupported = true, workerDirectDiskSupported = false;
      export const renderInWorker = (...args) => globalThis.__mobileRender(...args);
      export const renderAudioInWorker = () => { throw new Error("Unexpected audio worker"); };
    `, loader: "js" }));
    builder.onLoad({ filter: /lib\/capabilities\.ts$/ }, () => ({ contents: "export async function checkExportProfile() { return { supported: true }; }", loader: "js" }));
  } }],
});
const { deliverVideo } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

test("mobile export retains a completed file for an explicit download without opening Save As", async () => {
  const originalWindow = globalThis.window, originalRender = globalThis.__mobileRender;
  const statuses = [], ready = [];
  let busy = false, pickerCalls = 0, renderCalls = 0;
  const file = new File(["source"], "source.mp4", { type: "video/mp4" });
  const result = new Blob(["encoded movie"], { type: "video/mp4" });
  const context = {
    mainFile: file, mainUrl: "blob:source", mainName: file.name, assets: [], visualAssets: [],
    placements: [], baseCuts: [{ id: "cut", assetId: "__main__", start: 0, duration: 4, sourceStart: 0 }], compositions: [], clipTracks: [], audioClips: [], audioTracks: [], titles: [],
    isPro: false, rendering: false, duration: 4, montageEnabled: true,
    exportFormat: "mp4-h264", exportFrameRate: 30, exportMaxDimension: 1920,
    aspect: "source", customSize: { width: 640, height: 360 }, sourceDims: { w: 640, h: 360 }, timelineRange: {},
    strobeConfig: { pattern: "off" }, echoPreset: "off", capabilities: { directDiskRendering: false },
    renderMotion: () => ({}), renderLaunchRef: { current: false }, renderAbortRef: { current: null },
    setStatus: value => statuses.push(value), setRendering: value => { busy = value; }, setRenderProgress() {}, setRenderQueue() {},
    onBrowserDownloadReady: (blob, name) => ready.push({ blob, name }),
  };
  try {
    globalThis.window = { showSaveFilePicker: () => { pickerCalls++; throw new Error("Phone should use an explicit completed-file download"); } };
    globalThis.__mobileRender = () => { renderCalls++; return { result: Promise.resolve(result), cancel() {} }; };
    await deliverVideo(context);
    assert.equal(pickerCalls, 0); assert.equal(renderCalls, 1, statuses.join(" | "));
    assert.deepEqual(ready, [{ blob: result, name: "source-scenepilot.mp4" }]);
    assert.match(statuses.at(-1), /Tap Save video/); assert.equal(busy, false); assert.equal(context.renderLaunchRef.current, false);
    globalThis.__mobileRender = () => { context.renderAbortRef.current.abort(); return { result: Promise.resolve(result), cancel() {} }; };
    await deliverVideo(context);
    assert.equal(ready.length, 1, "canceled renders never replace the previous completed file");
    assert.match(statuses.at(-1), /canceled/); assert.equal(context.renderLaunchRef.current, false);
    globalThis.__mobileRender = () => ({ result: Promise.reject(new Error("Encoder failed")), cancel() {} });
    await deliverVideo(context);
    assert.equal(ready.length, 1); assert.match(statuses.at(-1), /Encoder failed/); assert.equal(busy, false);
  } finally { globalThis.window = originalWindow; globalThis.__mobileRender = originalRender; }
});
