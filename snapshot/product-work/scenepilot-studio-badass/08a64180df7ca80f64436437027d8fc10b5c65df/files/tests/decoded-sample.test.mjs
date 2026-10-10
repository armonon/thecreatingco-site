import test from "node:test";
import assert from "node:assert/strict";
import {withDecodedSample} from "../lib/decoded-sample.ts";

test("decoded sample is closed exactly once after asynchronous consumption", async () => {
  let closes = 0;
  const sample = {close() {closes++;}};
  const value = await withDecodedSample(sample, async current => {
    assert.equal(current, sample); assert.equal(closes, 0);
    await Promise.resolve(); return 42;
  });
  assert.equal(value, 42); assert.equal(closes, 1);
});
test("aborting after a decoder yields a frame still releases that frame", async () => {
  let closes = 0;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(withDecodedSample({close() {closes++;}}, () => controller.signal.throwIfAborted()), {name: "AbortError"});
  assert.equal(closes, 1);
});
test("draw and asynchronous analysis failures release samples and preserve the error", async () => {
  for (const asynchronous of [false, true]) {
    let closes = 0; const error = new Error("analysis failed");
    await assert.rejects(withDecodedSample({close() {closes++;}}, () => {
      if (asynchronous) return Promise.reject(error);
      throw error;
    }), value => value === error);
    assert.equal(closes, 1);
  }
});
test("missing decoder frames are allowed without skipping cancellation checks", async () => {
  assert.equal(await withDecodedSample(null, sample => sample === null), true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(withDecodedSample(null, () => controller.signal.throwIfAborted()), {name: "AbortError"});
});
