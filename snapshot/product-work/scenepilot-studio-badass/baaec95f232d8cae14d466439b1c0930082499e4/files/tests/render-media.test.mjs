import assert from "node:assert/strict";
import test from "node:test";
import { renderMediaIds } from "../lib/render-media.ts";
test("render dependencies include nested graphs, mattes, audio and plates, not unused bins", () => {
  const comps = [{ id: "outer", layers: [{ assetId: "video" }, { compositionId: "inner" }] }, { id: "inner", layers: [{ assetId: "audio" }, { effectGraph: { nodes: [{ assetId: "map" }] }, removal: { cleanPlateAssetId: "plate" }, compositionId: "outer" }] }, { id: "unused", layers: [{ assetId: "offline-unused" }] }];
  assert.deepEqual([...renderMediaIds([{ assetId: "composition:outer" }, { assetId: "main" }], comps)].sort(), ["audio", "main", "map", "plate", "video"]);
});
