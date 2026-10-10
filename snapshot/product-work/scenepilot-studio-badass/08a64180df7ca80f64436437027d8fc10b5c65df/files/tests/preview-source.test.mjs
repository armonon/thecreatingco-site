import test from "node:test";
import assert from "node:assert/strict";
import { canCacheVideoFrame, observePreviewSource, shouldSeekPreviewSource } from "../lib/preview-source.ts";

test("paused preview invalidates plans built before the main decoder became ready", () => {
  const source = new EventTarget();
  let revision = 0;
  const stop = observePreviewSource(source, () => revision++);
  for (const event of ["loadedmetadata", "loadeddata", "resize"]) source.dispatchEvent(new Event(event));
  assert.equal(revision, 3);
  stop();
  source.dispatchEvent(new Event("loadeddata"));
  assert.equal(revision, 3, "unmounted decoders cannot invalidate a new preview");
});

test("async seeking cannot put a stale decoded picture into the paused frame cache", () => {
  const source = { readyState: 4, seeking: true, currentTime: 2 };
  assert.equal(canCacheVideoFrame(source, 2, .08), false);
  assert.equal(canCacheVideoFrame({ ...source, seeking: false }, 2, .08), true);
  assert.equal(canCacheVideoFrame({ ...source, seeking: false, readyState: 1 }, 2, .08), false);
  assert.equal(canCacheVideoFrame({ ...source, seeking: false, currentTime: 1 }, 2, .08), false);
});

test("a moving document clock never restarts an in-flight source seek",()=>{
  assert.equal(shouldSeekPreviewSource({currentTime:1,seeking:true},2,.08),false);
  assert.equal(shouldSeekPreviewSource({currentTime:1,seeking:false},2,.08),true);
  assert.equal(shouldSeekPreviewSource({currentTime:1,seeking:false},1.04,.08),false);
});
