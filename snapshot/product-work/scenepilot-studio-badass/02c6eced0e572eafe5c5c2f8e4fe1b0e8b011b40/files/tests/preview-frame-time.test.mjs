import assert from "node:assert/strict";
import test from "node:test";
import {previewFrameTime} from "../lib/preview-frame-time.ts";

test("draft review holds the last exported frame at the out point",()=>{
  assert.equal(previewFrameTime(6,6,30),179/30);
  assert.equal(previewFrameTime(9,5.99,30),179/30);
  assert.equal(previewFrameTime(3,6,30),3);
  assert.equal(previewFrameTime(0,.01,30),0);
  assert.equal(previewFrameTime(-1,6),0);
  assert.equal(previewFrameTime(NaN,6),0);
  assert.equal(previewFrameTime(6,6,0),179/30);
  assert.equal(previewFrameTime(6,Infinity),0);
});
