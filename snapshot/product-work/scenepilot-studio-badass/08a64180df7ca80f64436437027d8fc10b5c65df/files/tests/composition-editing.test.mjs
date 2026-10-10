import assert from "node:assert/strict";
import test from "node:test";
import { compositionLayerLocked, compositionToLayerTime, layerToCompositionTime, layerTimeBounds, compositionRulerTicks, placeImportedCompositionMedia } from "../lib/composition-editing.ts";
import { createStudioComposition, validateCompositionSettings } from "../lib/composition-creation.ts";

const settings = { name: "Test", duration: 60, width: 1920, height: 1080, background: "#000000" };
const comp = () => createStudioComposition("comp", settings, { id: "source", name: "Shot", kind: "video", duration: 60 });
test("keyframe selection uses the visible composition time for delayed and retimed layers", () => {
  assert.equal(layerToCompositionTime({ start: 1 }, .42), 1.42);
  for (const layer of [{ start: 1 }, { start: 3, sourceStart: 8, playbackRate: 2 }, { start: 2, sourceStart: 6, playbackRate: .25 }]) {
    for (const time of [3, 4, 5, 10]) assert.equal(layerToCompositionTime(layer, compositionToLayerTime(layer, time)), time);
  }
});
test("source-local keyframe bounds respect trims, speed and the end of the comp", () => {
  assert.deepEqual(layerTimeBounds({ start: 5, duration: 10, sourceStart: 8, playbackRate: 2 }, 12), { minimum: 8, maximum: 22 });
  assert.equal(compositionToLayerTime({ start: 1 }, 1.42), .41999999999999993);
});
test("track and layer locks both disable animation edits", () => {
  const c = comp(); const layer = c.layers[0];
  assert.equal(compositionLayerLocked(c, layer), false);
  c.tracks.find(track => track.id === layer.trackId).locked = true;
  assert.equal(compositionLayerLocked(c, layer), true);
  assert.equal(compositionLayerLocked(comp(), { ...layer, locked: true }), true);
});
test("ruler work is bounded for tiny, standard and 24-hour compositions", () => {
  for (const duration of [.05, 1, 30, 60, 3600, 86400]) {
    const ticks = compositionRulerTicks(duration);
    assert.ok(ticks.length <= 13); assert.equal(ticks[0], 0);
    assert.ok(ticks.every((time, index) => time <= duration && (!index || time > ticks[index - 1])));
  }
});
test("creation and editable settings accept long comps and reject invalid values", () => {
  assert.equal(validateCompositionSettings({ ...settings, duration: 86400, width: 16 }), null);
  for (const patch of [{ duration: 0 }, { duration: NaN }, { duration: 86401 }, { width: 319 }, { height: 15 }]) assert.ok(validateCompositionSettings({ ...settings, ...patch }));
});
test("file drop places image and audio on compatible tracks at the playhead", () => {
  const c = comp();
  const next = placeImportedCompositionMedia(c, [
    { id: "png", layerId: "still", name: "Still", kind: "image", duration: Infinity },
    { id: "wav", layerId: "music", name: "Song", kind: "audio", duration: 10 },
  ], 55);
  assert.equal(c.layers.length, 1); assert.equal(next.layers.length, 3);
  assert.equal(next.layers[1].start, 55); assert.equal(next.layers[1].duration, 5);
  assert.equal(next.tracks.find(t => t.id === next.layers[2].trackId).kind, "audio");
  assert.equal(next.layers[2].duration, 5);
});
test("file import completion does not write to a deleted, locked or incompatible target", () => {
  const c = comp(); const video = c.tracks.find(t => t.kind === "video");
  const sources = [{ id: "image", layerId: "new", name: "Still", kind: "image" }];
  assert.equal(placeImportedCompositionMedia(c, sources, 0, "deleted"), c);
  assert.equal(placeImportedCompositionMedia(c, sources, 0, c.tracks.find(t => t.kind === "audio").id), c);
  video.locked = true;
  assert.equal(placeImportedCompositionMedia(c, sources, 0, video.id), c);
  assert.equal(placeImportedCompositionMedia(c, sources, 0), c);
});
