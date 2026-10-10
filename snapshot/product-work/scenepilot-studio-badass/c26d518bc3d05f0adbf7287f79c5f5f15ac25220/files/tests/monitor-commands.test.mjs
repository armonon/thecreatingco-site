import test from "node:test";
import assert from "node:assert/strict";
import { createMonitorCommands } from "../lib/monitor-commands.ts";

function fixture(target, patch = {}) {
  const state = { source: { inPoint: 0, outPoint: 4 }, timeline: { inPoint: null, outPoint: null }, seeks: [], unsupported: 0 };
  const commands = createMonitorCommands({ target, sourceTime: 2, sourceDuration: 4, compositionTime: 1, compositionDuration: 3, currentTime: 9, duration: 30, fps: 30,
    setSourceRange: (update) => { state.source = update(state.source); }, setTimelineRange: (update) => { state.timeline = update(state.timeline); },
    seekSource: (t) => state.seeks.push(["source", t]), seekComposition: (t) => state.seeks.push(["composition", t]), seek: (t) => state.seeks.push(["program", t]),
    onUnsupported: () => state.unsupported++, ...patch });
  return { state, ...commands };
}
test("source marks do not mutate hidden sequence marks", () => {
  const f = fixture("source"); f.markMonitorBoundary("in"); f.markMonitorBoundary("out");
  assert.deepEqual(f.state.source, { inPoint: 2, outPoint: 2.05 });
  assert.deepEqual(f.state.timeline, { inPoint: null, outPoint: null });
});
test("program marks and unsupported comp marks never change source ranges", () => {
  const f = fixture("program"); f.markMonitorBoundary("out"); assert.equal(f.state.timeline.outPoint, 9);
  assert.deepEqual(f.state.source, { inPoint: 0, outPoint: 4 });
  const c = fixture("composition"); c.markMonitorBoundary("in"); assert.equal(c.state.unsupported, 1); assert.equal(c.state.timeline.inPoint, null);
});
test("source bounds cannot cross, become negative or exceed a short source", () => {
  const f = fixture("source", { sourceTime: 99, sourceDuration: .02 });
  f.markMonitorBoundary("in"); f.markMonitorBoundary("out");
  assert.deepEqual(f.state.source, { inPoint: 0, outPoint: .02 });
});
test("frame stepping routes to exactly the active monitor and clamps endpoints", () => {
  for (const target of ["source", "composition", "program"]) {
    const f = fixture(target); f.stepMonitorFrame(1); assert.equal(f.state.seeks.length, 1); assert.equal(f.state.seeks[0][0], target);
  }
  const f = fixture("source", { sourceTime: 4 }); f.stepMonitorFrame(1); assert.deepEqual(f.state.seeks, [["source", 4]]);
  const c = fixture("composition", { compositionTime: 0 }); c.stepMonitorFrame(-1); assert.deepEqual(c.state.seeks, [["composition", 0]]);
  const p = fixture("program"); p.stepMonitorFrame(1, true); assert.deepEqual(p.state.seeks, [["program", 10]]);
});
