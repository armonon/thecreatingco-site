import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

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
