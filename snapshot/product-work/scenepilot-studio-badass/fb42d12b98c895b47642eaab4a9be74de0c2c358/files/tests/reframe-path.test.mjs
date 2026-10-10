import assert from "node:assert/strict";
import test from "node:test";
import { applyManualOverrides, buildCameraPath, pathAt } from "../lib/reframe-path.ts";

test("dead zone: small jitter around the start doesn't move the camera", () => {
  const targets = [
    { time: 0, x: 0.5, y: 0.5 },
    { time: 1, x: 0.52, y: 0.49 }, // 2 cm of jitter, well inside an 8% dead zone
    { time: 2, x: 0.48, y: 0.51 },
  ];
  const path = buildCameraPath(targets, { deadZone: 0.08, maxPanSpeed: 0.6, ease: 0.35 });
  assert.equal(path[1].x, 0.5);
  assert.equal(path[1].y, 0.5);
  assert.equal(path[2].x, 0.5);
});

test("a subject that drifts beyond the dead zone pulls the camera toward it", () => {
  const targets = [
    { time: 0, x: 0.5, y: 0.5 },
    { time: 10, x: 0.9, y: 0.5 }, // way past the dead zone, lots of time to close in
  ];
  const path = buildCameraPath(targets, { deadZone: 0.08, maxPanSpeed: 0.6, ease: 0.5 });
  assert.ok(path[1].x > 0.6, `camera should move toward the subject: ${path[1].x}`);
  assert.ok(path[1].x < 0.9, `camera should not overshoot past the raw target in one step: ${path[1].x}`);
});

test("max pan speed caps how far the camera can move per second", () => {
  const targets = [
    { time: 0, x: 0.1, y: 0.5 },
    { time: 1, x: 0.95, y: 0.5 }, // a huge jump in 1 second
  ];
  const maxPanSpeed = 0.3; // 30% of frame width per second
  const path = buildCameraPath(targets, { deadZone: 0.02, maxPanSpeed, ease: 1 });
  const moved = path[1].x - path[0].x;
  assert.ok(moved <= maxPanSpeed + 1e-9, `moved ${moved} but cap is ${maxPanSpeed}`);
});

test("a scene cut resets the path instantly instead of panning across it", () => {
  const targets = [
    { time: 0, x: 0.1, y: 0.5 },
    { time: 1, x: 0.9, y: 0.5 }, // this target is right after a cut
  ];
  const path = buildCameraPath(targets, { deadZone: 0.02, maxPanSpeed: 0.3, ease: 0.3, cutTimes: [0.5] });
  assert.equal(path[1].x, 0.9, "hard reset to the new shot's subject, not a slow pan");
  assert.equal(path[1].cut, true);
});

test("a cut before the first target doesn't affect it (nothing to reset from)", () => {
  const targets = [{ time: 2, x: 0.3, y: 0.4 }];
  const path = buildCameraPath(targets, { cutTimes: [1] });
  assert.equal(path[0].x, 0.3);
  assert.equal(path[0].cut, false);
});

test("pathAt interpolates smoothly between points but holds across a cut edge", () => {
  const path = buildCameraPath(
    [
      { time: 0, x: 0.2, y: 0.5 },
      { time: 4, x: 0.2, y: 0.5 },
    ],
    { deadZone: 0, maxPanSpeed: 10, ease: 1 },
  );
  // Linear case: at t=0 and t=4 we know the values; midpoint should be close to the lerp.
  const mid = pathAt(path, 2);
  assert.ok(mid.x >= 0.15 && mid.x <= 0.25, `mid x ${mid.x}`);

  const cutPath = [
    { time: 0, x: 0.1, y: 0.5, cut: false },
    { time: 2, x: 0.9, y: 0.5, cut: true },
  ];
  const justBefore = pathAt(cutPath, 1.9);
  const atCut = pathAt(cutPath, 2);
  assert.equal(justBefore.x, 0.1, "holds the pre-cut value right up to the cut, no interpolation across it");
  assert.equal(atCut.x, 0.9, "snaps to the post-cut value at the cut's own sample time");
});

test("pathAt holds at the ends for times outside the path", () => {
  const path = buildCameraPath([{ time: 5, x: 0.3, y: 0.7 }]);
  assert.deepEqual(pathAt(path, 0), { x: 0.3, y: 0.7 });
  assert.deepEqual(pathAt(path, 100), { x: 0.3, y: 0.7 });
});

test("empty input produces an empty path and a centered default", () => {
  assert.deepEqual(buildCameraPath([]), []);
  assert.deepEqual(pathAt([], 3), { x: 0.5, y: 0.5 });
});

test("manual keyframe overrides pin the path and displace nearby automatic points", () => {
  const auto = buildCameraPath([
    { time: 0, x: 0.2, y: 0.5 },
    { time: 1, x: 0.25, y: 0.5 },
    { time: 2, x: 0.3, y: 0.5 },
  ]);
  const overridden = applyManualOverrides(auto, [{ time: 1, x: 0.8, y: 0.2 }], 0.2);
  const pinned = overridden.find((point) => Math.abs(point.time - 1) < 1e-6);
  assert.ok(pinned, "override point present");
  assert.equal(pinned.x, 0.8);
  assert.equal(pinned.y, 0.2);
  assert.equal(overridden.length, auto.length); // one auto point swapped for one pin at the same time
});
