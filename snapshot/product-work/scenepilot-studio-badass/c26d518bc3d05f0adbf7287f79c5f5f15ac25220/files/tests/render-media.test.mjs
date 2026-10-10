import assert from "node:assert/strict";
import test from "node:test";
import { renderMediaIds, visibleRenderPlacements } from "../lib/render-media.ts";
test("render dependencies include nested graphs, mattes, audio and plates, not unused bins", () => {
  const comps = [{ id: "outer", layers: [{ assetId: "video" }, { compositionId: "inner" }] }, { id: "inner", layers: [{ assetId: "audio" }, { effectGraph: { nodes: [{ assetId: "map" }] }, removal: { cleanPlateAssetId: "plate" }, compositionId: "outer" }] }, { id: "unused", layers: [{ assetId: "offline-unused" }] }];
  assert.deepEqual([...renderMediaIds([{ assetId: "composition:outer" }, { assetId: "main" }], comps)].sort(), ["audio", "main", "map", "plate", "video"]);
});

test("delivery ignores hidden and non-solo placements but keeps untracked picture", () => {
  const clips = [{ assetId: "hidden", trackId: "h" }, { assetId: "shown", trackId: "v" }, { assetId: "legacy" }];
  const tracks = [{ id: "h", enabled: false }, { id: "v", enabled: true }];
  assert.deepEqual(visibleRenderPlacements(clips, tracks).map(c => c.assetId), ["shown", "legacy"]);
  tracks[1].solo = true;
  assert.deepEqual(visibleRenderPlacements(clips, tracks).map(c => c.assetId), ["shown"]);
});

test("nested composition dependencies honor disabled layers, track visibility, solo and scheduled audio", () => {
  const comps = [{ id: "c", tracks: [{ id: "v", kind: "video", enabled: true, solo: true }, { id: "h", kind: "video", enabled: false }, { id: "n", kind: "video", enabled: true }, { id: "a", kind: "audio", enabled: true }], layers: [
    { assetId: "picture", trackId: "v", enabled: true, trackMatte: { layerId: "matte" } },
    { id: "matte", assetId: "matte", trackId: "v", enabled: true },
    { assetId: "disabled", trackId: "v", enabled: false },
    { assetId: "hidden", trackId: "h", enabled: true },
    { assetId: "not-solo", trackId: "n", enabled: true },
    { assetId: "unscheduled-audio", trackId: "a", enabled: true },
    { compositionId: "nested", trackId: "v", enabled: true },
  ] }, { id: "nested", layers: [{ assetId: "nested-picture" }, { assetId: "nested-offline", enabled: false }] }];
  assert.deepEqual([...renderMediaIds([{ compositionId: "c" }, { assetId: "scheduled-audio" }], comps, { pictureOnly: true })].sort(), ["matte", "nested-picture", "picture", "scheduled-audio"]);
});
