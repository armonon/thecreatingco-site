import assert from "node:assert/strict";
import test from "node:test";
import { mediaUsageCounts, queryMediaAssets } from "../lib/media-browser-query.ts";

const media = (id, props = {}) => ({ id, name: `Shot ${id}`, kind: "video", folderId: "bin-root", url: `blob:${id}`, file: { lastModified: 0 }, ...props });
const options = (props = {}) => ({ activeBinId: "bin-root", mediaSearch: "", mediaKindFilter: "all", smartFilter: "all", mediaSort: "name", mediaUsage: new Map(), ...props });
test("media usage counts every lane and nested composition reference", () => {
  const usage = mediaUsageCounts([{ assetId: "a" }], [{ assetId: "b" }, {}], [{ assetId: "a" }], [{ layers: [{ assetId: "a" }, {}] }]);
  assert.deepEqual([...usage], [["a", 3], ["b", 1]]);
});
test("media filtering composes bin/search/kind/favorite/missing without mutation", () => {
  const items = [media("2", { favorite: true }), media("10", { folderId: "bin-two", url: "" }), media("3", { kind: "audio" })];
  assert.deepEqual(queryMediaAssets(items, options()).map(a => a.id), ["2", "3", "10"]);
  assert.deepEqual(queryMediaAssets(items, options({ mediaKindFilter: "favorites" })).map(a => a.id), ["2"]);
  assert.deepEqual(queryMediaAssets(items, options({ mediaKindFilter: "missing" })).map(a => a.id), ["10"]);
  assert.deepEqual(queryMediaAssets(items, options({ activeBinId: "bin-two", mediaSearch: " SHOT 10 " })).map(a => a.id), ["10"]);
  assert.deepEqual(queryMediaAssets(items, options({ mediaKindFilter: "audio" })).map(a => a.id), ["3"]);
  assert.deepEqual(items.map(a => a.id), ["2", "10", "3"]);
});
test("sorts by recency, duration and actual usage with absent values", () => {
  const items = [media("a", { duration: 10 }), media("b", { file: { lastModified: 100 } })];
  assert.equal(queryMediaAssets(items, options({ mediaSort: "recent" }))[0].id, "b");
  assert.equal(queryMediaAssets(items, options({ mediaSort: "duration" }))[0].id, "a");
  assert.equal(queryMediaAssets(items, options({ mediaSort: "usage", mediaUsage: new Map([["b", 3]]) }))[0].id, "b");
});
test("smart filtering retains audio and first-match legacy profile behavior", () => {
  const items = [media("a"), media("b"), media("c", { kind: "audio" })];
  const profiles = [{ assetId: "a", flashiness: .1 }, { assetId: "a", flashiness: .9 }, { assetId: "b", flashiness: .8 }];
  assert.deepEqual(queryMediaAssets(items, options({ profiles, smartFilter: "energetic" })).map(a => a.id), ["b", "c"]);
  assert.deepEqual(queryMediaAssets(items, options({ smartFilter: "energetic" })).map(a => a.id), ["c"]);
});
test("large bins index profile identifiers once instead of per-comparison scans", () => {
  let reads = 0;
  const items = Array.from({ length: 5000 }, (_, n) => media(String(n)));
  const profiles = items.map((item, n) => ({ get assetId() { reads++; return item.id; }, flashiness: n % 2 ? .8 : .1, brightness: .5, sourceDuration: 10, peakTime: 5 }));
  assert.equal(queryMediaAssets(items, options({ profiles, smartFilter: "best" })).length, 2500);
  assert.ok(reads <= items.length * 2, `profile IDs accessed ${reads} times`);
});
