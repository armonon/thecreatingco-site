import assert from "node:assert/strict";
import test from "node:test";
import { motionCentroid, pickSubjectTarget } from "../lib/reframe-subjects.ts";

test("no faces: no target (caller falls back to motion saliency)", () => {
  assert.equal(pickSubjectTarget([], 0.4), null);
});

test("one face: follow it directly", () => {
  const pick = pickSubjectTarget([{ x: 0.3, y: 0.4, size: 0.1 }], 0.4);
  assert.deepEqual(pick, { x: 0.3, y: 0.4, multi: false });
});

test("two close faces that fit in the crop: keep both, follow their centroid", () => {
  const faces = [{ x: 0.4, y: 0.5, size: 0.08 }, { x: 0.5, y: 0.5, size: 0.08 }];
  const pick = pickSubjectTarget(faces, 0.6, 0.1); // span 0.18 < fitWidth 0.6
  assert.equal(pick.multi, true);
  assert.ok(Math.abs(pick.x - 0.45) < 1e-6);
});

test("two faces too far apart for the crop: follow the larger one", () => {
  const faces = [{ x: 0.1, y: 0.5, size: 0.05 }, { x: 0.9, y: 0.5, size: 0.12 }];
  const pick = pickSubjectTarget(faces, 0.4, 0.1); // span way over fitWidth
  assert.equal(pick.multi, false);
  assert.equal(pick.x, 0.9); // the larger/active face
});

test("three or more faces that don't fit together: follow the single largest", () => {
  const faces = [
    { x: 0.2, y: 0.5, size: 0.05 },
    { x: 0.5, y: 0.5, size: 0.09 }, // largest
    { x: 0.8, y: 0.5, size: 0.06 },
  ];
  const pick = pickSubjectTarget(faces, 0.3, 0.1); // crop too narrow for even the top two to fit
  assert.equal(pick.multi, false);
  assert.equal(pick.x, 0.5);
});

test("three or more faces where the top two by size do fit: still only considers the top two", () => {
  const faces = [
    { x: 0.2, y: 0.5, size: 0.02 }, // smallest, ignored even though it would widen the group
    { x: 0.5, y: 0.5, size: 0.09 },
    { x: 0.6, y: 0.5, size: 0.08 },
  ];
  const pick = pickSubjectTarget(faces, 0.9, 0.1);
  assert.equal(pick.multi, true);
  assert.ok(Math.abs(pick.x - 0.55) < 1e-6);
});

function frame(width, height, fill) {
  const data = new Uint8Array(width * height);
  data.fill(fill);
  return data;
}

test("motion centroid finds a moving bright region against a static background", () => {
  const width = 20, height = 20;
  const previous = frame(width, height, 20);
  const current = frame(width, height, 20);
  // A bright 4x4 block near the right edge "moves in" on this frame.
  for (let y = 12; y < 16; y++) for (let x = 14; x < 18; x++) current[y * width + x] = 220;
  const result = motionCentroid(previous, current, width, height);
  assert.ok(result, "motion detected");
  assert.ok(result.x > 0.6, `centroid x should be near the right: ${result.x}`);
  assert.ok(result.y > 0.5, `centroid y should be in the lower half: ${result.y}`);
});

test("a static frame (no change) reports no motion", () => {
  const width = 10, height = 10;
  const a = frame(width, height, 50);
  const b = frame(width, height, 50);
  assert.equal(motionCentroid(a, b, width, height), null);
});

test("sensor-noise-level flicker below the noise floor doesn't register as motion", () => {
  const width = 10, height = 10;
  const a = frame(width, height, 50);
  const b = frame(width, height, 53); // +3, under the 8-level noise floor
  assert.equal(motionCentroid(a, b, width, height), null);
});
