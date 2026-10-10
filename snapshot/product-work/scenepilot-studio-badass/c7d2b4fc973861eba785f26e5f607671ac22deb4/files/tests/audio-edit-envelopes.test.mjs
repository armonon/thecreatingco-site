import assert from "node:assert/strict";
import test from "node:test";
import { sliceEditorialAudio, splitEditorialAudio, retimeLinkedAudio, patchEditorialAudio } from "../lib/source-edit.ts";
import { applySplitEdit, applyAsymmetricSplitEdit } from "../lib/pro-workflows.ts";
import { clipGainAt, setClipFade } from "../lib/pro-editor.ts";
import { extractTimedRanges } from "../lib/dialogue-edit.ts";
import { applyAudioCrossfade } from "../lib/audio-crossfade.ts";
import { exportOtioProject, importOtio } from "../lib/interchange.ts";

const clip = { id: "sound", assetId: "media", trackId: "a1", name: "Sound", start: 2, sourceStart: 3, duration: 10, gain: .8, pan: 0, fadeIn: 7, fadeOut: 6, muted: false, playbackRate: 2,
  automation: [{ id: "a", time: 0, gain: .4 }, { id: "b", time: 4, gain: 1.2 }, { id: "c", time: 10, gain: .5 }],
  envelopes: [{ offset: 2, duration: 15, fadeIn: 5, fadeOut: 8, shape: "equalPower" }] };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("partial and repeated cuts preserve overlapping fade/automation gain at every sampled time", () => {
  for (const fadeShape of ["linear", "equalPower", "exponential"]) {
    const original = { ...clip, fadeShape };
    for (const [from, to] of [[0, 2], [1, 8], [6, 10], [0, 10]]) {
      const piece = sliceEditorialAudio(original, from, to, "piece");
      for (let t = 0; t < to - from - 1e-6; t += .013) near(clipGainAt(piece, piece.start + t), clipGainAt(original, original.start + from + t));
      const repeated = sliceEditorialAudio(piece, .2, piece.duration - .1, "repeat");
      for (let t = 0; t < repeated.duration - 1e-6; t += .017) near(clipGainAt(repeated, repeated.start + t), clipGainAt(original, repeated.start + t));
      assert.equal(piece.sourceStart, clip.sourceStart + from * 2);
    }
  }
});

test("fade editing replaces only the matching retained edge, leaving composition envelopes intact", () => {
  const piece = sliceEditorialAudio(clip, 2, 8, "piece");
  assert.equal(piece.envelopes.length, 3);
  const cleared = setClipFade(piece, "in", 0);
  assert.equal(cleared.envelopes.length, 2);
  assert.ok(cleared.envelopes.some(e => e.origin === "clip-out"));
  assert.deepEqual(setClipFade(cleared, "out", 0).envelopes, [piece.envelopes[0]]);
  assert.equal(piece.envelopes.length, 3, "do not mutate undo state");
});

test("inspector trims preserve sound and explicit fade removal clears retained clip edges", () => {
  const trimmed = patchEditorialAudio(clip, { duration: 3 });
  for (let t = 0; t < 3; t += .013) near(clipGainAt(trimmed, trimmed.start + t), clipGainAt(clip, clip.start + t));
  const cleared = patchEditorialAudio(trimmed, { fadeIn: 0, fadeOut: 0 });
  assert.ok(cleared.envelopes.every(e => !e.origin));
  assert.deepEqual(cleared.envelopes, clip.envelopes);
});

test("J/L edits keep volume keys and inherited curves source-aligned and are idempotent", () => {
  for (const kind of ["j-cut", "l-cut", "reset"]) {
    const result = applySplitEdit(clip, 3, 7, kind, .5);
    assert.deepEqual(applySplitEdit(result, 3, 7, kind, .5), result);
    near(result.start + result.automation[1].time, clip.start + clip.automation[1].time);
    near(result.envelopes[0].offset - result.start, clip.envelopes[0].offset - clip.start);
  }
  const result = applyAsymmetricSplitEdit(clip, 3, 7, .4, .7);
  assert.deepEqual(applyAsymmetricSplitEdit(result, 3, 7, .4, .7), result);
});

test("linked varispeed scales retained envelope clocks as well as gain keys", () => {
  const piece = sliceEditorialAudio(clip, 2, 8, "piece");
  const before = { id: "video", start: piece.start, sourceStart: piece.sourceStart, duration: piece.duration, playbackRate: 2 };
  const after = { ...before, duration: piece.duration / 2, playbackRate: 4 };
  const result = retimeLinkedAudio(piece, before, after);
  for (let t = 0; t < result.duration - 1e-6; t += .013) near(clipGainAt(result, result.start + t), clipGainAt(piece, piece.start + t * 2));
});

test("dialogue extraction rebases every surviving fade, source offset and automation key", () => {
  const ranges = [{ start: 4, end: 5, duration: 1 }, { start: 8, end: 9, duration: 1 }];
  const result = extractTimedRanges([clip], ranges, sliceEditorialAudio);
  assert.deepEqual(result.map(c => [c.start, c.duration]), [[2, 2], [4, 3], [7, 3]]);
  for (const piece of result) for (let t = 0; t < piece.duration - 1e-6; t += .013) {
    const sourceLocal = (piece.sourceStart - clip.sourceStart) / 2 + t;
    near(clipGainAt(piece, piece.start + t), clipGainAt(clip, clip.start + sourceLocal));
  }
});

test("razor rejects edge/nonfinite cuts and preserves both halves", () => {
  for (const at of [NaN, Infinity, clip.start, clip.start + clip.duration]) assert.equal(splitEditorialAudio(clip, at, "tail"), null);
  const pieces = splitEditorialAudio(clip, 5, "tail");
  assert.deepEqual(pieces.map(c => [c.id, c.start, c.duration]), [["sound", 2, 3], ["tail", 5, 7]]);
  for (const piece of pieces) for (let t = 0; t < piece.duration - 1e-6; t += .013) near(clipGainAt(piece, piece.start + t), clipGainAt(clip, piece.start + t));
});

test("crossfade head extension keeps existing automation and inherited fades source-aligned", () => {
  const right = { ...clip, start: 12 };
  const pair = applyAudioCrossfade({ ...clip, duration: 10 }, right, .5);
  assert.equal(pair[1].start, 11.5);
  assert.equal(pair[1].automation[0].time, .5);
  assert.equal(pair[1].envelopes[0].offset, clip.envelopes[0].offset - .5);
});

test("OTIO round trips retained fade curves and rejects malformed envelope metadata", () => {
  const piece = sliceEditorialAudio(clip, 2, 8, "piece");
  const doc = JSON.parse(exportOtioProject({ project: "Envelope", assets: [{ id: "media", name: "Sound", sourcePath: "/media/sound.wav", kind: "audio" }, { id: "picture", name: "Picture", sourcePath: "/media/picture.mov", kind: "video" }], videoClips: [{ id: "video", assetId: "picture", trackId: "v1", start: 0, sourceStart: 0, duration: 10 }], videoTracks: [{ id: "v1", name: "Picture" }], audioClips: [piece], audioTracks: [{ id: "a1", name: "Audio" }] }));
  const result = importOtio(JSON.stringify(doc)).audioClips[0];
  assert.deepEqual(result.envelopes, JSON.parse(JSON.stringify(piece.envelopes)));
  for (let t = 0; t < piece.duration - 1e-6; t += .013) near(clipGainAt(result, result.start + t), clipGainAt(piece, piece.start + t));
  const meta = doc.tracks.children.find(t => t.kind === "Audio").children.find(c => c.OTIO_SCHEMA === "Clip.2").metadata.scenepilot_audio;
  for (const value of [[{ offset: "2", duration: 2, fadeIn: 1, fadeOut: 1 }], Array(1025).fill({}), [{ offset: 0, duration: -1, fadeIn: 0, fadeOut: 0 }]]) {
    meta.envelopes = value;
    assert.throws(() => importOtio(JSON.stringify(doc)), /Invalid OTIO audio envelope/);
  }
});
