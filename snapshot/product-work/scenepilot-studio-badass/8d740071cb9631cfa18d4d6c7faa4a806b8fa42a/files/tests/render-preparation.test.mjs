import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("master preparation excludes hidden picture and muted audio before reading linked files", async () => {
  const bundled = await build({ entryPoints: [new URL("../app/video-delivery.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [{ name: "capture-master", setup(builder) {
    builder.onLoad({ filter: /app\/render-client\.ts$/ }, () => ({ contents: 'export function renderAudioInWorker() {} export const workerRenderSupported = true, workerDirectDiskSupported = false; export function renderInWorker(options) { globalThis.captureMaster(options); return { result: Promise.reject(new Error("Captured master")), cancel() {} }; }', loader: "js" }));
    builder.onLoad({ filter: /lib\/capabilities\.ts$/ }, () => ({ contents: 'export async function checkExportProfile() { return { supported: true }; }', loader: "js" }));
  } }] });
  const { deliverVideo } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
  let captured; const messages = [];
  const originalWindow = globalThis.window;
  globalThis.window = {};
  globalThis.captureMaster = options => { captured = options; };
  const offline = { id: "offline", file: new File([], "offline.mov"), url: "scenepilot-media:/missing", kind: "video" };
  const picture = { id: "picture", file: new File(["fixture"], "picture.png"), kind: "image" };
  const context = { mainFile: null, mainUrl: "", mainName: "QA", assets: [offline, picture], visualAssets: [offline, picture],
    placements: [{ assetId: "picture", trackId: "v", start: 0, duration: 1 }, { assetId: "offline", trackId: "hidden", start: 0, duration: 1 }],
    clipTracks: [{ id: "v", enabled: true }, { id: "hidden", enabled: false }], baseCuts: [], compositions: [], montageEnabled: false,
    audioClips: [{ id: "muted", assetId: "offline", trackId: "a", muted: true, start: 0, duration: 1 }], audioTracks: [{ id: "a" }], audioBuses: [], masterGain: 1,
    titles: [], duration: 1, exportFormat: "mp4-h264", exportFrameRate: 30, exportMaxDimension: 1920, aspect: "source", customSize: { width: 640, height: 360 }, sourceDims: { w: 640, h: 360 }, timelineRange: {},
    isPro: true, strobeConfig: { pattern: "off" }, echoPreset: "off", hasShaderEffect: false, capabilities: { directDiskRendering: false }, renderMotion: () => ({}),
    renderLaunchRef: { current: false }, renderAbortRef: { current: null }, setStatus: message => messages.push(message), setRendering() {}, setRenderProgress() {}, setRenderQueue() {} };
  try {
    await deliverVideo(context);
    assert.ok(captured, messages.join("\n"));
    assert.deepEqual(captured.assets.map(asset => asset.id), ["picture"]);
    assert.deepEqual(captured.audioClips, []);
    assert.equal(context.renderLaunchRef.current, false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    delete globalThis.captureMaster;
  }
});

test("standalone composition delivery uses its own nested audio and neutral tracks, never the project song", async () => {
  const bundled = await build({
    entryPoints: [new URL("../app/video-delivery.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent",
    plugins: [{ name: "capture-composition-boundary", setup(build) {
      build.onLoad({ filter: /app\/render-client\.ts$/ }, () => ({ contents: 'export function renderAudioInWorker() { throw new Error("Unexpected audio-only worker"); } export const workerRenderSupported = true, workerDirectDiskSupported = false; export function renderInWorker(options) { globalThis.__captureCompositionOptions(options); return { result: Promise.reject(new Error("Captured render boundary")), cancel() {} }; }', loader: "js" }));
      build.onLoad({ filter: /lib\/capabilities\.ts$/ }, () => ({ contents: 'export async function checkExportProfile() { return { supported: true }; }', loader: "js" }));
    } }],
  });
  const { deliverActiveComposition } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
  let options, jobs = [];
  const file = new File(["qa"], "tone.wav", { type: "audio/wav" });
  const offline = { id: "offline", file: new File([], "disabled.mov"), kind: "video", url: "scenepilot-media:/disabled" };
  const composition = { id: "c", name: "Sound", width: 640, height: 360, duration: 2,
    tracks: [{ id: "a", kind: "audio", enabled: true }, { id: "v", kind: "video", enabled: true }], layers: [{ id: "s", kind: "media", name: "Tone", assetId: "tone", trackId: "a", enabled: true, start: 0, duration: 2, playbackRate: 2, audioGain: .5 }, { id: "disabled", kind: "media", assetId: "offline", trackId: "v", enabled: false }] };
  const original = Object.getOwnPropertyDescriptor(globalThis, "__captureCompositionOptions");
  globalThis.__captureCompositionOptions = value => { options = value; };
  try {
    const context = { rendering: false, mainFile: new File([], "unrelated-offline-song.wav"), mainUrl: "scenepilot-media:/unrelated",
      assets: [{ id: "tone", file, kind: "audio", url: "" }, offline], visualAssets: [offline], compositions: [composition],
      clipTracks: [{ id: "project-track", enabled: false, brightness: 200 }], exportFrameRate: 30, exportMaxDimension: 1920,
      renderLaunchRef: { current: false }, renderAbortRef: { current: null },
      setRenderQueue: update => { jobs = update(jobs); }, setRenderQueueOpen() {}, setRendering() {}, setRenderProgress() {}, setStatus() {} };
    await deliverActiveComposition(context, composition);
    assert.equal(options.mainFile, null);
    assert.deepEqual(options.assets, [], "disabled linked picture never reaches media resolution or the worker");
    assert.equal(options.useMainAudio, false);
    assert.equal(options.audioClips.length, 1);
    assert.equal(options.audioClips[0].playbackRate, 2);
    assert.equal(options.audioClips[0].file, file);
    assert.equal(options.tracks[0].enabled, true);
    assert.equal(options.tracks[0].brightness, 100);
    assert.equal(options.placements[0].trackId, options.tracks[0].id);
    assert.equal(context.renderLaunchRef.current, false);
    assert.match(jobs[0].error, /Captured render boundary/);
  } finally {
    if (original) Object.defineProperty(globalThis, "__captureCompositionOptions", original);
    else delete globalThis.__captureCompositionOptions;
  }
});

test("missing linked media releases export lock and can be retried", async () => {
  const bundled = await build({ entryPoints: [new URL("../app/video-delivery.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  const { deliverVideo } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
  const originals = Object.fromEntries(["window", "VideoEncoder", "VideoDecoder", "OffscreenCanvas", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let attempts = 0;
  const status = [];
  let jobs = [{ id: "qa", status: "queued" }];
  try {
    Object.assign(globalThis, { window: {}, VideoEncoder: { isConfigSupported: async () => ({ supported: true }) }, VideoDecoder: {}, OffscreenCanvas: {}, fetch: async () => { attempts++; return new Response("Missing", { status: 404 }); } });
    const context = {
      mainFile: new File([], "missing.mp4", { type: "video/mp4" }), mainUrl: "scenepilot-media:/missing", mainName: "QA",
      placements: [{ compositionId: "qa-comp" }], compositions: [], baseCuts: [], assets: [], audioTracks: [], audioClips: [], titles: [],
      montageEnabled: false, duration: 1, exportFormat: "mp4-h264", exportFrameRate: 30, exportMaxDimension: 1920, aspect: "source", customSize: { width: 640, height: 360 }, sourceDims: { w: 640, h: 360 }, timelineRange: {},
      isPro: false, strobeConfig: { pattern: "off" }, echoPreset: "off", hasShaderEffect: false,
      renderLaunchRef: { current: false }, renderAbortRef: { current: null },
      setStatus: (value) => status.push(value), setRendering() {}, setRenderProgress() {},
      setRenderQueue: (update) => { jobs = update(jobs); },
    };
    for (let i = 0; i < 2; i++) {
      await deliverVideo(context, jobs[0]);
      assert.equal(context.renderLaunchRef.current, false);
      assert.equal(jobs[0].status, "failed");
      assert.match(status.at(-1), /Could not read linked media missing.mp4/);
    }
    assert.equal(attempts, 2, "second attempt must not be rejected by a stale launch lock");
    globalThis.fetch = async (_url, { signal }) => {
      context.renderAbortRef.current.abort();
      signal.throwIfAborted();
    };
    await deliverVideo(context, jobs[0]);
    assert.equal(context.renderLaunchRef.current, false);
    assert.equal(jobs[0].status, "canceled");
    assert.match(status.at(-1), /canceled while preparing/);
    // Cancel while the native browser picker is unresolved. It cannot be
    // dismissed programmatically, but resolving it must never start encoding.
    let resolvePicker, enteredPicker;
    const entered = new Promise(resolve => { enteredPicker = resolve; });
    globalThis.window.showSaveFilePicker = () => { enteredPicker(); return new Promise(resolve => { resolvePicker = resolve; }); };
    let busy = false;
    context.setRendering = value => { busy = value; };
    const delivery = deliverVideo(context, jobs[0]);
    await entered;
    assert.equal(jobs[0].status, "awaiting-destination");
    assert.equal(busy, true, "cancel is available during destination selection");
    context.renderAbortRef.current.abort();
    resolvePicker({ createWritable: () => { throw new Error("must not write after cancellation"); } });
    await delivery;
    assert.equal(jobs[0].status, "canceled"); assert.equal(busy, false); assert.equal(context.renderLaunchRef.current,false);
    globalThis.window.showSaveFilePicker = async () => { throw new Error("Disk permission denied"); };
    await deliverVideo(context,jobs[0]);
    assert.equal(jobs[0].status,"failed"); assert.match(jobs[0].error,/Disk permission denied/);
    assert.equal(busy,false); assert.equal(attempts,2,"picker failures must not silently trigger a download render");
    // A clip-first edit must reach the same real preparation and cancellation
    // path, not get rejected for lacking a main song/video. Only the linked
    // asset should need fetching; there is no fabricated main source.
    delete globalThis.window.showSaveFilePicker;
    globalThis.fetch = async () => { attempts++; return new Response("Missing", { status: 404 }); };
    context.mainFile = null; context.mainUrl = "";
    context.assets = [{ id: "bin-video", file: new File([], "bin-video.mp4", { type: "video/mp4" }), url: "scenepilot-media:/bin-video" }];
    for (const baseLane of [true, false]) {
      context.baseCuts = baseLane ? [{ id: "cut", assetId: "bin-video", start: 0, duration: 1, sourceStart: 0 }] : [];
      context.placements = baseLane ? [] : [{ assetId: "bin-video", start: 0, duration: 1 }];
      context.montageEnabled = baseLane;
      await deliverVideo(context, jobs[0]);
      assert.match(jobs[0].error, /Could not read linked media bin-video.mp4/);
      assert.equal(context.renderLaunchRef.current, false);
      assert.equal(busy, false);
    }
    assert.equal(attempts, 4);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("composition preflight fails safely and retry cannot render a different sequence", async () => {
  const bundled = await build({ entryPoints: [new URL("../app/video-delivery.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  const { deliverVideo, deliverActiveComposition } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
  const keys = ["VideoEncoder", "VideoDecoder", "OffscreenCanvas"];
  const originals = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let jobs = [], rendering = false, config;
  const composition = { id: "comp", name: "QA", width: 640, height: 360, duration: 1, layers: [] };
  const context = {
    activeProjectId: "qa-project", compositions: [composition], rendering: false,
    renderLaunchRef: { current: false }, renderAbortRef: { current: null },
    exportFrameRate: 30, exportMaxDimension: 1920,
    setRenderQueue: (update) => { jobs = update(jobs); }, setRenderQueueOpen() {},
    setRendering: (value) => { rendering = value; }, setRenderProgress() {}, setStatus() {},
  };
  try {
    Object.assign(globalThis, { VideoEncoder: { isConfigSupported: async (value) => { config = value; return { supported: false }; } }, VideoDecoder: {}, OffscreenCanvas: {} });
    await deliverActiveComposition(context, composition);
    assert.equal(config.hardwareAcceleration, "no-preference");
    assert.equal(config.alpha, "discard", "preflight mirrors the opaque encoders used for color and alpha planes");
    assert.equal(jobs[0].status, "failed");
    assert.equal(jobs[0].compositionId, "comp");
    assert.equal(jobs[0].projectId, "qa-project");
    assert.match(jobs[0].error, /Transparent composition export is unavailable/);
    assert.equal(rendering, false);
    assert.equal(context.renderLaunchRef.current, false);
    await deliverVideo(context, jobs[0]);
    assert.equal(jobs.length, 1, "retry updates the original comp job");
    context.compositions = [];
    await deliverVideo(context, jobs[0]);
    assert.match(jobs[0].error, /composition no longer exists/);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
