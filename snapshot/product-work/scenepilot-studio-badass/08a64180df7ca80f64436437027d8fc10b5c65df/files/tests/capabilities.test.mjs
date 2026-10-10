import assert from "node:assert/strict";
import test from "node:test";
import { checkExportProfile, checkRenderSupport } from "../lib/capabilities.ts";

const full = { VideoEncoder: class {}, VideoDecoder: class {}, OffscreenCanvas: class {} };

test("a full Chromium-like scope is supported with no message", () => {
  const r = checkRenderSupport(full);
  assert.equal(r.supported, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.message, "");
});

test("a scope missing WebCodecs is unsupported and names what's missing", () => {
  const r = checkRenderSupport({ OffscreenCanvas: class {} });
  assert.equal(r.supported, false);
  assert.deepEqual(r.missing, ["VideoEncoder", "VideoDecoder"]);
  assert.ok(r.message.length > 0, "gives the user a sentence");
});

test("missing OffscreenCanvas alone is still unsupported", () => {
  const r = checkRenderSupport({ VideoEncoder: class {}, VideoDecoder: class {} });
  assert.equal(r.supported, false);
  assert.deepEqual(r.missing, ["OffscreenCanvas"]);
});

test("an empty scope reports all three missing", () => {
  const r = checkRenderSupport({});
  assert.equal(r.supported, false);
  assert.equal(r.missing.length, 3);
});

test("the exact selected codec profile must pass VideoEncoder validation", async () => {
  class Encoder {
    static async isConfigSupported(config) {
      return { supported: config.codec === "avc1.640028" && config.width === 1920 && config.framerate === 30 };
    }
  }
  class Canvas {
    getContext() { return {}; }
  }
  const scope = { VideoEncoder: Encoder, VideoDecoder: class {}, OffscreenCanvas: Canvas };
  const supported = await checkExportProfile({ format: "mp4-h264", width: 1920, height: 1080, frameRate: 30 }, scope);
  const unsupported = await checkExportProfile({ format: "mp4-hevc", width: 3840, height: 2160, frameRate: 60 }, scope);
  assert.equal(supported.supported, true);
  assert.equal(unsupported.supported, false);
});

test("a grade-dependent profile fails preflight without WebGL", async () => {
  class Encoder { static async isConfigSupported() { return { supported: true }; } }
  class Canvas { getContext() { return null; } }
  const result = await checkExportProfile(
    { format: "mp4-h264", width: 1920, height: 1080, frameRate: 30, requiresWebGL: true },
    { VideoEncoder: Encoder, VideoDecoder: class {}, OffscreenCanvas: Canvas },
  );
  assert.equal(result.supported, false);
  assert.match(result.message, /WebGL|reproduce/);
});

test("alpha delivery refuses effects it cannot preserve", async () => {
  class Encoder { static async isConfigSupported() { return { supported: true }; } }
  class Canvas { getContext() { return {}; } }
  const result = await checkExportProfile(
    { format: "webm-vp9-alpha", width: 1920, height: 1080, frameRate: 30, requiresWebGL: true },
    { VideoEncoder: Encoder, VideoDecoder: class {}, OffscreenCanvas: Canvas },
  );
  assert.equal(result.supported, false);
  assert.match(result.message, /Transparent export/);
});

test("VP9 alpha preflight checks the dual opaque encoder route", async () => {
  let seen;
  class Encoder { static async isConfigSupported(config) { seen = config; return { supported: config.alpha === "discard" && config.hardwareAcceleration === "no-preference" }; } }
  const result = await checkExportProfile({ format: "webm-vp9-alpha", width: 1920, height: 1080, frameRate: 30 }, { VideoEncoder: Encoder, VideoDecoder: class {}, OffscreenCanvas: class {} });
  assert.equal(result.supported, true);
  assert.equal(seen.alpha, "discard");
});
