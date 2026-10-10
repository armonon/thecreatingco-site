import assert from "node:assert/strict";
import test from "node:test";
import { planPointEdit, buildPointEditCut } from "../lib/point-edit.ts";

test("3-point: source span sets the timeline duration at 1x", () => {
  const plan = planPointEdit({ sourceIn: 2, sourceOut: 5, timelineIn: 10 });
  assert.deepEqual(plan, { start: 10, sourceStart: 2, duration: 3, playbackRate: 1, fitToFill: false });
});

test("3-point: timeline span sets the duration, playing from source in", () => {
  const plan = planPointEdit({ sourceIn: 4, timelineIn: 0, timelineOut: 2.5 });
  assert.deepEqual(plan, { start: 0, sourceStart: 4, duration: 2.5, playbackRate: 1, fitToFill: false });
});

test("4-point equal spans: no retime", () => {
  const plan = planPointEdit({ sourceIn: 0, sourceOut: 4, timelineIn: 1, timelineOut: 5 });
  assert.equal(plan.playbackRate, 1);
  assert.equal(plan.fitToFill, false);
  assert.equal(plan.duration, 4);
});

test("4-point longer source: fit-to-fill speeds it up", () => {
  // 6s of source into a 3s hole → 2x.
  const plan = planPointEdit({ sourceIn: 0, sourceOut: 6, timelineIn: 0, timelineOut: 3 });
  assert.ok(plan.fitToFill);
  assert.ok(Math.abs(plan.playbackRate - 2) < 1e-9);
  assert.equal(plan.duration, 3);
});

test("4-point shorter source: fit-to-fill slows it down", () => {
  const plan = planPointEdit({ sourceIn: 0, sourceOut: 2, timelineIn: 0, timelineOut: 4 });
  assert.ok(plan.fitToFill);
  assert.ok(Math.abs(plan.playbackRate - 0.5) < 1e-9);
});

test("unrepresentable fit-to-fill is rejected rather than silently changing the requested source span", () => {
  const fast = planPointEdit({ sourceIn: 0, sourceOut: 100, timelineIn: 0, timelineOut: 1 });
  assert.equal(fast, null);
  const slow = planPointEdit({ sourceIn: 0, sourceOut: 1, timelineIn: 0, timelineOut: 100 });
  assert.equal(slow, null);
});

test("invalid point sets return null", () => {
  assert.equal(planPointEdit({ sourceIn: 0, timelineIn: 0 }), null, "no duration on either side");
  assert.equal(planPointEdit({ sourceIn: -1, sourceOut: 2, timelineIn: 0 }), null, "negative source in");
  assert.equal(planPointEdit({ sourceIn: 5, sourceOut: 5, timelineIn: 0 }), null, "zero-length source span");
});

test("buildPointEditCut carries the template look and sets the new geometry", () => {
  const template = {
    id: "orig", assetId: "a1", start: 0, duration: 4, sourceStart: 0, playbackRate: 1,
    color: "#abc", effects: [{ id: "e" }], fadeIn: 0.1, transitionType: "dissolve", transitionDuration: 0.3,
  };
  const cut = buildPointEditCut(template, { sourceIn: 1, sourceOut: 7, timelineIn: 2, timelineOut: 5 }, "new1");
  assert.equal(cut.id, "new1");
  assert.equal(cut.assetId, "a1", "keeps the source asset");
  assert.equal(cut.color, "#abc", "keeps the look");
  assert.equal(cut.start, 2);
  assert.equal(cut.duration, 3);
  assert.ok(Math.abs(cut.playbackRate - 2) < 1e-9, "fit-to-fill retimed");
  assert.equal(cut.transitionType, undefined, "retime dropped stale transition timing");
});
