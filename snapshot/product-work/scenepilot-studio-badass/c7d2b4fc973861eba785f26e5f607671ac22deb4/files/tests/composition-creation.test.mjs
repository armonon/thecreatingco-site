import test from "node:test";
import assert from "node:assert/strict";
import { createStudioComposition, validateCompositionSettings } from "../lib/composition-creation.ts";

const settings = { name: "  Portrait  ", width: 1080, height: 1920, duration: 12, background: "#050706" };
test("custom composition starts with valid independent tracks and serializable settings", () => {
  const comp = createStudioComposition("test", settings);
  assert.equal(comp.name, "Portrait");
  assert.equal(comp.width, 1080); assert.equal(comp.height, 1920); assert.equal(comp.duration, 12);
  assert.deepEqual(comp.layers, []);
  assert.equal(comp.tracks.length, 2);
  assert.equal(comp.activeCameraId, "test-camera-1");
  assert.deepEqual(JSON.parse(JSON.stringify(comp)), comp);
});
test("source-based creation seeds a layer with bounded duration and stable media reference", () => {
  const video = createStudioComposition("video", settings, { id: "asset", name: "Movie", kind: "video", duration: 3 });
  assert.equal(video.layers[0].assetId, "asset"); assert.equal(video.layers[0].duration, 3);
  assert.equal(video.layers[0].trackId, "video-video-track-1");
  const still = createStudioComposition("still", settings, { id: "image", name: "Still", kind: "image", duration: Infinity });
  assert.equal(still.layers[0].duration, 12);
  assert.equal(still.layers[0].start, 0);
});
test("invalid settings fail before creating a document", () => {
  for (const patch of [{ name: " " }, { width: 1079 }, { height: NaN }, { width: 9000 }, { duration: Infinity }, { duration: 0 }, { background: "broken" }]) {
    assert.ok(validateCompositionSettings({ ...settings, ...patch }));
    assert.throws(() => createStudioComposition("invalid", { ...settings, ...patch }));
  }
});
