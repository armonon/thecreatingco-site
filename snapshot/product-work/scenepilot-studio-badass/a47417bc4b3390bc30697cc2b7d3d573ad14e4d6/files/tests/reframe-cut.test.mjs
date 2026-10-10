// Scene-cut detection on synthetic frame samples, and the integration that
// matters for Reframe: a detected cut must make the camera path reset instead
// of panning across it. Reuses AutoCut's detectSceneCuts (same histogram +
// motion heuristic) rather than a second implementation.
import assert from "node:assert/strict";
import test from "node:test";
import { buildCameraPath, detectSceneCuts } from "../lib/reframe-path.ts";

/** Synthetic per-frame samples at `rate` Hz: a hard cut between scenes shows up as one spike in motion + histogram distance. */
function syntheticFrames(duration, sceneAt, rate = 4) {
  const out = [];
  let previousScene = null;
  for (let t = 0; t < duration; t += 1 / rate) {
    const scene = sceneAt(t);
    const changed = previousScene !== null && previousScene !== scene;
    out.push({
      time: t,
      brightness: scene === "a" ? 0.5 : 0.25,
      sharpness: 0.3,
      contrast: 0.3,
      motion: changed ? 0.5 : 0.03,
      histogramDistance: changed ? 0.75 : 0.02,
    });
    previousScene = scene;
  }
  return out;
}

test("detects a single hard cut partway through a clip and nothing else", () => {
  const samples = syntheticFrames(10, (t) => (t < 5 ? "a" : "b"));
  const cuts = detectSceneCuts(samples);
  assert.equal(cuts.length, 1);
  assert.ok(Math.abs(cuts[0] - 5) < 0.3, `cut near 5s: ${cuts}`);
});

test("a steady pan (continuous, gradual change) is not mistaken for a cut", () => {
  const samples = [];
  for (let t = 0; t < 8; t += 0.25) {
    samples.push({ time: t, brightness: 0.3 + t * 0.01, sharpness: 0.3, contrast: 0.3, motion: 0.1, histogramDistance: 0.05 });
  }
  assert.equal(detectSceneCuts(samples).length, 0);
});

test("two separated hard cuts are both detected", () => {
  const samples = syntheticFrames(12, (t) => (t < 4 ? "a" : t < 8 ? "b" : "a"));
  const cuts = detectSceneCuts(samples);
  assert.equal(cuts.length, 2);
  assert.ok(cuts.some((c) => Math.abs(c - 4) < 0.3));
  assert.ok(cuts.some((c) => Math.abs(c - 8) < 0.3));
});

test("a detected cut makes the camera path snap instead of pan across it", () => {
  const samples = syntheticFrames(10, (t) => (t < 5 ? "a" : "b"));
  const cuts = detectSceneCuts(samples);
  // Subject is at the left in scene "a", jumps to the right at the cut in scene "b" (new shot, new framing).
  const targets = [
    { time: 0, x: 0.15, y: 0.5 },
    { time: 4.75, x: 0.15, y: 0.5 },
    { time: 5.25, x: 0.85, y: 0.5 }, // first sample after the cut
    { time: 9.75, x: 0.85, y: 0.5 },
  ];
  const path = buildCameraPath(targets, { deadZone: 0.05, maxPanSpeed: 0.3, ease: 0.3, cutTimes: cuts });
  const postCut = path.find((p) => Math.abs(p.time - 5.25) < 1e-6);
  assert.equal(postCut.x, 0.85, "camera is already on the new subject right at the cut, not mid-pan");
  assert.equal(postCut.cut, true);
});
