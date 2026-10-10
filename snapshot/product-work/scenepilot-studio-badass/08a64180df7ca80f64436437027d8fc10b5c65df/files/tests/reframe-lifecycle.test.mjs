import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisCoordinator } from "../lib/reframe-lifecycle.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("overlapping file analyses only commit newest result and progress, and abort stale work", async () => {
  const coordinator = createAnalysisCoordinator();
  const commits = [];
  const first = deferred();
  const second = deferred();
  let staleSignal;
  const oldRun = coordinator.run(async (signal, progress) => { staleSignal = signal; progress(0.1); return first.promise; }, {
    progress: (value) => commits.push("old-progress:" + value), result: (value) => commits.push("old:" + value),
  });
  const newRun = coordinator.run(async (_signal, progress) => { progress(0.8); return second.promise; }, {
    progress: (value) => commits.push("new-progress:" + value), result: (value) => commits.push("new:" + value),
  });
  assert.equal(staleSignal.aborted, true);
  first.resolve("stale");
  second.resolve("result");
  await newRun;
  await oldRun;
  assert.deepEqual(commits, ["old-progress:0.1", "new-progress:0.8", "new:result"]);
});

test("a rejected stale analysis cannot publish an error or clear newer analyzing state", async () => {
  const coordinator = createAnalysisCoordinator();
  const current = deferred();
  const commits = [];
  let rejectStale;
  const staleRun = coordinator.run(() => new Promise((_, reject) => { rejectStale = reject; }), {
    error: (e) => commits.push("stale-error:" + e.message), finally: () => commits.push("stale-finally"),
  });
  const currentRun = coordinator.run(() => current.promise, {
    result: (value) => commits.push(value), finally: () => commits.push("current-finally"),
  });
  rejectStale(new Error("late rejection"));
  current.resolve("fresh analysis");
  await Promise.all([staleRun, currentRun]);
  assert.deepEqual(commits, ["fresh analysis", "current-finally"]);
});
