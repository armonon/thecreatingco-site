import assert from "node:assert/strict";
import test from "node:test";
import { cropBounds, letterboxRect, outputSize, REFRAME_ASPECTS } from "../lib/reframe-crop.ts";

test("9:16 crop of a 1920x1080 source is full height, aspect-correct, centered by default", () => {
  const rect = cropBounds(1920, 1080, "9:16");
  assert.ok(Math.abs(rect.height - 1080) < 1e-6);
  assert.ok(Math.abs(rect.width / rect.height - REFRAME_ASPECTS["9:16"]) < 1e-6);
  assert.ok(Math.abs(rect.x - (1920 - rect.width) / 2) < 1e-6, "centered horizontally when centerX=0.5");
  assert.equal(rect.y, 0);
});

test("crop never leaves the source frame when the subject is near an edge", () => {
  for (const centerX of [0, 0.02, 0.5, 0.98, 1]) {
    const rect = cropBounds(1920, 1080, "9:16", centerX, 0.5);
    assert.ok(rect.x >= -1e-6, `x in bounds: ${rect.x}`);
    assert.ok(rect.x + rect.width <= 1920 + 1e-6, `right edge in bounds: ${rect.x + rect.width}`);
  }
});

test("a subject pinned at the left edge shows a crop flush against x=0, not centered", () => {
  const rect = cropBounds(1920, 1080, "9:16", 0, 0.5);
  assert.ok(Math.abs(rect.x) < 1e-6, `flush left: ${rect.x}`);
});

test("1:1 crop of a portrait source is full width, aspect-correct", () => {
  const rect = cropBounds(1080, 1920, "1:1");
  assert.ok(Math.abs(rect.width - 1080) < 1e-6);
  assert.ok(Math.abs(rect.height - 1080) < 1e-6);
  assert.ok(rect.y >= 0 && rect.y + rect.height <= 1920 + 1e-6);
});

test("4:5 crop dimensions match the 4/5 aspect ratio exactly", () => {
  const rect = cropBounds(1920, 1080, "4:5");
  assert.ok(Math.abs(rect.width / rect.height - 0.8) < 1e-6);
});

test("degenerate source size doesn't throw and returns a non-negative rect", () => {
  const rect = cropBounds(0, 0, "9:16");
  assert.equal(rect.width, 0);
  assert.equal(rect.height, 0);
});

test("outputSize returns even dimensions at the requested aspect", () => {
  for (const aspect of ["9:16", "4:5", "1:1"]) {
    const size = outputSize(aspect, 1080);
    assert.equal(size.width % 2, 0);
    assert.equal(size.height % 2, 0);
    assert.ok(Math.abs(size.width / size.height - REFRAME_ASPECTS[aspect]) < 0.01);
  }
});

test("letterboxRect fits the whole source inside the output, centered, preserving aspect", () => {
  const rect = letterboxRect(1920, 1080, 1080, 1920); // wide clip into a vertical canvas
  assert.ok(rect.width <= 1080 + 1e-6 && rect.height <= 1920 + 1e-6);
  assert.ok(Math.abs(rect.width / rect.height - 1920 / 1080) < 1e-6);
  assert.ok(Math.abs(rect.x - (1080 - rect.width) / 2) < 1e-6);
  assert.ok(Math.abs(rect.y - (1920 - rect.height) / 2) < 1e-6);
});
