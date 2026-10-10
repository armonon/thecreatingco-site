import test from "node:test";
import assert from "node:assert/strict";
import { coerceRenderAnalysis, remapRenderAnalysis, renderAnalysisFrom } from "../lib/render-analysis.ts";
import { parseCutFile } from "../lib/project-store.ts";

test("render analysis keeps a drop only when it is pronounced", () => {
  assert.deepEqual(renderAnalysisFrom([0, 2], { dropTime: 8, dropStrength: 0.4 }), { accents: [0, 2], dropRamp: { dropTime: 8 } });
  assert.equal(renderAnalysisFrom([0, 2], { dropTime: 8, dropStrength: 0.15 }).dropRamp, null, "the same 0.15 threshold the drop ramp uses");
});

test("saved render analysis is validated, never guessed", () => {
  assert.deepEqual(coerceRenderAnalysis({ accents: [4, 0, 2], dropRamp: { dropTime: 6 } }), { accents: [0, 2, 4], dropRamp: { dropTime: 6 } });
  assert.deepEqual(coerceRenderAnalysis({ accents: [], dropRamp: null }), { accents: [], dropRamp: null });
  for (const bad of [null, [], { accents: "0" }, { accents: [0, Number.NaN] }, { accents: [-1] }, { accents: [0], dropRamp: { dropTime: "8" } }, { accents: [0], dropRamp: 8 }]) {
    assert.equal(coerceRenderAnalysis(bad), null, JSON.stringify(bad));
  }
});

test("render analysis follows a timeline edit that removes time", () => {
  const cut = (time) => time < 2 ? time : time < 3 ? null : time - 1;
  assert.deepEqual(remapRenderAnalysis({ accents: [0, 2.5, 4], dropRamp: { dropTime: 6 } }, cut), { accents: [0, 3], dropRamp: { dropTime: 5 } });
  assert.equal(remapRenderAnalysis({ accents: [], dropRamp: { dropTime: 2.5 } }, cut).dropRamp, null);
});

test("cut files carry render analysis so a reopened document renders the same", () => {
  const base = { format: "scenepilot-cut", version: 2, effects: {} };
  assert.deepEqual(parseCutFile(JSON.stringify({ ...base, renderAnalysis: { accents: [0, 2], dropRamp: { dropTime: 8 } } })).renderAnalysis, { accents: [0, 2], dropRamp: { dropTime: 8 } });
  assert.equal(parseCutFile(JSON.stringify(base)).renderAnalysis, null, "older documents have none");
});
