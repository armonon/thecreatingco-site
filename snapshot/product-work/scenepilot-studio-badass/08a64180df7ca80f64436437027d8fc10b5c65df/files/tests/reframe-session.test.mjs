import assert from "node:assert/strict";
import test from "node:test";
import { createReframeSession, parseReframeSession, reframeSessionMatchesMedia } from "../lib/reframe-session.ts";

const sample = () => createReframeSession({
  source: { name: "clip.mp4", size: 1234, sha256: "a".repeat(64), width: 1920, height: 1080, duration: 5 },
  settings: { aspect: "9:16", useFaces: false, deadZone: 0.08, maxPanSpeed: 0.6, ease: 0.35 },
  targets: [{ time: 1, x: 0.3, y: 0.5, weight: 1 }], cutTimes: [2],
  overrides: [{ time: 3, x: 0.74, y: 0.42 }], letterboxSegments: [{ start: 4, end: 5 }],
});

test("versioned editable session round-trips settings, targets, pins, and letterbox ranges", () => {
  const session = sample();
  const imported = parseReframeSession(JSON.stringify(session));
  assert.deepEqual(imported, session);
  assert.deepEqual(imported.overrides, [{ time: 3, x: 0.74, y: 0.42, weight: 1 }]);
});

test("session parser rejects unsupported versions, unsafe paths, and invalid edit data", () => {
  const session = sample();
  assert.throws(() => parseReframeSession(JSON.stringify({ ...session, version: 99 })), /format or version/);
  const withPath = { ...session, source: { ...session.source, path: "/private/movie.mp4" } };
  assert.throws(() => parseReframeSession(JSON.stringify(withPath)), /fields/);
  const invalidPin = { ...session, overrides: [{ time: 2, x: 3, y: 0.5, weight: 1 }] };
  assert.throws(() => parseReframeSession(JSON.stringify(invalidPin)), /overrides x/);
  const invalidRange = { ...session, letterboxSegments: [{ start: 4, end: 3 }] };
  assert.throws(() => parseReframeSession(JSON.stringify(invalidRange)), /letterbox range/);
});

test("relink requires content hash plus size, dimensions, and close duration without storing a path", () => {
  const session = sample();
  assert.equal(reframeSessionMatchesMedia(session, { size: 1234, sha256: "a".repeat(64), width: 1920, height: 1080, duration: 5.1 }), true);
  assert.equal(reframeSessionMatchesMedia(session, { size: 1234, sha256: "b".repeat(64), width: 1920, height: 1080, duration: 5 }), false);
});
