import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserDownloadSlot } from "../lib/browser-download.ts";

test("completed downloads survive retries and release old files on replacement or dismissal", () => {
  let id = 0;
  const revoked = [];
  const urls = { createObjectURL: () => `blob:${++id}`, revokeObjectURL: url => revoked.push(url) };
  const slot = createBrowserDownloadSlot(urls);
  const first = slot.replace(new Blob(["movie"]), "first.mp4");
  assert.deepEqual(first, { url: "blob:1", name: "first.mp4", size: 5 });
  assert.deepEqual(revoked, []);
  assert.throws(() => slot.replace(new Blob([]), "empty.mp4"), /empty video/);
  urls.createObjectURL = () => { throw new Error("Allocation failed"); };
  assert.throws(() => slot.replace(new Blob(["new"]), "new.mp4"), /Allocation failed/);
  assert.deepEqual(revoked, [], "a failed new render cannot discard the prior download");
  urls.createObjectURL = () => "blob:2";
  slot.replace(new Blob(["new"]), "second.mp4");
  assert.deepEqual(revoked, ["blob:1"]);
  slot.clear(); slot.clear();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
});
